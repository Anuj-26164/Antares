import { Router } from 'express';
import {
  uploadMedia,
  listMedia,
  getMedia,
  serveMedia,
  serveThumbnail,
  downloadMedia,
  deleteMedia,
  updateMedia,
  toggleFavourite,
  addComment,
  listComments,
  tagUsers
} from '../controllers/mediaController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { optionalAuth } from '../middleware/authMiddleware.js';
import { roleMiddleware } from '../middleware/roleMiddleware.js';
import { uploadBulk } from '../middleware/uploadMiddleware.js';

const router = Router();

// ── Public-accessible routes (optionalAuth attaches user if logged in) ──────

// GET /api/media/:id/serve — stream media for viewing; public media accessible without login
router.get('/:id/serve', optionalAuth, serveMedia);

// GET /api/media/:id/thumbnail — serve video thumbnail; public media accessible without login
router.get('/:id/thumbnail', optionalAuth, serveThumbnail);

// GET /api/media — list media; public media visible without login, private requires auth
router.get('/', optionalAuth, listMedia);

// GET /api/media/:id/comments — list comments; readable without login
router.get('/:id/comments', optionalAuth, listComments);

// ── Authenticated routes ─────────────────────────────────────────────────────

// POST /api/media/upload/:eventId — upload (must be before /:id routes)
router.post('/upload/:eventId', authMiddleware, roleMiddleware('admin', 'photographer', 'club_member'), uploadBulk, uploadMedia);

// GET /api/media/:id — get single media item with signed URL if private
router.get('/:id', optionalAuth, getMedia);

// GET /api/media/:id/download — download with watermark
router.get('/:id/download', authMiddleware, downloadMedia);

// DELETE /api/media/:id
router.delete('/:id', authMiddleware, deleteMedia);

// PATCH /api/media/:id — update media metadata (admin only)
router.patch('/:id', authMiddleware, roleMiddleware('admin'), updateMedia);

// POST /api/media/:id/favourite
router.post('/:id/favourite', authMiddleware, toggleFavourite);

// POST /api/media/:id/tag
router.post('/:id/tag', authMiddleware, tagUsers);

// POST /api/media/:id/comments
router.post('/:id/comments', authMiddleware, addComment);

export default router;
