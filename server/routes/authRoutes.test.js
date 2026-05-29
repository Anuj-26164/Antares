import { describe, it, expect, vi } from 'vitest';

// Mock dependencies that trigger env validation
vi.mock('../config/env.js', () => ({
  default: {
    JWT_SECRET: 'test-secret',
    JWT_REFRESH_SECRET: 'test-refresh-secret',
    CLIENT_URL: 'http://localhost:3000',
    GOOGLE_CLIENT_ID: 'test-client-id',
    GOOGLE_CLIENT_SECRET: 'test-client-secret',
    GOOGLE_CALLBACK_URL: 'http://localhost:5000/api/auth/google/callback',
  },
}));

vi.mock('../models/User.js', () => ({
  default: {
    findOne: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('../utils/tokenUtils.js', () => ({
  generateAccessToken: vi.fn(),
  generateRefreshToken: vi.fn(),
  verifyAccessToken: vi.fn(),
  verifyRefreshToken: vi.fn(),
  setAuthCookies: vi.fn(),
  clearAuthCookies: vi.fn(),
}));

vi.mock('passport', () => ({
  default: {
    authenticate: vi.fn(() => (req, res, next) => next()),
    use: vi.fn(),
    serializeUser: vi.fn(),
    deserializeUser: vi.fn(),
  },
}));

vi.mock('passport-google-oauth20', () => ({
  Strategy: vi.fn(),
}));

import router from './authRoutes.js';

describe('authRoutes', () => {
  // Extract route definitions from the router stack
  const routes = router.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods),
      middlewareCount: layer.route.stack.length,
    }));

  it('should define POST /register route with rate limiter', () => {
    const route = routes.find((r) => r.path === '/register');
    expect(route).toBeDefined();
    expect(route.methods).toContain('post');
    // 2 handlers: authLimiter + register
    expect(route.middlewareCount).toBe(2);
  });

  it('should define POST /login route with rate limiter', () => {
    const route = routes.find((r) => r.path === '/login');
    expect(route).toBeDefined();
    expect(route.methods).toContain('post');
    // 2 handlers: authLimiter + login
    expect(route.middlewareCount).toBe(2);
  });

  it('should define POST /logout route with authMiddleware', () => {
    const route = routes.find((r) => r.path === '/logout');
    expect(route).toBeDefined();
    expect(route.methods).toContain('post');
    // 2 handlers: authMiddleware + logout (no rate limiter on logout)
    expect(route.middlewareCount).toBe(2);
  });

  it('should define POST /refresh route with rate limiter', () => {
    const route = routes.find((r) => r.path === '/refresh');
    expect(route).toBeDefined();
    expect(route.methods).toContain('post');
    // 2 handlers: refreshLimiter + refresh
    expect(route.middlewareCount).toBe(2);
  });

  it('should define GET /google route', () => {
    const route = routes.find((r) => r.path === '/google');
    expect(route).toBeDefined();
    expect(route.methods).toContain('get');
  });

  it('should define GET /google/callback route', () => {
    const route = routes.find((r) => r.path === '/google/callback');
    expect(route).toBeDefined();
    expect(route.methods).toContain('get');
  });

  it('should export router as default', () => {
    expect(router).toBeDefined();
    expect(typeof router).toBe('function');
  });
});
