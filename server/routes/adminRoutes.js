import { Router } from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import { roleMiddleware } from '../middleware/roleMiddleware.js';
import createRateLimiter from '../middleware/rateLimiter.js';
import {
  getAnalytics,
  getUsers,
  updateUserRole,
  toggleBlockUser,
  getNotifications,
  markNotificationRead,
  getUnreadCount,
  getSettings,
  updateSettings,
} from '../controllers/adminController.js';

const router = Router();

// All admin routes require authentication + admin role + rate limiting
router.use(authMiddleware);
router.use(roleMiddleware('admin'));
router.use(createRateLimiter());

router.get('/analytics', getAnalytics);
router.get('/users', getUsers);
router.patch('/users/:id/role', updateUserRole);
router.patch('/users/:id/block', toggleBlockUser);
router.get('/notifications', getNotifications);
router.patch('/notifications/:id/read', markNotificationRead);
router.get('/notifications/unread-count', getUnreadCount);
router.get('/settings', getSettings);
router.put('/settings', updateSettings);

export default router;
