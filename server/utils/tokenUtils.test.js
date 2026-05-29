import { describe, it, expect, vi } from 'vitest';

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

const {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  setAuthCookies,
  clearAuthCookies,
} = await import('./tokenUtils.js');

describe('tokenUtils', () => {
  const testUserId = '507f1f77bcf86cd799439011';

  describe('generateAccessToken', () => {
    it('should return a valid JWT string', () => {
      const token = generateAccessToken(testUserId);
      expect(token).toBeTypeOf('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('should encode the userId in the payload', () => {
      const token = generateAccessToken(testUserId);
      const decoded = verifyAccessToken(token);
      expect(decoded.userId).toBe(testUserId);
    });
  });

  describe('generateRefreshToken', () => {
    it('should return a valid JWT string', () => {
      const token = generateRefreshToken(testUserId);
      expect(token).toBeTypeOf('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('should encode the userId in the payload', () => {
      const token = generateRefreshToken(testUserId);
      const decoded = verifyRefreshToken(token);
      expect(decoded.userId).toBe(testUserId);
    });
  });

  describe('verifyAccessToken', () => {
    it('should return { userId } for a valid access token', () => {
      const token = generateAccessToken(testUserId);
      const result = verifyAccessToken(token);
      expect(result).toEqual({ userId: testUserId });
    });

    it('should throw for an invalid token', () => {
      expect(() => verifyAccessToken('invalid.token.here')).toThrow();
    });

    it('should throw for a token signed with the wrong secret', () => {
      const token = generateRefreshToken(testUserId);
      expect(() => verifyAccessToken(token)).toThrow();
    });
  });

  describe('verifyRefreshToken', () => {
    it('should return { userId } for a valid refresh token', () => {
      const token = generateRefreshToken(testUserId);
      const result = verifyRefreshToken(token);
      expect(result).toEqual({ userId: testUserId });
    });

    it('should throw for an invalid token', () => {
      expect(() => verifyRefreshToken('invalid.token.here')).toThrow();
    });

    it('should throw for a token signed with the wrong secret', () => {
      const token = generateAccessToken(testUserId);
      expect(() => verifyRefreshToken(token)).toThrow();
    });
  });

  describe('setAuthCookies', () => {
    it('should set accessToken and refreshToken cookies with correct options', () => {
      const cookies = {};
      const res = {
        cookie: vi.fn((name, value, options) => {
          cookies[name] = { value, options };
        }),
      };

      const accessToken = 'access-token-value';
      const refreshToken = 'refresh-token-value';

      setAuthCookies(res, accessToken, refreshToken);

      expect(res.cookie).toHaveBeenCalledTimes(2);

      // Access token cookie — maxAge changed from 15min to 1 day (intentional security decision)
      expect(cookies.accessToken.value).toBe(accessToken);
      expect(cookies.accessToken.options.httpOnly).toBe(true);
      expect(cookies.accessToken.options.sameSite).toBe('strict');
      expect(cookies.accessToken.options.maxAge).toBe(24 * 60 * 60 * 1000);

      // Refresh token cookie
      expect(cookies.refreshToken.value).toBe(refreshToken);
      expect(cookies.refreshToken.options.httpOnly).toBe(true);
      expect(cookies.refreshToken.options.sameSite).toBe('strict');
      expect(cookies.refreshToken.options.maxAge).toBe(7 * 24 * 60 * 60 * 1000);
    });
  });

  describe('clearAuthCookies', () => {
    it('should clear both accessToken and refreshToken cookies', () => {
      const cleared = [];
      const res = {
        clearCookie: vi.fn((name, options) => {
          cleared.push({ name, options });
        }),
      };

      clearAuthCookies(res);

      expect(res.clearCookie).toHaveBeenCalledTimes(2);
      expect(cleared[0].name).toBe('accessToken');
      expect(cleared[0].options.httpOnly).toBe(true);
      expect(cleared[0].options.sameSite).toBe('strict');
      expect(cleared[1].name).toBe('refreshToken');
      expect(cleared[1].options.httpOnly).toBe(true);
      expect(cleared[1].options.sameSite).toBe('strict');
    });
  });
});
