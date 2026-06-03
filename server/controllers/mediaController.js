/**
 * Media controller — upload and interaction handlers.
 * Handles media upload with image compression and Media record creation,
 * as well as favouriting, commenting, listing comments, and deletion.
 */

import mongoose from 'mongoose';
import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import r2Client, { R2_BUCKET_NAME } from '../config/r2.js';
import config from '../config/env.js';
import { compressImage, compressAvatar, applyWatermark, applyVideoWatermark, extractVideoThumbnail } from '../utils/imageProcessor.js';
import sharp from 'sharp';
import Media from '../models/Media.js';
import Comment from '../models/Comment.js';
import Event from '../models/Event.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { canUserUploadToEvent } from './uploadGrantController.js';
import { emitMediaUploaded, emitGalleryUpdated, emitPhotoLikedToEvent, emitNewCommentToEvent, emitMediaTagsUpdated, emitMediaCaptionUpdated } from '../sockets/mediaSocket.js';
import { notifyUser, emitPhotoLikedToOwner, emitNewCommentToUser, emitUserTagged } from '../sockets/notificationSocket.js';
import { upsertAggregatedNotification } from '../utils/notificationAggregator.js';
import { generateImageTags } from '../utils/imageTagger.js';
import { generateImageCaption } from '../utils/imageCaptioner.js';
import { emitActivityUpdate } from '../sockets/activitySocket.js';
import { detectMimeFromBuffer, isAllowedMime } from '../middleware/uploadMiddleware.js';

const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/**
 * Download an object from R2 by key and return its contents as a Buffer.
 * @param {string} key - The R2 object key
 * @returns {Promise<Buffer>}
 */
async function downloadFromR2(key) {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });
  const response = await r2Client.send(command);
  // Convert the readable stream to a Buffer
  const chunks = [];
  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Upload a buffer to R2 with the given key and content type.
 * @param {string} key - The R2 object key
 * @param {Buffer} body - The file contents
 * @param {string} contentType - The MIME type
 * @returns {Promise<void>}
 */
async function uploadToR2(key, body, contentType) {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: contentType,
  });
  await r2Client.send(command);
}

/**
 * Delete an object from R2 by key.
 * @param {string} key - The R2 object key
 * @returns {Promise<void>}
 */
async function deleteFromR2(key) {
  const command = new DeleteObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });
  await r2Client.send(command);
}

/**
 * Run smart-tagging and (optionally) AI captioning for a freshly uploaded
 * image without blocking the upload response. Both operations are
 * best-effort — failures are logged and swallowed so they never affect
 * upload success.
 *
 * Tagging always runs. Captioning only runs when `needsCaption` is true
 * (i.e. the uploader left the caption field blank).
 *
 * @param {string} mediaId
 * @param {string} eventId
 * @param {Buffer} originalBuffer
 * @param {{ title?: string, category?: string, date?: string|Date }} [eventCtx]
 * @param {boolean} [needsCaption=false]  Whether to also fill in an AI caption.
 */
function processImageInBackground(mediaId, eventId, originalBuffer, eventCtx, needsCaption = false) {
  // Tags + caption are independent calls; run them in parallel so the
  // user's gallery card lights up as fast as possible.
  const tagJob = generateImageTags(originalBuffer, { eventCtx })
    .then(async (tags) => {
      if (!Array.isArray(tags) || tags.length === 0) return;
      try {
        await Media.findByIdAndUpdate(mediaId, { tags });
        emitMediaTagsUpdated(eventId, { mediaId, tags });
      } catch (dbErr) {
        console.error(`[smart-tag] failed to persist tags for ${mediaId}:`, dbErr.message);
      }
    })
    .catch((err) => {
      const code = err?.code;
      if (code === 'AI_UNAVAILABLE') return;
      console.error(`[smart-tag] tagging failed for ${mediaId} (${code || 'UNKNOWN'}):`, err.message);
    });

  const captionJob = needsCaption
    ? generateImageCaption(originalBuffer, { eventCtx })
        .then(async (caption) => {
          if (!caption) return;
          try {
            await Media.findByIdAndUpdate(mediaId, { caption });
            emitMediaCaptionUpdated(eventId, { mediaId, caption });
          } catch (dbErr) {
            console.error(`[ai-caption] failed to persist caption for ${mediaId}:`, dbErr.message);
          }
        })
        .catch((err) => {
          const code = err?.code;
          if (code === 'AI_UNAVAILABLE') return;
          console.error(`[ai-caption] caption failed for ${mediaId} (${code || 'UNKNOWN'}):`, err.message);
        })
    : Promise.resolve();

  // Fire-and-forget — caller does not await.
  Promise.allSettled([tagJob, captionJob]);
}

/**
 * Upload media handler.
 * After multer-s3 streams files to R2:
 * - For images: download original, compress with Sharp (WebP), re-upload compressed, delete original, create Media record
 * - For videos: create Media record with original upload info
 * Handles partial failures — processes valid files and collects rejected ones.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function uploadMedia(req, res, next) {
  try {
    const { eventId } = req.params;
    const files = req.files || (req.file ? [req.file] : []);

    // Validate eventId is present and is a valid MongoDB ObjectId
    if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({
        success: false,
        error: 'Valid eventId is required',
      });
    }

    // Verify the event exists in the database
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'Event not found',
      });
    }

    // Authorization: privileged roles always allowed; otherwise the user
    // needs an approved per-event upload grant.
    const { allowed, reason } = await canUserUploadToEvent(req.user, eventId);
    if (!allowed) {
      const errorMsg =
        reason === 'no_grant'
          ? 'You need approval from an admin to upload to this event'
          : 'Insufficient permissions';
      return res.status(403).json({ success: false, error: errorMsg });
    }

    if (files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files provided for upload.',
      });
    }

    // Optional per-file captions. Two accepted shapes:
    //   1. captions: JSON-stringified array aligned by index with `files`
    //   2. captions: array of strings (when sent via multipart with multiple
    //      same-named fields — Express + multer surface this as an array)
    // Either way, captions[i] corresponds to files[i]. Missing / empty entries
    // mean "let the AI fill it in".
    let captions = [];
    if (req.body && req.body.captions !== undefined) {
      const raw = req.body.captions;
      if (Array.isArray(raw)) {
        captions = raw;
      } else if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (trimmed.startsWith('[')) {
          try { captions = JSON.parse(trimmed); } catch { captions = [trimmed]; }
        } else {
          captions = [trimmed];
        }
      }
    }
    const captionFor = (idx) => {
      const c = captions[idx];
      return typeof c === 'string' ? c.trim().slice(0, 500) : '';
    };

    const uploaded = [];
    const rejected = [];

    for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
      const file = files[fileIndex];
      try {
        const isImage = IMAGE_MIMES.includes(file.mimetype);
        let finalKey = file.key;
        let finalUrl = `${config.R2_PUBLIC_URL}/${file.key}`;
        const mediaType = isImage ? 'photo' : 'video';

        if (isImage) {
          // Download the original uploaded file from R2
          const originalBuffer = await downloadFromR2(file.key);

          // Validate actual file content via magic bytes — reject disguised files
          const detectedMime = detectMimeFromBuffer(originalBuffer);
          if (!isAllowedMime(detectedMime)) {
            // Delete the already-uploaded original from R2 before rejecting
            await deleteFromR2(file.key).catch((err) =>
              console.error(`Failed to delete rejected file ${file.key}:`, err.message)
            );
            rejected.push({
              originalname: file.originalname,
              reason: `File content does not match an allowed type. Detected: ${detectedMime || 'unknown'}.`,
            });
            continue;
          }

          // Compress the image (resize + convert to WebP) for the gallery view.
          const compressedBuffer = await compressImage(originalBuffer);

          // Move the original from its temp upload key to a stable
          // `originals/...` key. This preserves a full-fidelity copy that the
          // download endpoint can serve. The compressed WebP becomes the
          // canonical r2Key used by the gallery and existing endpoints.
          const originalKey = file.key;
          const webpKey = originalKey.replace(/\.[^.]+$/, '.webp');
          const baseName = originalKey.split('/').pop();
          const originalArchiveKey = `originals/${baseName}`;

          // Upload the compressed version to R2
          await uploadToR2(webpKey, compressedBuffer, 'image/webp');

          // Archive the original buffer under originals/ for full-quality
          // downloads. We re-upload from the in-memory buffer rather than
          // doing a server-side copy so the operation needs only one R2
          // round trip and keeps the same content type.
          await uploadToR2(originalArchiveKey, originalBuffer, file.mimetype);

          // Delete the original from its temp upload location.
          if (originalKey !== originalArchiveKey) {
            await deleteFromR2(originalKey);
          }

          finalKey = webpKey;
          finalUrl = `${config.R2_PUBLIC_URL}/${webpKey}`;
          // Stash for the Media.create payload below.
          file._originalArchiveKey = originalArchiveKey;
          // Hand the original buffer off to the (post-create) smart-tagger.
          file._originalBufferForTagging = originalBuffer;
        }

        // For videos, extract a thumbnail at the 1-second mark
        let thumbnailUrl = null;
        let thumbnailR2Key = null;
        if (!isImage) {
          try {
            const videoBuffer = await downloadFromR2(file.key);
            const thumbBuffer = await extractVideoThumbnail(videoBuffer);
            const thumbKey = file.key.replace(/\.[^.]+$/, '-thumb.webp');
            await uploadToR2(thumbKey, thumbBuffer, 'image/webp');
            thumbnailR2Key = thumbKey;
            thumbnailUrl = `${config.R2_PUBLIC_URL}/${thumbKey}`;
          } catch (thumbErr) {
            // Thumbnail generation is non-critical — log and continue
            console.error('Video thumbnail extraction failed:', thumbErr.message);
          }
        }

        // Create the Media record in MongoDB
        const userCaption = captionFor(fileIndex);
        const media = await Media.create({
          eventId,
          uploadedBy: req.user._id,
          url: finalUrl,
          r2Key: finalKey,
          type: mediaType,
          isPublic: event.isPublic,
          ...(userCaption && { caption: userCaption }),
          ...(file._originalArchiveKey && { originalR2Key: file._originalArchiveKey }),
          ...(thumbnailUrl && { thumbnailUrl }),
          ...(thumbnailR2Key && { thumbnailR2Key }),
        });

        // Best-effort smart tagging + AI captioning for images (non-blocking).
        // Uses the in-memory original buffer so we avoid an extra R2 round-trip.
        // AI caption only fills in when the uploader left the field blank.
        if (isImage && file._originalBufferForTagging) {
          processImageInBackground(
            media._id.toString(),
            eventId,
            file._originalBufferForTagging,
            { title: event.title, category: event.category, date: event.date },
            !userCaption,
          );
        }

        uploaded.push(media);
      } catch (fileError) {
        // Collect the rejection info for this file
        rejected.push({
          originalname: file.originalname,
          reason: fileError.message || 'Processing failed',
        });
      }
    }

    // --- Socket emits (fire-and-forget, non-blocking) ---
    // Emit media-uploaded for each successfully uploaded item
    for (const media of uploaded) {
      emitMediaUploaded(eventId, media);
    }

    // Emit gallery-updated summary after the batch
    if (uploaded.length > 0) {
      emitGalleryUpdated(eventId, {
        addedCount: uploaded.length,
        latestId: uploaded[uploaded.length - 1]._id,
      });

      // Emit activity-update for the upload activity
      emitActivityUpdate(eventId, {
        _id: `media_upload:${uploaded[0]._id}`,
        type: 'media_upload',
        eventId,
        actor: {
          _id: req.user._id,
          name: req.user.name,
          avatar: req.user.avatar || undefined,
        },
        target: { mediaId: uploaded[0]._id.toString() },
        message: `${req.user.name} uploaded ${uploaded.length} ${uploaded.length === 1 ? 'item' : 'items'}`,
        createdAt: new Date().toISOString(),
      });
    }

    return res.status(201).json({
      success: true,
      data: { uploaded, rejected },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * List media with pagination, sorting, and filtering.
 * Returns public media for all users; includes private media for admin/photographer/club_member.
 *
 * Query params:
 * - page (default 1)
 * - limit (default 20)
 * - sortBy: 'uploadDate' | 'eventDate' | 'likes' (default 'uploadDate')
 * - sortOrder: 'asc' | 'desc' (default 'desc')
 * - eventId: filter by event
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function listMedia(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const sortBy = req.query.sortBy || 'uploadDate';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const eventIdFilter = req.query.eventId;

    const userRole = req.user?.role;
    const canViewPrivate = ['admin', 'photographer', 'club_member'].includes(userRole);

    // Build filter
    const filter = {};
    if (!canViewPrivate) {
      filter.isPublic = true;
    }
    if (eventIdFilter) {
      filter.eventId = eventIdFilter;
    } else if (canViewPrivate) {
      // In the gallery (no eventId filter), authorized users see all media
      // but we still exclude media from private events for the gallery view
      // unless they explicitly filter by event
      // Actually, authorized users should see private event media too — they have access
    }

    // Build sort
    let sort = {};
    let useLikesAggregation = false;
    if (sortBy === 'likes') {
      // Sort by favouritedBy array length (the actual like count)
      useLikesAggregation = true;
    } else if (sortBy === 'eventDate') {
      sort = { _eventDate: sortOrder };
    } else {
      // Default: uploadDate (createdAt)
      sort = { createdAt: sortOrder };
    }

    const skip = (page - 1) * limit;

    let data;
    let total;

    if (sortBy === 'eventDate') {
      // Use aggregation to sort by event date
      const matchStage = { $match: filter };
      const lookupStage = {
        $lookup: {
          from: 'events',
          localField: 'eventId',
          foreignField: '_id',
          as: '_event',
        },
      };
      const unwindStage = { $unwind: { path: '$_event', preserveNullAndEmptyArrays: true } };
      const addFieldsStage = {
        $addFields: { _eventDate: { $ifNull: ['$_event.date', '$createdAt'] } },
      };
      const sortStage = { $sort: { _eventDate: sortOrder } };
      const projectStage = { $project: { _event: 0, _eventDate: 0 } };

      const countResult = await Media.aggregate([matchStage, { $count: 'total' }]);
      total = countResult.length > 0 ? countResult[0].total : 0;

      data = await Media.aggregate([
        matchStage,
        lookupStage,
        unwindStage,
        addFieldsStage,
        sortStage,
        { $skip: skip },
        { $limit: limit },
        projectStage,
      ]);
    } else if (useLikesAggregation) {
      // Sort by favouritedBy array length
      const matchStage = { $match: filter };
      const addFieldsStage = {
        $addFields: { _likeCount: { $size: { $ifNull: ['$favouritedBy', []] } } },
      };
      const sortStage = { $sort: { _likeCount: sortOrder } };
      const projectStage = { $project: { _likeCount: 0 } };

      const countResult = await Media.aggregate([matchStage, { $count: 'total' }]);
      total = countResult.length > 0 ? countResult[0].total : 0;

      data = await Media.aggregate([
        matchStage,
        addFieldsStage,
        sortStage,
        { $skip: skip },
        { $limit: limit },
        projectStage,
      ]);
    } else {
      total = await Media.countDocuments(filter);
      data = await Media.find(filter)
        .populate('eventId', 'title date')
        .populate('uploadedBy', 'name avatar')
        .sort(sort)
        .skip(skip)
        .limit(limit);
    }

    // Add isFavourited field for the current user
    const userId = req.user?._id?.toString();
    const items = data.map((item) => {
      const obj = item.toObject ? item.toObject() : item;
      return {
        ...obj,
        isFavourited: userId
          ? (obj.favouritedBy || []).some((id) => id.toString() === userId)
          : false,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        items,
        page,
        limit,
        total,
        hasMore: skip + data.length < total,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get a single media item by ID.
 * For public media, returns the public URL.
 * For private media, checks role (admin/photographer/club_member) and returns a signed URL (15-min expiry).
 * Returns 404 if not found, 403 if viewer tries to access private media.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function getMedia(req, res, next) {
  try {
    const { id } = req.params;

    const media = await Media.findById(id);
    if (!media) {
      return res.status(404).json({
        success: false,
        error: 'Media not found.',
      });
    }

    // If media is private, check role
    if (!media.isPublic) {
      const userRole = req.user.role;
      const canAccess = ['admin', 'photographer', 'club_member'].includes(userRole);
      if (!canAccess) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions.',
        });
      }

      // Generate signed URL for private media
      const command = new GetObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: media.r2Key,
      });
      const signedUrl = await getSignedUrl(r2Client, command, { expiresIn: 900 });

      return res.status(200).json({
        success: true,
        data: { ...media.toObject(), accessUrl: signedUrl },
      });
    }

    // Public media — return with public URL
    return res.status(200).json({
      success: true,
      data: { ...media.toObject(), accessUrl: media.url },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Download media with dynamic watermark.
 * - Fetches media + associated event from DB
 * - Downloads original from R2 (original is NEVER modified)
 * - Applies diagonal repeated watermark with: club name, event name, username, role, timestamp
 * - Watermark opacity is role-based (admin = subtle, viewer = prominent)
 * - Returns watermarked WebP as a file download
 * - Videos: streams original with Content-Disposition (FFmpeg watermarking is optional/future)
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
/**
 * Serve media for in-browser viewing.
 * Streams the file from R2 directly — never exposes the R2 URL to the client.
 * Public media is accessible without authentication.
 * Private media requires authentication and an authorized role.
 */
export async function serveMedia(req, res, next) {
  try {
    const { id } = req.params;
    const media = await Media.findById(id);
    if (!media) return res.status(404).json({ success: false, error: 'Media not found.' });

    if (!media.isPublic) {
      // Private media: require authentication first
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Authentication required.' });
      }
      const canAccess = ['admin', 'photographer', 'club_member'].includes(req.user.role);
      if (!canAccess) return res.status(403).json({ success: false, error: 'Insufficient permissions.' });
    }

    const command = new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: media.r2Key });
    const r2Response = await r2Client.send(command);

    const mimeMap = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
      webp: 'image/webp', gif: 'image/gif',
      mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
    };
    const ext = media.r2Key.split('.').pop()?.toLowerCase() || 'jpg';
    const contentType = mimeMap[ext] || 'application/octet-stream';

    res.set({
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    });

    r2Response.Body.pipe(res);
  } catch (error) {
    next(error);
  }
}

/**
 * Serve video thumbnail.
 * If the video already has a cached thumbnail in R2, serve it directly.
 * Otherwise, generate one on-the-fly from the video (frame at 1s), cache to R2, and serve.
 * For non-video media, redirects to the serve endpoint.
 */
export async function serveThumbnail(req, res, next) {
  try {
    const { id } = req.params;
    const media = await Media.findById(id);
    if (!media) return res.status(404).json({ success: false, error: 'Media not found.' });

    // Private media: require authentication and an authorized role
    if (!media.isPublic) {
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Authentication required.' });
      }
      const canAccess = ['admin', 'photographer', 'club_member'].includes(req.user.role);
      if (!canAccess) return res.status(403).json({ success: false, error: 'Insufficient permissions.' });
    }

    // For photos, just serve the image directly
    if (media.type !== 'video') {
      return res.redirect(`/api/media/${id}/serve`);
    }

    // If thumbnail already exists, serve it from R2
    if (media.thumbnailR2Key) {
      try {
        const command = new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: media.thumbnailR2Key });
        const r2Response = await r2Client.send(command);
        res.set({
          'Content-Type': 'image/webp',
          'Cache-Control': 'public, max-age=86400',
          'X-Content-Type-Options': 'nosniff',
        });
        return r2Response.Body.pipe(res);
      } catch {
        // Thumbnail key exists in DB but not in R2 — regenerate below
      }
    }

    // Generate thumbnail on-the-fly
    let videoBuffer;
    try {
      videoBuffer = await downloadFromR2(media.r2Key);
    } catch {
      return res.status(503).json({ success: false, error: 'Could not fetch video.' });
    }

    let thumbBuffer;
    try {
      thumbBuffer = await extractVideoThumbnail(videoBuffer);
    } catch (err) {
      console.error('Thumbnail generation failed for media', id, ':', err.message);
      return res.status(500).json({ success: false, error: 'Thumbnail generation failed.' });
    }

    // Cache the thumbnail to R2 for future requests
    const thumbKey = media.r2Key.replace(/\.[^.]+$/, '-thumb.webp');
    try {
      await uploadToR2(thumbKey, thumbBuffer, 'image/webp');
      // Update the media record with the thumbnail info
      media.thumbnailR2Key = thumbKey;
      media.thumbnailUrl = `${config.R2_PUBLIC_URL}/${thumbKey}`;
      await media.save();
    } catch {
      // Caching failed — still serve the generated thumbnail
    }

    res.set({
      'Content-Type': 'image/webp',
      'Cache-Control': 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
    });
    return res.status(200).send(thumbBuffer);
  } catch (error) {
    next(error);
  }
}

export async function downloadMedia(req, res, next) {
  try {
    const { id } = req.params;

    // Fetch media and populate event details
    const media = await Media.findById(id).populate('eventId', 'title category');
    if (!media) {
      return res.status(404).json({ success: false, error: 'Media not found.' });
    }

    const isVideo = media.type === 'video';

    // For images, prefer the archived original (full quality) when available.
    // Falls back to the compressed gallery copy for legacy records.
    const sourceKey = !isVideo && media.originalR2Key ? media.originalR2Key : media.r2Key;

    let fileBuffer;
    try {
      fileBuffer = await downloadFromR2(sourceKey);
    } catch {
      return res.status(503).json({ success: false, error: 'Service temporarily unavailable. Please try again later.' });
    }

    const sourceExt = sourceKey.split('.').pop()?.toLowerCase() || (isVideo ? 'mp4' : 'jpg');
    const safeTitle = (media.eventId?.title || 'media').replace(/[^a-z0-9]/gi, '_');

    // Admin can skip watermark via ?watermark=false — serve the source as-is.
    const skipWatermark = req.user.role === 'admin' && req.query.watermark === 'false';

    if (skipWatermark) {
      // Re-encode images to JPEG so the user always gets a universally
      // compatible file (gallery is WebP, originals may be PNG/HEIC/etc.).
      let outputBuffer = fileBuffer;
      let outputExt = sourceExt;
      let outputContentType;

      if (isVideo) {
        outputExt = 'mp4';
        outputContentType = 'video/mp4';
      } else {
        try {
          outputBuffer = await sharp(fileBuffer)
            .flatten({ background: { r: 255, g: 255, b: 255 } })
            .jpeg({ quality: 95, mozjpeg: true, chromaSubsampling: '4:4:4' })
            .toBuffer();
        } catch (sharpErr) {
          console.error('JPEG re-encode failed:', sharpErr.message);
          return res.status(500).json({ success: false, error: 'Image processing failed.' });
        }
        outputExt = 'jpg';
        outputContentType = 'image/jpeg';
      }

      const filename = `${safeTitle}_${id}.${outputExt}`;
      res.set({
        'Content-Type': outputContentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': outputBuffer.length,
      });
      return res.status(200).send(outputBuffer);
    }

    if (isVideo) {
      let watermarkedVideo;
      try {
        watermarkedVideo = await applyVideoWatermark(fileBuffer, {
          clubName:  'Antares',
          eventName: media.eventId?.title || 'Event',
          userName:  req.user.name || req.user.email || 'User',
          userRole:  req.user.role || 'viewer',
          timestamp: new Date().toISOString().split('T')[0],
        });
      } catch (ffmpegErr) {
        console.error('FFmpeg watermark failed:', ffmpegErr.message);
        return res.status(500).json({ success: false, error: 'Video watermarking failed. Please try again.' });
      }
      // applyVideoWatermark always outputs MP4 (libx264 + faststart).
      const filename = `${safeTitle}_${id}.mp4`;
      res.set({
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': watermarkedVideo.length,
      });
      return res.status(200).send(watermarkedVideo);
    }

    // Image watermark — applyWatermark always returns JPEG.
    let result;
    try {
      result = await applyWatermark(fileBuffer, {
        clubName:  'Antares',
        eventName: media.eventId?.title || 'Event',
        userName:  req.user.name || req.user.email || 'User',
        userRole:  req.user.role || 'viewer',
        timestamp: new Date().toISOString().split('T')[0],
      });
    } catch (sharpErr) {
      console.error('Image watermark failed:', sharpErr.message);
      return res.status(500).json({ success: false, error: 'Image watermarking failed. Please try again.' });
    }

    const filename = `${safeTitle}_${id}.${result.ext}`;
    res.set({
      'Content-Type': result.contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': result.buffer.length,
    });
    return res.status(200).send(result.buffer);
  } catch (error) {
    next(error);
  }
}

/**
 * Toggle favourite on a media item.
 * Adds or removes req.user._id from media.favouritedBy array.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function toggleFavourite(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const media = await Media.findById(id);
    if (!media) {
      return res.status(404).json({
        success: false,
        error: 'Media not found.',
      });
    }

    const index = media.favouritedBy.findIndex(
      (uid) => uid.toString() === userId.toString()
    );

    let favourited;
    if (index === -1) {
      media.favouritedBy.push(userId);
      favourited = true;
    } else {
      media.favouritedBy.splice(index, 1);
      favourited = false;
    }

    await media.save();

    // --- Socket emits (fire-and-forget) ---
    const eventId = String(media.eventId);
    const ownerId = String(media.uploadedBy);
    const actorId = String(userId);
    const count = media.favouritedBy.length;

    // Emit photo-liked to the event room (always)
    emitPhotoLikedToEvent(eventId, {
      mediaId: id,
      eventId,
      count,
      by: { _id: actorId, name: req.user.name },
      liked: favourited,
    });

    // If favourited and actor is not the owner, create/merge notification and emit to owner
    if (favourited && actorId !== ownerId) {
      try {
        const notif = await upsertAggregatedNotification({
          type: 'like',
          recipient: ownerId,
          actor: { _id: req.user._id, name: req.user.name },
          relatedMedia: id,
        });
        notifyUser(ownerId, notif, actorId);
        emitPhotoLikedToOwner(ownerId, { mediaId: id, count, by: { _id: actorId, name: req.user.name } }, actorId);
      } catch (notifErr) {
        // Notification creation is non-critical — log and continue
        console.error('Like notification failed:', notifErr.message);
      }
    }

    // Emit activity update for the like/unlike action
    emitActivityUpdate(eventId, {
      _id: `like:${id}:${actorId}:${Date.now()}`,
      type: 'like',
      eventId,
      actor: { _id: actorId, name: req.user.name, avatar: req.user.avatar || undefined },
      target: { mediaId: id },
      message: favourited
        ? `${req.user.name} liked a photo`
        : `${req.user.name} unliked a photo`,
      createdAt: new Date().toISOString(),
    });

    return res.status(200).json({
      success: true,
      data: { favourited, favouriteCount: media.favouritedBy.length },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Add a comment to a media item.
 * Validates text length (1–1000 chars), creates Comment, pushes to media.comments.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function addComment(req, res, next) {
  try {
    const { id } = req.params;
    const { text } = req.body;

    // Validate text
    if (!text || typeof text !== 'string' || text.trim().length === 0 || text.length > 1000) {
      return res.status(400).json({
        success: false,
        error: 'Comment text must be between 1 and 1000 characters.',
      });
    }

    const media = await Media.findById(id);
    if (!media) {
      return res.status(404).json({
        success: false,
        error: 'Media not found.',
      });
    }

    const comment = await Comment.create({
      mediaId: id,
      userId: req.user._id,
      text: text.trim(),
    });

    media.comments.push(comment._id);
    await media.save();

    // --- Socket emits (fire-and-forget) ---
    const actorId = String(req.user._id);
    const eventId = String(media.eventId);

    // Populate comment user data and build CommentSocketPayload
    const populated = await comment.populate('userId', 'name avatar');
    const commentPayload = {
      _id: String(populated._id),
      mediaId: id,
      eventId,
      text: populated.text,
      createdAt: populated.createdAt,
      user: {
        _id: String(populated.userId._id),
        name: populated.userId.name,
        avatar: populated.userId.avatar ?? null,
      },
    };

    // Emit new-comment to the event room
    emitNewCommentToEvent(eventId, commentPayload);

    // Notify only the media owner — skip if the actor IS the owner
    try {
      const ownerId = String(media.uploadedBy);
      if (ownerId !== actorId) {
        const notif = await upsertAggregatedNotification({
          type: 'comment',
          recipient: ownerId,
          actor: { _id: req.user._id, name: req.user.name },
          relatedMedia: id,
        });
        notifyUser(ownerId, notif, actorId);
        emitNewCommentToUser(ownerId, commentPayload, actorId);
      }
    } catch (notifErr) {
      // Notification creation is non-critical — log and continue
      console.error('Comment notification failed:', notifErr.message);
    }

    // Emit activity update for the comment action
    emitActivityUpdate(eventId, {
      _id: `comment:${id}:${actorId}:${Date.now()}`,
      type: 'comment',
      eventId,
      actor: { _id: actorId, name: req.user.name, avatar: req.user.avatar || undefined },
      target: { mediaId: id, commentId: String(comment._id) },
      message: `${req.user.name} commented on a photo`,
      createdAt: new Date().toISOString(),
    });

    return res.status(201).json({
      success: true,
      data: comment,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * List comments for a media item, populated with user name and avatar.
 * Public media: accessible without authentication.
 * Private media: requires authentication and admin/photographer/club_member role.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function listComments(req, res, next) {
  try {
    const { id } = req.params;

    // Fetch the media to check its visibility
    const media = await Media.findById(id).select('isPublic');
    if (!media) {
      return res.status(404).json({
        success: false,
        error: 'Media not found.',
      });
    }

    // Private media: require authentication and an authorized role
    if (!media.isPublic) {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required.',
        });
      }
      const canAccess = ['admin', 'photographer', 'club_member'].includes(req.user.role);
      if (!canAccess) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions.',
        });
      }
    }

    const comments = await Comment.find({ mediaId: id })
      .populate('userId', 'name avatar')
      .sort({ createdAt: 1 });

    return res.status(200).json({
      success: true,
      data: comments,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Tag users in a media item.
 * Accepts { userIds: string[] } in the request body.
 * For each tagged user (excluding the actor), creates a Notification with type 'tag'
 * and emits socket events via notifyUser and emitUserTagged.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function tagUsers(req, res, next) {
  try {
    const { id } = req.params;
    const { userIds } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'userIds must be a non-empty array.',
      });
    }

    const media = await Media.findById(id);
    if (!media) {
      return res.status(404).json({
        success: false,
        error: 'Media not found.',
      });
    }

    const actorId = String(req.user._id);
    const eventId = String(media.eventId);

    // Deduplicate and exclude self
    const uniqueUserIds = [...new Set(userIds)].filter((uid) => String(uid) !== actorId);

    if (uniqueUserIds.length === 0) {
      return res.status(200).json({ success: true, data: { tagged: [] } });
    }

    // Fetch tagged users' names for the comment text
    const taggedUsers = await User.find({ _id: { $in: uniqueUserIds } }).select('_id name').lean();
    const taggedMap = Object.fromEntries(taggedUsers.map((u) => [String(u._id), u.name]));

    const tagged = [];

    for (const taggedId of uniqueUserIds) {
      try {
        const notif = await upsertAggregatedNotification({
          type: 'tag',
          recipient: taggedId,
          actor: { _id: req.user._id, name: req.user.name },
          relatedMedia: id,
        });

        notifyUser(taggedId, notif, actorId);
        emitUserTagged(taggedId, { mediaId: id, eventId, by: { _id: actorId, name: req.user.name } }, actorId);

        tagged.push(taggedId);
      } catch (notifErr) {
        console.error('Tag notification failed for user', taggedId, ':', notifErr.message);
      }
    }

    // Post a single system comment listing all tagged users
    if (tagged.length > 0) {
      try {
        const names = tagged.map((uid) => taggedMap[String(uid)] || 'someone');
        const nameList = names.length === 1
          ? names[0]
          : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
        const commentText = `${req.user.name} tagged ${nameList} in this photo.`;

        const tagComment = await Comment.create({
          mediaId: id,
          userId: req.user._id,
          text: commentText,
        });

        media.comments.push(tagComment._id);
        await media.save();

        // Emit the comment to the event room so it appears live
        const populated = await tagComment.populate('userId', 'name avatar');
        const commentPayload = {
          _id: String(populated._id),
          mediaId: id,
          eventId,
          text: populated.text,
          createdAt: populated.createdAt,
          user: {
            _id: String(populated.userId._id),
            name: populated.userId.name,
            avatar: populated.userId.avatar ?? null,
          },
        };
        emitNewCommentToEvent(eventId, commentPayload);
      } catch (commentErr) {
        console.error('Tag comment creation failed:', commentErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      data: { tagged },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update media metadata (admin only).
 * Currently supports: isPublic
 * PATCH /api/media/:id
 */
export async function updateMedia(req, res, next) {
  try {
    const { id } = req.params;
    const { isPublic } = req.body;

    const media = await Media.findById(id);
    if (!media) {
      return res.status(404).json({ success: false, error: 'Media not found.' });
    }

    if (isPublic !== undefined) {
      media.isPublic = Boolean(isPublic);
    }

    await media.save();

    return res.status(200).json({ success: true, data: media });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a media item.
 * Verifies requester is admin or the uploader.
 * Deletes associated Comment records, R2 object, and Media record.
 * If R2 deletion fails, retains the record and returns 500.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function deleteMedia(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;

    const media = await Media.findById(id);
    if (!media) {
      return res.status(404).json({
        success: false,
        error: 'Media not found.',
      });
    }

    // Verify requester is admin or the uploader
    const isAdmin = userRole === 'admin';
    const isUploader = media.uploadedBy.toString() === userId.toString();
    if (!isAdmin && !isUploader) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions.',
      });
    }

    // Delete associated comments and notifications (non-blocking failures are logged)
    await Promise.all([
      Comment.deleteMany({ mediaId: id }),
      Notification.deleteMany({ relatedMedia: id }),
    ]);

    // Delete main R2 object — if this fails, retain the record and return 500
    try {
      await deleteFromR2(media.r2Key);
    } catch (r2Error) {
      console.error(`R2 delete failed for key ${media.r2Key}:`, r2Error.message);
      return res.status(500).json({
        success: false,
        error: 'Media deletion could not be completed due to storage failure.',
      });
    }

    // Delete video thumbnail from R2 if it exists (fire-and-forget — don't block on failure)
    if (media.thumbnailR2Key) {
      deleteFromR2(media.thumbnailR2Key).catch((err) => {
        console.error(`R2 thumbnail delete failed for key ${media.thumbnailR2Key}:`, err.message);
      });
    }

    // Delete archived original from R2 if one exists (fire-and-forget).
    if (media.originalR2Key) {
      deleteFromR2(media.originalR2Key).catch((err) => {
        console.error(`R2 original delete failed for key ${media.originalR2Key}:`, err.message);
      });
    }

    // Delete the Media record
    await Media.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      data: { message: 'Media deleted successfully.' },
    });
  } catch (error) {
    next(error);
  }
}
