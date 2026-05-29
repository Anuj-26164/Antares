import crypto from 'crypto';
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import User from '../models/User.js';
import Media from '../models/Media.js';
import r2Client, { R2_BUCKET_NAME } from '../config/r2.js';
import config from '../config/env.js';
import { compressAvatar } from '../utils/imageProcessor.js';

/**
 * Check if a URL points to an R2-hosted avatar.
 * @param {string} url
 * @returns {boolean}
 */
export function isR2Avatar(url) {
  return Boolean(url && url.startsWith(config.R2_PUBLIC_URL + '/avatars/'));
}

/**
 * Extract the R2 object key from a full R2 public URL.
 * @param {string} url
 * @returns {string}
 */
export function extractR2Key(url) {
  return url.replace(config.R2_PUBLIC_URL + '/', '');
}

/**
 * Upload a new avatar for the authenticated user.
 * POST /api/users/me/avatar
 * Accepts a multipart file (from multer), compresses it to WebP,
 * uploads to R2, updates the user's avatar field, and cleans up the old avatar.
 */
export async function uploadAvatar(req, res) {
  // 1. Validate file presence
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'No file provided',
    });
  }

  // 2. Compress the image to WebP
  let compressedBuffer;
  try {
    compressedBuffer = await compressAvatar(req.file.buffer);
  } catch (sharpError) {
    return res.status(500).json({
      success: false,
      error: 'Image processing failed',
    });
  }

  // 3. Generate unique R2 key
  const key = `avatars/${crypto.randomUUID()}.webp`;

  // 4. Upload to R2
  try {
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: compressedBuffer,
      ContentType: 'image/webp',
    });
    await r2Client.send(command);
  } catch (r2Error) {
    return res.status(503).json({
      success: false,
      error: 'Storage service unavailable. Please try again later.',
    });
  }

  // 5. Update user's avatar field
  const user = await User.findById(req.user._id);
  const oldAvatar = user.avatar;
  const avatarUrl = `${config.R2_PUBLIC_URL}/${key}`;
  user.avatar = avatarUrl;
  await user.save();



  // 6. Delete old R2 avatar (non-blocking, log failures)
  if (isR2Avatar(oldAvatar)) {
    const oldKey = extractR2Key(oldAvatar);
    const deleteCommand = new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: oldKey,
    });
    r2Client.send(deleteCommand).catch((err) => {
      console.error(`Failed to delete old avatar from R2 (key: ${oldKey}):`, err.message);
    });
  }

  return res.status(201).json({
    success: true,
    data: { avatarUrl },
  });
}

/**
 * Get current user profile.
 * GET /api/users/me
 * Returns the authenticated user's profile excluding sensitive fields.
 */
export async function getMe(req, res) {
  const user = await User.findById(req.user._id).select('-password -refreshToken');

  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    });
  }

  return res.status(200).json({
    success: true,
    data: user
  });
}

/**
 * Update current user profile.
 * PUT /api/users/me
 * Allows updating name and avatar only.
 */
export async function updateMe(req, res) {
  const { name, avatar } = req.body;

  const user = await User.findById(req.user._id);

  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    });
  }

  if (name !== undefined) user.name = name;
  if (avatar !== undefined) {
    // If avatar is being removed (set to empty string) and current avatar is R2-hosted, clean up old object
    if (avatar === '' && isR2Avatar(user.avatar)) {
      const oldKey = extractR2Key(user.avatar);
      const deleteCommand = new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: oldKey,
      });
      r2Client.send(deleteCommand).catch((err) => {
        console.error(`Failed to delete old avatar from R2 (key: ${oldKey}):`, err.message);
      });
    }
    user.avatar = avatar;
  }

  try {
    await user.save();
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: err.message
      });
    }
    throw err;
  }

  // Return user without sensitive fields
  const updatedUser = user.toObject();
  delete updatedUser.password;
  delete updatedUser.refreshToken;

  return res.status(200).json({
    success: true,
    data: updatedUser
  });
}

/**
 * Get current user's favourited media.
 * GET /api/users/me/favourites
 * Returns media items the user has favourited, sorted reverse-chronological, paginated max 20.
 */
export async function getMyFavourites(req, res) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const filter = { favouritedBy: req.user._id };

  const [media, total] = await Promise.all([
    Media.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Media.countDocuments(filter)
  ]);

  return res.status(200).json({
    success: true,
    data: {
      media,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
}

/**
 * Search users by name or email (for tagging).
 * GET /api/users/search?q=query
 * Returns up to 10 matching users (excluding the requester).
 * Email is used for matching but NOT returned in the response to protect PII.
 */
export async function searchUsers(req, res) {
  const q = (req.query.q || '').trim();
  if (!q || q.length < 2) {
    return res.status(200).json({ success: true, data: [] });
  }

  const regex = new RegExp(q, 'i');
  const users = await User.find({
    _id: { $ne: req.user._id },
    $or: [{ name: regex }, { email: regex }],
  })
    .select('_id name avatar')
    .limit(10)
    .lean();

  return res.status(200).json({ success: true, data: users });
}

/**
 * Change a user's role. Admin only.
 * PUT /api/users/:id/role
 * Validates target role is one of the four valid roles.
 * Prevents demoting the last admin.
 */
export async function changeRole(req, res) {
  const { role } = req.body;
  const validRoles = ['admin', 'photographer', 'club_member', 'viewer'];

  if (!role || !validRoles.includes(role)) {
    return res.status(400).json({
      success: false,
      error: `Invalid role. Must be one of: ${validRoles.join(', ')}`
    });
  }

  const user = await User.findById(req.params.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    });
  }

  // Prevent demoting the last admin
  if (user.role === 'admin' && role !== 'admin') {
    const adminCount = await User.countDocuments({ role: 'admin' });
    if (adminCount <= 1) {
      return res.status(403).json({
        success: false,
        error: 'At least one admin must remain in the system. Promote another user to admin first.'
      });
    }
  }

  user.role = role;
  await user.save();

  // Return user without sensitive fields
  const updatedUser = user.toObject();
  delete updatedUser.password;
  delete updatedUser.refreshToken;

  return res.status(200).json({
    success: true,
    data: updatedUser
  });
}
