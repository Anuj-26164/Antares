/**
 * Integration tests for notification endpoints.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';

vi.mock('../../config/env.js', () => ({ validateEnv: vi.fn(() => ({})), default: { JWT_SECRET: 'test', JWT_REFRESH_SECRET: 'test-refresh', CLIENT_URL: 'http://localhost:5173', R2_PUBLIC_URL: 'https://cdn.example.com', R2_BUCKET_NAME: 'bucket' } }));
vi.mock('../../config/r2.js', () => ({ default: { send: vi.fn() }, R2_BUCKET_NAME: 'test' }));
vi.mock('../../utils/tokenUtils.js', () => ({ generateAccessToken: vi.fn(() => 'tok'), generateRefreshToken: vi.fn(() => 'ref'), verifyAccessToken: vi.fn(() => ({ userId: '507f1f77bcf86cd799439001' })), verifyRefreshToken: vi.fn(), setAuthCookies: vi.fn(), clearAuthCookies: vi.fn() }));
vi.mock('../../models/User.js', () => ({ default: { findOne: vi.fn(), findById: vi.fn(), create: vi.fn() } }));
vi.mock('../../models/Event.js', () => ({ default: { find: vi.fn(), findById: vi.fn(), countDocuments: vi.fn() } }));
vi.mock('../../models/Media.js', () => ({ default: { find: vi.fn(), findById: vi.fn(), countDocuments: vi.fn(), aggregate: vi.fn() } }));
vi.mock('../../models/Notification.js', () => ({ default: { find: vi.fn(), findOne: vi.fn(), findOneAndUpdate: vi.fn(), updateMany: vi.fn(), create: vi.fn() } }));
vi.mock('../../models/Comment.js', () => ({ default: { find: vi.fn(), create: vi.fn(), deleteMany: vi.fn() } }));
vi.mock('../../sockets/index.js', () => ({ initSocketServer: vi.fn(), getIO: vi.fn(), emitToUser: vi.fn(), emitToEvent: vi.fn(), isUserOnline: vi.fn() }));
vi.mock('../../sockets/mediaSocket.js', () => ({ emitMediaUploaded: vi.fn(), emitGalleryUpdated: vi.fn(), emitPhotoLikedToEvent: vi.fn(), emitNewCommentToEvent: vi.fn() }));
vi.mock('../../sockets/notificationSocket.js', () => ({ notifyUser: vi.fn(), emitPhotoLikedToOwner: vi.fn(), emitNewCommentToUser: vi.fn(), emitUserTagged: vi.fn() }));
vi.mock('../../sockets/activitySocket.js', () => ({ emitActivityUpdate: vi.fn() }));
vi.mock('../../middleware/authMiddleware.js', () => ({
  default: vi.fn((req, res, next) => {
    // In integration tests, inject a default admin user
    req.user = req.user || {
      _id: '507f1f77bcf86cd799439001',
      name: 'Admin User', email: 'admin@antares.test',
      role: 'admin', isBlocked: false,
    };
    next();
  }),
  optionalAuth: vi.fn((req, res, next) => next()),
}));
vi.mock('../../middleware/rateLimiter.js', () => ({ default: vi.fn(() => (req, res, next) => next()) }));
vi.mock('passport', () => { const p = { initialize: vi.fn(() => (req, res, next) => next()), authenticate: vi.fn(() => (req, res, next) => next()), use: vi.fn(), serializeUser: vi.fn(), deserializeUser: vi.fn() }; return { default: p }; });
vi.mock('../../config/passport.js', () => ({ default: vi.fn() }));
vi.mock('@aws-sdk/client-s3', () => ({ GetObjectCommand: vi.fn(), PutObjectCommand: vi.fn(), DeleteObjectCommand: vi.fn() }));
vi.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: vi.fn() }));
vi.mock('../../utils/imageProcessor.js', () => ({ compressImage: vi.fn(), compressAvatar: vi.fn(), applyWatermark: vi.fn(), applyVideoWatermark: vi.fn(), extractVideoThumbnail: vi.fn() }));
vi.mock('sharp', () => ({ default: vi.fn(() => ({ jpeg: vi.fn().mockReturnThis(), toBuffer: vi.fn().mockResolvedValue(Buffer.from('')) })) }));

import request from 'supertest';
import { createTestApp, createAuthenticatedApp } from '../helpers/testApp.js';
import Notification from '../../models/Notification.js';
import { makeAdmin, makeNotification } from '../helpers/mockFactories.js';

const adminUser = makeAdmin();
let app;

beforeAll(() => {
  app = createTestApp();
});

describe('GET /api/notifications', () => {
  it('returns 200 with notification list when authenticated', async () => {
    Notification.find.mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      populate: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([makeNotification()]),
    });
    const res = await request(app).get('/api/notifications');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('PATCH /api/notifications/read-all', () => {
  it('returns 200 and marks all read', async () => {
    Notification.updateMany.mockResolvedValue({ modifiedCount: 3 });
    const res = await request(app).patch('/api/notifications/read-all');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('PATCH /api/notifications/:id/read', () => {
  it('returns 404 for non-existent notification', async () => {
    Notification.findOneAndUpdate.mockResolvedValue(null);
    const res = await request(app).patch('/api/notifications/507f1f77bcf86cd799439040/read');
    expect(res.status).toBe(404);
  });

  it('returns 200 on successful mark-read', async () => {
    const notif = makeNotification({ isRead: true });
    Notification.findOneAndUpdate.mockResolvedValue(notif);
    const res = await request(app).patch('/api/notifications/507f1f77bcf86cd799439040/read');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
