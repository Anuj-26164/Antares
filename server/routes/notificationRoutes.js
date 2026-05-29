import { Router } from 'express';
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../controllers/notificationController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = Router();

// All notification routes require authentication
router.use(authMiddleware);

// GET /api/notifications — list user's notifications
router.get('/', listNotifications);

// PATCH /api/notifications/read-all — mark all as read (must come before /:id)
router.patch('/read-all', markAllNotificationsRead);

// PATCH /api/notifications/:id/read — mark single notification as read
router.patch('/:id/read', markNotificationRead);

export default router;
