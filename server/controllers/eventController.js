import Event from '../models/Event.js';
import Media from '../models/Media.js';
import Comment from '../models/Comment.js';
import crypto from 'crypto';
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import r2Client, { R2_BUCKET_NAME } from '../config/r2.js';
import config from '../config/env.js';
import { compressImage } from '../utils/imageProcessor.js';

/**
 * List events with media count.
 * Public events visible to all. Private events visible to admin/photographer/club_member.
 * GET /api/events/public
 */
export async function listPublicEvents(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    // Authorized roles can see private events too
    const userRole = req.user?.role;
    const canViewPrivate = ['admin', 'photographer', 'club_member'].includes(userRole);

    const filter = canViewPrivate ? {} : { isPublic: true };

    const [events, total] = await Promise.all([
      Event.find(filter).sort({ date: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
      Event.countDocuments(filter)
    ]);

    // Attach separate photo and video counts to each event
    // For private events viewed by authorized users, count all media (not just public)
    const eventIds = events.map(e => e._id);
    const mediaMatchFilter = canViewPrivate
      ? { eventId: { $in: eventIds } }
      : { eventId: { $in: eventIds }, isPublic: true };

    const mediaCounts = await Media.aggregate([
      { $match: mediaMatchFilter },
      { $group: { _id: { eventId: '$eventId', type: '$type' }, count: { $sum: 1 } } }
    ]);

    const countMap = {};
    mediaCounts.forEach(mc => {
      const eid = mc._id.eventId.toString();
      if (!countMap[eid]) countMap[eid] = { photo: 0, video: 0 };
      if (mc._id.type === 'video') countMap[eid].video = mc.count;
      else countMap[eid].photo = mc.count;
    });

    const eventsWithCount = events.map(event => {
      const counts = countMap[event._id.toString()] || { photo: 0, video: 0 };
      return {
        ...event,
        mediaCount: counts.photo + counts.video,
        photoCount: counts.photo,
        videoCount: counts.video,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        events: eventsWithCount,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch public events'
    });
  }
}

/**
 * Get a single public event by ID with its public media (no auth required).
 * GET /api/events/public/:id
 */
export async function getPublicEvent(req, res) {
  try {
    const event = await Event.findById(req.params.id).lean();

    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'Event not found'
      });
    }

    // Private event access: only admin, photographer, club_member can view
    if (!event.isPublic) {
      const userRole = req.user?.role;
      const canAccess = ['admin', 'photographer', 'club_member'].includes(userRole);
      if (!canAccess) {
        return res.status(404).json({
          success: false,
          error: 'Event not found'
        });
      }
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    // For private events, show all media (no isPublic filter)
    // For public events, only show public media
    const mediaFilter = { eventId: event._id };
    if (event.isPublic) {
      mediaFilter.isPublic = true;
    }

    const [media, mediaTotal] = await Promise.all([
      Media.find(mediaFilter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Media.countDocuments(mediaFilter)
    ]);

    return res.status(200).json({
      success: true,
      data: {
        event,
        media,
        mediaPage: page,
        mediaLimit: limit,
        mediaTotal,
        mediaTotalPages: Math.ceil(mediaTotal / limit)
      }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch event'
    });
  }
}

/**
 * Create a new event.
 * POST /api/events
 * Requires: admin or photographer role (enforced by route middleware)
 */
export async function createEvent(req, res) {
  try {
    const { title, description, category, date, isPublic, coverImage, tags } = req.body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Title is required'
      });
    }

    const eventData = {
      title: title.trim(),
      createdBy: req.user._id
    };

    if (description !== undefined) eventData.description = description;
    if (category !== undefined) eventData.category = category;
    if (date !== undefined) eventData.date = date;
    if (isPublic !== undefined) eventData.isPublic = isPublic;
    if (coverImage !== undefined) eventData.coverImage = coverImage;
    if (tags !== undefined) eventData.tags = tags;

    const event = new Event(eventData);
    await event.save();

    return res.status(201).json({
      success: true,
      data: event
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: err.message
      });
    }
    throw err;
  }
}

/**
 * List events with visibility filtering and pagination.
 * GET /api/events
 * Returns public events + private events where user is creator or admin.
 */
export async function listEvents(req, res) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const isAdmin = req.user.role === 'admin';

  let filter;
  if (isAdmin) {
    // Admin sees all events
    filter = {};
  } else {
    // Non-admin sees public events + their own private events
    filter = {
      $or: [
        { isPublic: true },
        { createdBy: req.user._id }
      ]
    };
  }

  const [events, total] = await Promise.all([
    Event.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Event.countDocuments(filter)
  ]);

  return res.status(200).json({
    success: true,
    data: {
      events,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
}

/**
 * Get a single event by ID with visibility check.
 * GET /api/events/:id
 */
export async function getEvent(req, res) {
  const event = await Event.findById(req.params.id);

  if (!event) {
    return res.status(404).json({
      success: false,
      error: 'Event not found'
    });
  }

  const isAdmin = req.user.role === 'admin';
  const isCreator = event.createdBy.toString() === req.user._id.toString();

  // If event is private, only admin or creator can view
  if (!event.isPublic && !isAdmin && !isCreator) {
    return res.status(404).json({
      success: false,
      error: 'Event not found'
    });
  }

  return res.status(200).json({
    success: true,
    data: event
  });
}

/**
 * Update an event. Only admin or the event creator can update.
 * PUT /api/events/:id
 * Mutable fields: title, description, category, date, isPublic, coverImage, tags
 */
export async function updateEvent(req, res) {
  const event = await Event.findById(req.params.id);

  if (!event) {
    return res.status(404).json({
      success: false,
      error: 'Event not found'
    });
  }

  const isAdmin = req.user.role === 'admin';
  const isCreator = event.createdBy.toString() === req.user._id.toString();

  if (!isAdmin && !isCreator) {
    return res.status(403).json({
      success: false,
      error: 'Insufficient permissions'
    });
  }

  // Only update mutable fields
  const mutableFields = ['title', 'description', 'category', 'date', 'isPublic', 'coverImage', 'tags'];
  for (const field of mutableFields) {
    if (req.body[field] !== undefined) {
      event[field] = req.body[field];
    }
  }

  try {
    await event.save();
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: err.message
      });
    }
    throw err;
  }

  return res.status(200).json({
    success: true,
    data: event
  });
}

/**
 * Upload a cover image for an event.
 * POST /api/events/:id/cover
 * Accepts multipart file (from multer memory storage), compresses, uploads to R2.
 */
export async function uploadCoverImage(req, res) {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No file provided' });
  }

  const event = await Event.findById(req.params.id);
  if (!event) {
    return res.status(404).json({ success: false, error: 'Event not found' });
  }

  const isAdmin = req.user.role === 'admin';
  const isCreator = event.createdBy.toString() === req.user._id.toString();
  if (!isAdmin && !isCreator) {
    return res.status(403).json({ success: false, error: 'Insufficient permissions' });
  }

  // Compress image (reuse compressImage — max 2048px, WebP)
  let compressedBuffer;
  try {
    compressedBuffer = await compressImage(req.file.buffer);
  } catch {
    return res.status(500).json({ success: false, error: 'Image processing failed' });
  }

  const key = `covers/${crypto.randomUUID()}.webp`;

  try {
    await r2Client.send(new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: compressedBuffer,
      ContentType: 'image/webp',
    }));
  } catch {
    return res.status(503).json({ success: false, error: 'Storage service unavailable' });
  }

  // Delete old cover from R2 if it was R2-hosted
  if (event.coverImage && event.coverImage.startsWith(config.R2_PUBLIC_URL + '/covers/')) {
    const oldKey = event.coverImage.replace(config.R2_PUBLIC_URL + '/', '');
    r2Client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: oldKey }))
      .catch((err) => console.error(`Failed to delete old cover (${oldKey}):`, err.message));
  }

  const coverImageUrl = `${config.R2_PUBLIC_URL}/${key}`;
  event.coverImage = coverImageUrl;
  await event.save();

  return res.status(200).json({ success: true, data: { coverImageUrl } });
}
export async function deleteEvent(req, res) {
  const event = await Event.findById(req.params.id);

  if (!event) {
    return res.status(404).json({
      success: false,
      error: 'Event not found'
    });
  }

  const isAdmin = req.user.role === 'admin';
  const isCreator = event.createdBy.toString() === req.user._id.toString();

  if (!isAdmin && !isCreator) {
    return res.status(403).json({
      success: false,
      error: 'Insufficient permissions'
    });
  }

  // Find all media associated with this event
  const mediaItems = await Media.find({ eventId: event._id });

  // Delete all R2 objects for associated media
  for (const media of mediaItems) {
    try {
      await r2Client.send(new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: media.r2Key
      }));
    } catch (err) {
      // Log but continue — best effort cleanup of R2 objects during cascade
      console.error(`Failed to delete R2 object ${media.r2Key}:`, err.message);
    }
  }

  // Delete cover image from R2 if it was R2-hosted
  if (event.coverImage && event.coverImage.startsWith(config.R2_PUBLIC_URL + '/covers/')) {
    const coverKey = event.coverImage.replace(config.R2_PUBLIC_URL + '/', '');
    r2Client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: coverKey }))
      .catch((err) => console.error(`Failed to delete cover image (${coverKey}):`, err.message));
  }

  // Delete all comments associated with the media items
  const mediaIds = mediaItems.map(m => m._id);
  if (mediaIds.length > 0) {
    await Comment.deleteMany({ mediaId: { $in: mediaIds } });
  }

  // Delete all media records for this event
  await Media.deleteMany({ eventId: event._id });

  // Delete the event itself
  await Event.findByIdAndDelete(event._id);

  return res.status(200).json({
    success: true,
    data: { message: 'Event and all associated data deleted successfully' }
  });
}
