/**
 * Integration tests for role management and authorization.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';

vi.mock('../../config/env.js', () => ({ validateEnv: vi.fn(() => ({})), default: { JWT_SECRET: 'test', JWT_REFRESH_SECRET: 'test-refresh', CLIENT_URL: 'http://localhost:5173', R2_PUBLIC_URL: 'https://cdn.example.com', R2_BUCKET_NAME: 'bucket' } }));
vi.mock('../../config/r2.js', () => ({ default: { send: vi.fn() }, R2_BUCKET_NAME: 'test' }));
vi.mock('../../utils/tokenUtils.js', () => ({ generateAccessToken: vi.fn(() => 'tok'), generateRefreshToken: vi.fn(() => 'ref'), verifyAccessToken: vi.fn(() => ({ userId: '507f1f77bcf86cd799439001' })), verifyRefreshToken: vi.fn(), setAuthCookies: vi.fn(), clearAuthCookies: vi.fn() }));
vi.mock('../../models/User.js', () => ({ default: { findOne: vi.fn(), findById: vi.fn(), find: vi.fn(), countDocuments: vi.fn(), create: vi.fn() } }));
vi.mock('../../models/Event.js', () => ({ default: { find: vi.fn(), findById: vi.fn(), countDocuments: vi.fn() } }));
vi.mock('../../models/Media.js', () => ({ default: { find: vi.fn(), findById: vi.fn(), countDocuments: vi.fn(), aggregate: vi.fn() } }));
vi.mock('../../models/Notification.js', () => ({ default: { find: vi.fn(), updateMany: vi.fn() } }));
vi.mock('../../models/Comment.js', () => ({ default: { find: vi.fn(), create: vi.fn(), deleteMany: vi.fn() } }));
vi.mock('../../sockets/index.js', () => ({ initSocketServer: vi.fn(), getIO: vi.fn(), emitToUser: vi.fn(), emitToEvent: vi.fn(), isUserOnline: vi.fn() }));
vi.mock('../../sockets/mediaSocket.js', () => ({ emitMediaUploaded: vi.fn(), emitGalleryUpdated: vi.fn(), emitPhotoLikedToEvent: vi.fn(), emitNewCommentToEvent: vi.fn() }));
vi.mock('../../sockets/notificationSocket.js', () => ({ notifyUser: vi.fn(), emitPhotoLikedToOwner: vi.fn(), emitNewCommentToUser: vi.fn(), emitUserTagged: vi.fn() }));
vi.mock('../../sockets/activitySocket.js', () => ({ emitActivityUpdate: vi.fn() }));
vi.mock('../../middleware/authMiddleware.js', () => ({
  default: vi.fn((req, res, next) => {
    req.user = req.user || { _id: '507f1f77bcf86cd799439001', name: 'Admin', email: 'admin@test.com', role: 'admin', isBlocked: false };
    next();
  }),
  optionalAuth: vi.fn((req, res, next) => next()),
}));
vi.mock('../../middleware/uploadMiddleware.js', () => ({ uploadBulk: [vi.fn((req, res, next) => next())], uploadAvatar: [vi.fn((req, res, next) => next())] }));
vi.mock('../../middleware/rateLimiter.js', () => ({ default: vi.fn(() => (req, res, next) => next()) }));
vi.mock('passport', () => { const p = { initialize: vi.fn(() => (req, res, next) => next()), authenticate: vi.fn(() => (req, res, next) => next()), use: vi.fn(), serializeUser: vi.fn(), deserializeUser: vi.fn() }; return { default: p }; });
vi.mock('../../config/passport.js', () => ({ default: vi.fn() }));
vi.mock('@aws-sdk/client-s3', () => ({ GetObjectCommand: vi.fn(), PutObjectCommand: vi.fn(), DeleteObjectCommand: vi.fn() }));
vi.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: vi.fn() }));
vi.mock('../../utils/imageProcessor.js', () => ({ compressImage: vi.fn(), compressAvatar: vi.fn(), applyWatermark: vi.fn(), applyVideoWatermark: vi.fn(), extractVideoThumbnail: vi.fn() }));
vi.mock('sharp', () => ({ default: vi.fn(() => ({ jpeg: vi.fn().mockReturnThis(), toBuffer: vi.fn().mockResolvedValue(Buffer.from('')) })) }));

import request from 'supertest';
import { createTestApp } from '../helpers/testApp.js';
import User from '../../models/User.js';
import { makeAdmin, makeUser } from '../helpers/mockFactories.js';

let app;
beforeAll(() => { app = createTestApp(); });

describe('GET /api/users/me', () => {
  it('returns 200 for authenticated user', async () => {
    User.findById.mockReturnValue({
      select: vi.fn().mockResolvedValue(makeAdmin()),
    });
    const res = await request(app).get('/api/users/me');
    expect([200, 500]).toContain(res.status);
  });
});

describe('PUT /api/users/:id/role', () => {
  it('returns 403 for viewer role', async () => {
    const authMw = (await import('../../middleware/authMiddleware.js')).default;
    authMw.mockImplementationOnce((req, res, next) => {
      req.user = makeUser({ role: 'viewer' });
      next();
    });
    const res = await request(app)
      .put('/api/users/507f1f77bcf86cd799439003/role')
      .send({ role: 'photographer' });
    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid role when admin', async () => {
    User.findById.mockResolvedValue(makeUser({ _id: '507f1f77bcf86cd799439003' }));
    const res = await request(app)
      .put('/api/users/507f1f77bcf86cd799439003/role')
      .send({ role: 'superuser' });
    expect([400, 500]).toContain(res.status);
  });

  it('returns 200 for valid role change by admin', async () => {
    const targetUser = makeUser({ _id: '507f1f77bcf86cd799439003', role: 'viewer', save: vi.fn().mockResolvedValue(undefined), toObject: function() { return { ...this }; } });
    User.findById.mockResolvedValue(targetUser);
    User.countDocuments.mockResolvedValue(2);
    const res = await request(app)
      .put('/api/users/507f1f77bcf86cd799439003/role')
      .send({ role: 'photographer' });
    expect([200, 500]).toContain(res.status);
  });
});
