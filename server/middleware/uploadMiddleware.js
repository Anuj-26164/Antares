/**
 * Upload middleware using multer + multer-s3 for streaming files to Cloudflare R2.
 * Exports uploadSingle (1 file) and uploadBulk (up to 50 files).
 */

import crypto from 'crypto';
import path from 'path';
import multer from 'multer';
import multerS3 from 'multer-s3';
import fileType from 'file-type';
import r2Client, { R2_BUCKET_NAME } from '../config/r2.js';

// Supported MIME types grouped by category
const IMAGE_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

const VIDEO_MIMES = [
  'video/mp4',
  'video/quicktime', // .mov
  'video/webm',
];

const ALLOWED_MIMES = [...IMAGE_MIMES, ...VIDEO_MIMES];

// Size limits in bytes
const IMAGE_SIZE_LIMIT = 25 * 1024 * 1024;   // 25 MB
const VIDEO_SIZE_LIMIT = 500 * 1024 * 1024;   // 500 MB

/**
 * Validates a buffer's actual content type against the allowed MIME list using
 * magic bytes. Returns the detected MIME string, or null if unrecognised.
 *
 * Used for avatar uploads (memory storage) where the full buffer is available.
 * For streaming uploads (multer-s3) the check is performed in the controller
 * after the first chunk is downloaded from R2.
 *
 * @param {Buffer} buffer - File buffer to inspect
 * @returns {string|null} Detected MIME type or null
 */
export function detectMimeFromBuffer(buffer) {
  if (!buffer || buffer.length < 12) return null;
  const result = fileType(buffer);
  return result ? result.mime : null;
}

/**
 * Returns true if the detected MIME type is in the allowed list.
 * @param {string|null} detectedMime
 * @returns {boolean}
 */
export function isAllowedMime(detectedMime) {
  return detectedMime !== null && ALLOWED_MIMES.includes(detectedMime);
}

/**
 * Returns true if the detected MIME type is an allowed image type.
 * @param {string|null} detectedMime
 * @returns {boolean}
 */
export function isAllowedImageMime(detectedMime) {
  return detectedMime !== null && IMAGE_MIMES.includes(detectedMime);
}

/**
 * File filter — accepts only supported image and video MIME types.
 * Rejects unsupported formats with a 400-style error.
 * NOTE: This checks the client-declared MIME type as a first gate.
 * Magic byte validation is performed downstream (avatar: in middleware,
 * bulk/single: in the controller after the R2 download).
 */
function fileFilter(req, file, cb) {
  if (ALLOWED_MIMES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new Error(
      `Unsupported file format: ${file.mimetype}. Supported formats: JPEG, PNG, WebP, GIF, MP4, MOV, WebM.`
    );
    error.statusCode = 400;
    cb(error, false);
  }
}

/**
 * multer-s3 storage configuration.
 * Streams files directly to R2 with a UUID-based key preserving the original extension.
 */
const storage = multerS3({
  s3: r2Client,
  bucket: R2_BUCKET_NAME,
  contentType: multerS3.AUTO_CONTENT_TYPE,
  key(req, file, cb) {
    const ext = path.extname(file.originalname);
    const uniqueName = `${crypto.randomUUID()}${ext}`;
    cb(null, uniqueName);
  },
});

/**
 * Custom size limit enforcement.
 * multer's built-in `limits.fileSize` applies a single limit to all files,
 * but we need different limits for images vs videos. We use the max (500 MB)
 * as the multer limit and validate per-file in a custom middleware.
 */
const multerInstance = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: VIDEO_SIZE_LIMIT, // max possible size (videos)
  },
});

/**
 * Middleware that checks per-file size limits after multer processes the upload.
 * Images must be <= 25 MB, videos must be <= 500 MB.
 * This runs BEFORE the controller to reject oversized files with a 400.
 */
function validateFileSize(req, res, next) {
  const files = req.files || (req.file ? [req.file] : []);

  for (const file of files) {
    const isImage = IMAGE_MIMES.includes(file.mimetype);
    const limit = isImage ? IMAGE_SIZE_LIMIT : VIDEO_SIZE_LIMIT;

    if (file.size > limit) {
      const limitMB = limit / (1024 * 1024);
      const error = new Error(
        `File "${file.originalname}" exceeds the ${limitMB} MB size limit for ${isImage ? 'images' : 'videos'}.`
      );
      error.statusCode = 400;
      return next(error);
    }
  }

  next();
}

/**
 * Upload a single file.
 * Usage: router.post('/upload', uploadSingle, controller)
 */
export const uploadSingle = [
  multerInstance.single('file'),
  validateFileSize,
];

/**
 * Upload up to 50 files in a single request.
 * Usage: router.post('/upload', uploadBulk, controller)
 */
export const uploadBulk = [
  multerInstance.array('files', 50),
  validateFileSize,
];

// --- Avatar Upload Middleware (memory storage for Sharp processing) ---

const AVATAR_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const AVATAR_SIZE_LIMIT = 5 * 1024 * 1024; // 5 MB

/**
 * File filter for avatar uploads — accepts only image MIME types.
 */
function avatarFileFilter(req, file, cb) {
  if (AVATAR_MIMES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new Error(
      'Only image files (JPEG, PNG, WebP, GIF) are allowed.'
    );
    error.code = 'INVALID_FILE_TYPE';
    cb(error, false);
  }
}

/**
 * Multer instance for avatar uploads using memory storage.
 * Files are kept in memory as buffers for Sharp processing before R2 upload.
 */
const avatarMulter = multer({
  storage: multer.memoryStorage(),
  fileFilter: avatarFileFilter,
  limits: {
    fileSize: AVATAR_SIZE_LIMIT,
  },
});

/**
 * Error-handling wrapper for the avatar multer middleware.
 * Catches multer errors (file too large, invalid type) and returns 400 JSON responses.
 */
function handleAvatarMulterError(err, req, res, next) {
  if (err) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File size must not exceed 5 MB.',
      });
    }
    if (err.code === 'INVALID_FILE_TYPE' || err.code === 'INVALID_MAGIC_BYTES') {
      return res.status(400).json({
        success: false,
        error: err.message,
      });
    }
    // For any other multer error, return 400 with the message
    return res.status(400).json({
      success: false,
      error: err.message || 'File upload failed.',
    });
  }
  next();
}

/**
 * Magic byte validation middleware for avatar uploads.
 * Runs after multer has buffered the file into memory.
 * Rejects files whose actual content does not match an allowed image type,
 * regardless of the client-declared MIME type.
 */
function validateAvatarMagicBytes(req, res, next) {
  if (!req.file) return next();

  const detectedMime = detectMimeFromBuffer(req.file.buffer);

  if (!detectedMime || !AVATAR_MIMES.includes(detectedMime)) {
    const err = new Error(
      `File content does not match an allowed image type. Detected: ${detectedMime || 'unknown'}.`
    );
    err.code = 'INVALID_MAGIC_BYTES';
    return handleAvatarMulterError(err, req, res, next);
  }

  next();
}

/**
 * Upload a single avatar image (field name: "avatar").
 * Uses memory storage so the buffer is available at req.file.buffer for Sharp processing.
 * Validates magic bytes after multer to reject disguised files.
 * Usage: router.post('/me/avatar', uploadAvatar, controller)
 */
export const uploadAvatar = [
  (req, res, next) => {
    avatarMulter.single('avatar')(req, res, (err) => {
      if (err) {
        return handleAvatarMulterError(err, req, res, next);
      }
      next();
    });
  },
  validateAvatarMagicBytes,
];
