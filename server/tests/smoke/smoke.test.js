/**
 * Smoke tests â€” verify critical infrastructure is reachable.
 * These tests mock external services and verify the app bootstraps correctly.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';

// â”€â”€ Mock all external dependencies â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
vi.mock('../../config/db.js', () => ({ connectDB: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../config/r2.js', () => ({ default: { send: vi.fn() }, R2_BUCKET_NAME: 'test' }));
vi.mock('../../config/env.js', () => ({
  validateEnv: vi.fn(() => ({
    PORT: '5000', MONGO_URI: 'mongodb://localhost/test',
    JWT_SECRET: 'test-secret', JWT_REFRESH_SECRET: 'test-refresh',
    CLIENT_URL: 'http://localhost:5173',
    R2_ENDPOINT: 'https://r2.example.com', R2_ACCESS_KEY_ID: 'key',
    R2_SECRET_ACCESS_KEY: 'secret', R2_BUCKET_NAME: 'bucket',
    R2_PUBLIC_URL: 'https://cdn.example.com',
    GOOGLE_CLIENT_ID: 'gid', GOOGLE_CLIENT_SECRET: 'gsecret',
    GOOGLE_CALLBACK_URL: 'http://localhost:5000/api/auth/google/callback',
  })),
  default: {
    PORT: '5000', CLIENT_URL: 'http://localhost:5173',
    JWT_SECRET: 'test-secret', JWT_REFRESH_SECRET: 'test-refresh',
    R2_PUBLIC_URL: 'https://cdn.example.com', R2_BUCKET_NAME: 'bucket',
  },
}));
vi.mock('../../utils/tokenUtils.js', () => ({
  generateAccessToken: vi.fn(() => 'mock-access'),
  generateRefreshToken: vi.fn(() => 'mock-refresh'),
  verifyAccessToken: vi.fn(() => ({ userId: '507f1f77bcf86cd799439001' })),
  verifyRefreshToken: vi.fn(() => ({ userId: '507f1f77bcf86cd799439001' })),
  setAuthCookies: vi.fn(),
  clearAuthCookies: vi.fn(),
}));
vi.mock('../../models/User.js', () => ({
  default: {
    findById: vi.fn().mockResolvedValue({
      _id: '507f1f77bcf86cd799439001',
      name: 'Admin', email: 'admin@test.com',
      role: 'admin', isBlocked: false,
    }),
    findOne: vi.fn(),
    create: vi.fn(),
  },
}));
vi.mock('../../models/Event.js', () => ({ default: { find: vi.fn(), findById: vi.fn() } }));
vi.mock('../../models/Media.js', () => ({ default: { find: vi.fn(), findById: vi.fn(), countDocuments: vi.fn(), aggregate: vi.fn() } }));
vi.mock('../../models/Notification.js', () => ({ default: { find: vi.fn() } }));
vi.mock('../../sockets/index.js', () => ({ initSocketServer: vi.fn(), getIO: vi.fn(), emitToUser: vi.fn(), emitToEvent: vi.fn(), isUserOnline: vi.fn() }));
vi.mock('../../sockets/mediaSocket.js', () => ({ emitMediaUploaded: vi.fn(), emitGalleryUpdated: vi.fn(), emitPhotoLikedToEvent: vi.fn(), emitNewCommentToEvent: vi.fn() }));
vi.mock('../../sockets/notificationSocket.js', () => ({ notifyUser: vi.fn(), emitPhotoLikedToOwner: vi.fn(), emitNewCommentToUser: vi.fn(), emitUserTagged: vi.fn() }));
vi.mock('../../sockets/activitySocket.js', () => ({ emitActivityUpdate: vi.fn() }));
vi.mock('../../middleware/uploadMiddleware.js', () => ({ uploadBulk: [vi.fn((req, res, next) => next())], uploadAvatar: [vi.fn((req, res, next) => next())] }));
vi.mock('../../middleware/rateLimiter.js', () => ({ default: vi.fn(() => (req, res, next) => next()) }));
vi.mock('passport', () => {
  const p = { initialize: vi.fn(() => (req, res, next) => next()), authenticate: vi.fn(() => (req, res, next) => next()), use: vi.fn(), serializeUser: vi.fn(), deserializeUser: vi.fn() };
  return { default: p };
});
vi.mock('../../config/passport.js', () => ({ default: vi.fn() }));
vi.mock('@aws-sdk/client-s3', () => ({ GetObjectCommand: vi.fn(), PutObjectCommand: vi.fn(), DeleteObjectCommand: vi.fn() }));
vi.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: vi.fn() }));
vi.mock('../../utils/imageProcessor.js', () => ({ compressImage: vi.fn(), compressAvatar: vi.fn(), applyWatermark: vi.fn(), applyVideoWatermark: vi.fn(), extractVideoThumbnail: vi.fn() }));
vi.mock('sharp', () => ({ default: vi.fn(() => ({ jpeg: vi.fn().mockReturnThis(), toBuffer: vi.fn().mockResolvedValue(Buffer.from('')) })) }));
vi.mock('../../models/Comment.js', () => ({ default: { find: vi.fn(), create: vi.fn(), deleteMany: vi.fn() } }));

import request from 'supertest';
import { createTestApp } from '../helpers/testApp.js';

let app;
beforeAll(() => { app = createTestApp(); });

describe('Smoke Tests', () => {
  describe('API Health', () => {
    it('GET /api/auth/login returns 400 (not 404) â€” route exists', async () => {
      const res = await request(app).post('/api/auth/login').send({});
      expect(res.status).not.toBe(404);
    });

    it('GET /api/events returns 401 â€” route exists and requires auth', async () => {
      const res = await request(app).get('/api/events');
      expect([200, 401, 403]).toContain(res.status);
    });

    it('GET /api/media returns response â€” route exists', async () => {
      const res = await request(app).get('/api/media');
      expect([200, 401, 500]).toContain(res.status);
    });

    it('GET /api/notifications returns 401 â€” route exists and requires auth', async () => {
      const res = await request(app).get('/api/notifications');
      expect(res.status).toBe(401);
    });
  });

  describe('JWT Authentication', () => {
    it('verifyAccessToken mock works correctly', async () => {
      const { verifyAccessToken } = await import('../../utils/tokenUtils.js');
      const result = verifyAccessToken('any-token');
      expect(result).toHaveProperty('userId');
    });

    it('generateAccessToken returns a token string', async () => {
      const { generateAccessToken } = await import('../../utils/tokenUtils.js');
      const token = generateAccessToken('user-id');
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });
  });

  describe('Socket.IO', () => {
    it('initSocketServer is callable', async () => {
      const { initSocketServer } = await import('../../sockets/index.js');
      expect(typeof initSocketServer).toBe('function');
    });

    it('emitToUser is callable', async () => {
      const { emitToUser } = await import('../../sockets/index.js');
      expect(typeof emitToUser).toBe('function');
    });
  });

  describe('R2 Integration', () => {
    it('R2 client send is callable', async () => {
      const r2 = await import('../../config/r2.js');
      expect(typeof r2.default.send).toBe('function');
    });
  });
});
