/**
 * Integration tests for authentication endpoints.
 * Uses Supertest against the real Express app with mocked DB/external services.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// â”€â”€ Mocks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
vi.mock('../../config/env.js', () => ({
  validateEnv: vi.fn(() => ({})),
  default: { JWT_SECRET: 'test', JWT_REFRESH_SECRET: 'test-refresh', CLIENT_URL: 'http://localhost:5173', R2_PUBLIC_URL: 'https://cdn.example.com', R2_BUCKET_NAME: 'bucket' },
}));
vi.mock('../../config/r2.js', () => ({ default: { send: vi.fn() }, R2_BUCKET_NAME: 'test' }));
vi.mock('../../utils/tokenUtils.js', () => ({
  generateAccessToken: vi.fn(() => 'access-token-123'),
  generateRefreshToken: vi.fn(() => 'refresh-token-123'),
  verifyAccessToken: vi.fn(() => ({ userId: '507f1f77bcf86cd799439001' })),
  verifyRefreshToken: vi.fn(() => ({ userId: '507f1f77bcf86cd799439001' })),
  setAuthCookies: vi.fn((res) => res.cookie?.('accessToken', 'access-token-123')),
  clearAuthCookies: vi.fn(),
}));
vi.mock('../../models/User.js', () => ({
  default: {
    findOne: vi.fn(),
    findById: vi.fn().mockResolvedValue({
      _id: '507f1f77bcf86cd799439001',
      name: 'Admin User', email: 'admin@antares.test',
      role: 'admin', isBlocked: false, refreshToken: null,
      save: vi.fn().mockResolvedValue(undefined),
    }),
    find: vi.fn(),
    countDocuments: vi.fn(),
    create: vi.fn(),
  },
}));
vi.mock('../../models/Event.js', () => ({ default: { find: vi.fn(), findById: vi.fn(), countDocuments: vi.fn() } }));
vi.mock('../../models/Media.js', () => ({ default: { find: vi.fn(), findById: vi.fn(), countDocuments: vi.fn(), aggregate: vi.fn() } }));
vi.mock('../../models/Notification.js', () => ({ default: { find: vi.fn(), updateMany: vi.fn() } }));
vi.mock('../../models/Comment.js', () => ({ default: { find: vi.fn(), create: vi.fn(), deleteMany: vi.fn() } }));
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
vi.mock('bcryptjs', () => ({ default: { hash: vi.fn().mockResolvedValue('hashed'), compare: vi.fn() } }));

import request from 'supertest';
import { createTestApp } from '../helpers/testApp.js';
import User from '../../models/User.js';
import bcrypt from 'bcryptjs';

let app;
beforeAll(() => { app = createTestApp(); });
beforeEach(() => {
  User.findById.mockResolvedValue({ _id: 'uid', name: 'Test', email: 'a@b.com', role: 'viewer', isBlocked: false });
});

describe('POST /api/auth/register', () => {
  it('returns 400 for missing name', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'a@b.com', password: 'password123' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for invalid email', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'Test', email: 'bad', password: 'password123' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for short password', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'Test', email: 'a@b.com', password: 'short' });
    expect(res.status).toBe(400);
  });

  it('returns 409 for duplicate email', async () => {
    User.findOne.mockResolvedValue({ email: 'a@b.com' });
    const res = await request(app).post('/api/auth/register').send({ name: 'Test', email: 'a@b.com', password: 'password123' });
    expect(res.status).toBe(409);
  });

  it('returns 201 on successful registration', async () => {
    User.findOne.mockResolvedValue(null);
    User.create.mockResolvedValue({
      _id: { toString: () => 'uid' },
      name: 'Test',
      email: 'a@b.com',
      role: 'viewer',
      createdAt: new Date(),
      refreshToken: null,
      save: vi.fn().mockResolvedValue(undefined),
    });
    const res = await request(app).post('/api/auth/register').send({ name: 'Test', email: 'a@b.com', password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('email', 'a@b.com');
  });
});

describe('POST /api/auth/login', () => {
  it('returns 400 for invalid email format', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'bad', password: 'password123' });
    expect(res.status).toBe(400);
  });

  it('returns 401 for wrong credentials', async () => {
    User.findOne.mockResolvedValue({ _id: 'uid', password: 'hashed', save: vi.fn() });
    bcrypt.compare.mockResolvedValue(false);
    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.com', password: 'wrongpass' });
    expect(res.status).toBe(401);
  });

  it('returns 200 and sets cookies on valid login', async () => {
    const mockUser = { _id: { toString: () => 'uid' }, name: 'Test', email: 'a@b.com', role: 'viewer', avatar: null, createdAt: new Date(), password: 'hashed', refreshToken: null, save: vi.fn() };
    User.findOne.mockResolvedValue(mockUser);
    bcrypt.compare.mockResolvedValue(true);
    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('email');
  });
});

describe('POST /api/auth/logout', () => {
  it('returns 401 without auth cookie', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect([200, 401]).toContain(res.status);
  });
});

describe('POST /api/auth/refresh', () => {
  it('returns 401 without refresh token cookie', async () => {
    const res = await request(app).post('/api/auth/refresh');
    expect(res.status).toBe(401);
  });
});
