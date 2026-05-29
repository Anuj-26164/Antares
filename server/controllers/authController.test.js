/**
 * Unit tests for authController.
 * Tests register, login, logout, refresh, and googleCallback handlers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { register, login, logout, refresh, googleCallback } from './authController.js';

// Mock bcryptjs
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}));

// Mock User model
vi.mock('../models/User.js', () => ({
  default: {
    findOne: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    create: vi.fn(),
  },
}));

// Mock tokenUtils
vi.mock('../utils/tokenUtils.js', () => ({
  generateAccessToken: vi.fn(() => 'mock-access-token'),
  generateRefreshToken: vi.fn(() => 'mock-refresh-token'),
  verifyRefreshToken: vi.fn(),
  setAuthCookies: vi.fn(),
  clearAuthCookies: vi.fn(),
}));

// Mock config
vi.mock('../config/env.js', () => ({
  default: {
    CLIENT_URL: 'http://localhost:3000',
  },
}));

import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  setAuthCookies,
  clearAuthCookies,
} from '../utils/tokenUtils.js';

/** Helper to create a mock Express response */
function mockRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    redirect: vi.fn().mockReturnThis(),
    cookies: {},
  };
  return res;
}

/** Helper to create a mock Express request */
function mockReq(body = {}, cookies = {}, user = null) {
  return { body, cookies, user };
}

describe('authController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('register', () => {
    it('should return 400 for invalid email format', async () => {
      const req = mockReq({ name: 'Test', email: 'invalid', password: 'password123' });
      const res = mockRes();

      await register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid email format',
      });
    });

    it('should return 400 for missing email', async () => {
      const req = mockReq({ name: 'Test', password: 'password123' });
      const res = mockRes();

      await register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid email format',
      });
    });

    it('should return 400 for password shorter than 8 characters', async () => {
      const req = mockReq({ name: 'Test', email: 'test@example.com', password: 'short' });
      const res = mockRes();

      await register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Password must be between 8 and 128 characters',
      });
    });

    it('should return 400 for password longer than 128 characters', async () => {
      const req = mockReq({
        name: 'Test',
        email: 'test@example.com',
        password: 'a'.repeat(129),
      });
      const res = mockRes();

      await register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Password must be between 8 and 128 characters',
      });
    });

    it('should return 400 for missing name', async () => {
      const req = mockReq({ email: 'test@example.com', password: 'password123' });
      const res = mockRes();

      await register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Name is required',
      });
    });

    it('should return 409 for duplicate email', async () => {
      User.findOne.mockResolvedValue({ email: 'test@example.com' });
      const req = mockReq({ name: 'Test', email: 'test@example.com', password: 'password123' });
      const res = mockRes();

      await register(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Email is already registered',
      });
    });

    it('should return 201 with user data on successful registration', async () => {
      User.findOne.mockResolvedValue(null);
      bcrypt.hash.mockResolvedValue('hashed-password');
      const mockUser = {
        _id: 'user-id-123',
        name: 'Test User',
        email: 'test@example.com',
        role: 'viewer',
        avatar: undefined,
        createdAt: new Date('2024-01-01'),
        refreshToken: null,
        save: vi.fn(),
      };
      User.create.mockResolvedValue(mockUser);
      generateAccessToken.mockReturnValue('mock-access-token');
      generateRefreshToken.mockReturnValue('mock-refresh-token');

      const req = mockReq({ name: 'Test User', email: 'test@example.com', password: 'password123' });
      const res = mockRes();

      await register(req, res);

      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 12);
      expect(User.create).toHaveBeenCalledWith({
        name: 'Test User',
        email: 'test@example.com',
        password: 'hashed-password',
      });
      // Tokens must be issued and cookies set on registration
      expect(generateAccessToken).toHaveBeenCalledWith('user-id-123');
      expect(generateRefreshToken).toHaveBeenCalledWith('user-id-123');
      expect(setAuthCookies).toHaveBeenCalledWith(res, 'mock-access-token', 'mock-refresh-token');
      expect(mockUser.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          _id: 'user-id-123',
          name: 'Test User',
          email: 'test@example.com',
          role: 'viewer',
          avatar: undefined,
          createdAt: mockUser.createdAt,
        },
      });
    });

    it('should hash password with bcrypt saltRounds 12', async () => {
      User.findOne.mockResolvedValue(null);
      bcrypt.hash.mockResolvedValue('hashed');
      User.create.mockResolvedValue({
        _id: 'id',
        name: 'Test',
        email: 'test@example.com',
        role: 'viewer',
        createdAt: new Date(),
      });

      const req = mockReq({ name: 'Test', email: 'test@example.com', password: 'mypassword' });
      const res = mockRes();

      await register(req, res);

      expect(bcrypt.hash).toHaveBeenCalledWith('mypassword', 12);
    });
  });

  describe('login', () => {
    it('should return 400 for invalid email format', async () => {
      const req = mockReq({ email: 'bad-email', password: 'password123' });
      const res = mockRes();

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid email format',
      });
    });

    it('should return 400 for password shorter than 8 characters', async () => {
      const req = mockReq({ email: 'test@example.com', password: 'short' });
      const res = mockRes();

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Password must be between 8 and 128 characters',
      });
    });

    it('should return 401 with generic message when user not found', async () => {
      User.findOne.mockResolvedValue(null);
      const req = mockReq({ email: 'test@example.com', password: 'password123' });
      const res = mockRes();

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid email or password',
      });
    });

    it('should return 401 with generic message when password does not match', async () => {
      const mockUser = {
        _id: 'user-id',
        password: 'hashed-password',
        save: vi.fn(),
      };
      User.findOne.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(false);

      const req = mockReq({ email: 'test@example.com', password: 'wrongpassword' });
      const res = mockRes();

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid email or password',
      });
    });

    it('should return 401 for user without password (Google-only account)', async () => {
      const mockUser = { _id: 'user-id', password: null };
      User.findOne.mockResolvedValue(mockUser);

      const req = mockReq({ email: 'test@example.com', password: 'password123' });
      const res = mockRes();

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid email or password',
      });
    });

    it('should return 200 with user data and set cookies on successful login', async () => {
      const mockUser = {
        _id: { toString: () => 'user-id-123' },
        name: 'Test User',
        email: 'test@example.com',
        password: 'hashed-password',
        role: 'viewer',
        avatar: 'avatar.jpg',
        createdAt: new Date('2024-01-01'),
        refreshToken: null,
        save: vi.fn(),
      };
      User.findOne.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);

      const req = mockReq({ email: 'test@example.com', password: 'password123' });
      const res = mockRes();

      await login(req, res);

      expect(generateAccessToken).toHaveBeenCalledWith('user-id-123');
      expect(generateRefreshToken).toHaveBeenCalledWith('user-id-123');
      expect(setAuthCookies).toHaveBeenCalledWith(res, 'mock-access-token', 'mock-refresh-token');
      expect(mockUser.save).toHaveBeenCalled();
      expect(mockUser.refreshToken).toBe('mock-refresh-token');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          _id: mockUser._id,
          name: 'Test User',
          email: 'test@example.com',
          role: 'viewer',
          avatar: 'avatar.jpg',
          createdAt: mockUser.createdAt,
        },
      });
    });
  });

  describe('logout', () => {
    it('should clear cookies and nullify refresh token', async () => {
      const mockUser = { _id: 'user-id-123' };
      User.findByIdAndUpdate.mockResolvedValue(null);

      const req = mockReq({}, {}, mockUser);
      const res = mockRes();

      await logout(req, res);

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith('user-id-123', { refreshToken: null });
      expect(clearAuthCookies).toHaveBeenCalledWith(res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { message: 'Logged out successfully' },
      });
    });

    it('should still clear cookies even if no user on request', async () => {
      const req = mockReq({}, {}, null);
      const res = mockRes();

      await logout(req, res);

      expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
      expect(clearAuthCookies).toHaveBeenCalledWith(res);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('refresh', () => {
    it('should return 401 when no refresh token cookie present', async () => {
      const req = mockReq({}, {});
      const res = mockRes();

      await refresh(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Refresh token not found',
      });
    });

    it('should return 401 and clear cookies when token verification fails', async () => {
      verifyRefreshToken.mockImplementation(() => {
        throw new Error('Token expired');
      });

      const req = mockReq({}, { refreshToken: 'expired-token' });
      const res = mockRes();

      await refresh(req, res);

      expect(clearAuthCookies).toHaveBeenCalledWith(res);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid or expired refresh token',
      });
    });

    it('should return 401 when user not found', async () => {
      verifyRefreshToken.mockReturnValue({ userId: 'user-id' });
      User.findById.mockResolvedValue(null);

      const req = mockReq({}, { refreshToken: 'valid-token' });
      const res = mockRes();

      await refresh(req, res);

      expect(clearAuthCookies).toHaveBeenCalledWith(res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 401 when stored refresh token does not match', async () => {
      verifyRefreshToken.mockReturnValue({ userId: 'user-id' });
      User.findById.mockResolvedValue({
        _id: { toString: () => 'user-id' },
        refreshToken: 'different-token',
      });

      const req = mockReq({}, { refreshToken: 'valid-token' });
      const res = mockRes();

      await refresh(req, res);

      expect(clearAuthCookies).toHaveBeenCalledWith(res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 200 with new access token on valid refresh', async () => {
      verifyRefreshToken.mockReturnValue({ userId: 'user-id' });
      User.findById.mockResolvedValue({
        _id: { toString: () => 'user-id' },
        refreshToken: 'valid-refresh-token',
      });
      generateAccessToken.mockReturnValue('new-access-token');

      const req = mockReq({}, { refreshToken: 'valid-refresh-token' });
      const res = mockRes();

      await refresh(req, res);

      expect(generateAccessToken).toHaveBeenCalledWith('user-id');
      expect(setAuthCookies).toHaveBeenCalledWith(res, 'new-access-token', 'valid-refresh-token');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { accessToken: 'new-access-token' },
      });
    });
  });

  describe('googleCallback', () => {
    it('should redirect to login with error when no user on request', async () => {
      const req = mockReq({}, {}, null);
      const res = mockRes();

      await googleCallback(req, res);

      expect(res.redirect).toHaveBeenCalledWith(
        'http://localhost:3000/login?error=google_auth_failed'
      );
    });

    it('should issue tokens, set cookies, and redirect to CLIENT_URL/gallery on success', async () => {
      generateAccessToken.mockReturnValue('google-access-token');
      generateRefreshToken.mockReturnValue('google-refresh-token');

      const mockUser = {
        _id: { toString: () => 'google-user-id' },
        role: 'viewer',
        refreshToken: null,
        save: vi.fn(),
      };
      const req = mockReq({}, {}, mockUser);
      const res = mockRes();

      await googleCallback(req, res);

      expect(generateAccessToken).toHaveBeenCalledWith('google-user-id');
      expect(generateRefreshToken).toHaveBeenCalledWith('google-user-id');
      expect(setAuthCookies).toHaveBeenCalledWith(res, 'google-access-token', 'google-refresh-token');
      expect(mockUser.save).toHaveBeenCalled();
      expect(mockUser.refreshToken).toBe('google-refresh-token');
      // Non-admin users are redirected to /gallery (changed from bare CLIENT_URL)
      expect(res.redirect).toHaveBeenCalledWith('http://localhost:3000/gallery');
    });
  });
});
