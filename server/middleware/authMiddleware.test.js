import { describe, it, expect, vi, beforeEach } from 'vitest';

// Set environment variables before any imports
process.env.PORT = '5000';
process.env.MONGO_URI = 'mongodb://localhost/test';
process.env.JWT_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.GOOGLE_CLIENT_ID = 'google-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret';
process.env.GOOGLE_CALLBACK_URL = 'http://localhost:5000/api/auth/google/callback';
process.env.CLIENT_URL = 'http://localhost:3000';
process.env.R2_ENDPOINT = 'https://r2.example.com';
process.env.R2_ACCESS_KEY_ID = 'r2-key';
process.env.R2_SECRET_ACCESS_KEY = 'r2-secret';
process.env.R2_BUCKET_NAME = 'test-bucket';
process.env.R2_PUBLIC_URL = 'https://pub.r2.example.com';

// Mock the User model
vi.mock('../models/User.js', () => {
  const mockSelect = vi.fn();
  const mockFindById = vi.fn(() => ({ select: mockSelect }));
  return {
    default: { findById: mockFindById },
    __mockFindById: mockFindById,
    __mockSelect: mockSelect,
  };
});

const { generateAccessToken } = await import('../utils/tokenUtils.js');
const { default: authMiddleware } = await import('./authMiddleware.js');
const { __mockFindById: mockFindById, __mockSelect: mockSelect } = await import('../models/User.js');

describe('authMiddleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { cookies: {} };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
    vi.clearAllMocks();
  });

  it('should return 401 when no accessToken cookie is present', async () => {
    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Authentication required',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when cookies object is undefined', async () => {
    req.cookies = undefined;

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Authentication required',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when token is invalid', async () => {
    req.cookies = { accessToken: 'invalid.token.value' };

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Authentication required',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when user is not found in database', async () => {
    const token = generateAccessToken('507f1f77bcf86cd799439011');
    req.cookies = { accessToken: token };
    mockSelect.mockResolvedValue(null);

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Authentication required',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should attach user to req and call next() on valid token', async () => {
    const userId = '507f1f77bcf86cd799439011';
    const token = generateAccessToken(userId);
    const mockUser = { _id: userId, name: 'Test User', email: 'test@example.com', role: 'viewer' };

    req.cookies = { accessToken: token };
    mockSelect.mockResolvedValue(mockUser);

    await authMiddleware(req, res, next);

    expect(mockFindById).toHaveBeenCalledWith(userId);
    expect(mockSelect).toHaveBeenCalledWith('-password -refreshToken');
    expect(req.user).toEqual(mockUser);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
