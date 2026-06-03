import { Router } from 'express';
import { getMe, updateMe, getMyFavourites, changeRole, uploadAvatar as uploadAvatarHandler, searchUsers } from '../controllers/userController.js';
import { listMyUploadRequests } from '../controllers/uploadGrantController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { roleMiddleware } from '../middleware/roleMiddleware.js';
import { uploadAvatar as uploadAvatarMiddleware } from '../middleware/uploadMiddleware.js';

const router = Router();

// Apply authMiddleware to all user routes
router.use(authMiddleware);

// GET /api/users/me — Get current user profile
router.get('/me', getMe);

// PUT /api/users/me — Update current user profile (name, avatar)
router.put('/me', updateMe);

// GET /api/users/me/favourites — Get current user's favourited media
router.get('/me/favourites', getMyFavourites);

// GET /api/users/me/upload-requests — current user's upload-access requests
router.get('/me/upload-requests', listMyUploadRequests);

// POST /api/users/me/avatar — Upload a new avatar image
router.post('/me/avatar', ...uploadAvatarMiddleware, uploadAvatarHandler);

// GET /api/users/search?q=query — Search users by name/email (for tagging)
router.get('/search', searchUsers);

// PUT /api/users/:id/role — Change a user's role (admin only)
router.put('/:id/role', roleMiddleware('admin'), changeRole);

export default router;
