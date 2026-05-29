import { Router } from 'express';
import {
  createEvent,
  listEvents,
  getEvent,
  updateEvent,
  deleteEvent,
  listPublicEvents,
  getPublicEvent,
  uploadCoverImage,
} from '../controllers/eventController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { roleMiddleware } from '../middleware/roleMiddleware.js';
import { uploadAvatar as uploadCoverMiddleware } from '../middleware/uploadMiddleware.js';
import { verifyAccessToken } from '../utils/tokenUtils.js';
import User from '../models/User.js';

const router = Router();

/**
 * Optional auth middleware — parses auth if present but doesn't reject unauthenticated requests.
 * Sets req.user if valid token found, otherwise leaves it undefined.
 */
async function optionalAuth(req, res, next) {
  try {
    const token = req.cookies?.accessToken;
    if (token) {
      const { userId } = verifyAccessToken(token);
      const user = await User.findById(userId).select('-password -refreshToken');
      if (user) req.user = user;
    }
  } catch {
    // Token invalid or expired — continue without auth
  }
  next();
}

// Public event routes (no auth required, but auth is optionally parsed for private event access)
router.get('/public', optionalAuth, listPublicEvents);
router.get('/public/:id', optionalAuth, getPublicEvent);

// All remaining event routes require authentication
router.use(authMiddleware);

// POST /api/events — admin or photographer can create
router.post('/', roleMiddleware('admin', 'photographer'), createEvent);

// GET /api/events — list events (visibility filtered in controller)
router.get('/', listEvents);

// GET /api/events/:id — get single event
router.get('/:id', getEvent);

// PUT /api/events/:id — update event
router.put('/:id', updateEvent);

// POST /api/events/:id/cover — upload cover image
router.post('/:id/cover', ...uploadCoverMiddleware, uploadCoverImage);

// DELETE /api/events/:id — delete event
router.delete('/:id', deleteEvent);

export default router;
