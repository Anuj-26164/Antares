import { describe, it, expect, vi } from 'vitest';

// Mock dependencies
vi.mock('../config/env.js', () => ({
  default: {
    JWT_SECRET: 'test-secret',
    JWT_REFRESH_SECRET: 'test-refresh-secret',
    CLIENT_URL: 'http://localhost:3000',
    R2_PUBLIC_URL: 'https://cdn.example.com',
    R2_BUCKET_NAME: 'test-bucket',
  },
}));

// R2 client must be mocked before uploadMiddleware loads — it calls multerS3({ bucket }) at import time
vi.mock('../config/r2.js', () => ({
  default: { send: vi.fn() },
  R2_BUCKET_NAME: 'test-bucket',
}));

// uploadMiddleware calls multerS3 at module load time; mock the whole module to prevent that
vi.mock('../middleware/uploadMiddleware.js', () => ({
  uploadBulk: [vi.fn((req, res, next) => next())],
  uploadAvatar: [vi.fn((req, res, next) => next())],
}));

vi.mock('../models/User.js', () => ({
  default: {
    findById: vi.fn(),
  },
}));

vi.mock('../models/Media.js', () => ({
  default: {
    find: vi.fn(),
    countDocuments: vi.fn(),
  },
}));

vi.mock('../utils/tokenUtils.js', () => ({
  verifyAccessToken: vi.fn(),
}));

import router from './userRoutes.js';

describe('userRoutes', () => {
  // The router uses router.use(authMiddleware) at the top level,
  // so we check the router-level middleware and route definitions.
  const routerMiddleware = router.stack.filter((layer) => !layer.route);
  const routes = router.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods),
      middlewareCount: layer.route.stack.length,
    }));

  it('should apply authMiddleware to all routes via router.use', () => {
    // router.use(authMiddleware) adds a layer without a route
    expect(routerMiddleware.length).toBeGreaterThanOrEqual(1);
  });

  it('should define GET /me route', () => {
    const route = routes.find((r) => r.path === '/me' && r.methods.includes('get'));
    expect(route).toBeDefined();
    // 1 handler (getMe) — authMiddleware is applied at router level
    expect(route.middlewareCount).toBe(1);
  });

  it('should define PUT /me route', () => {
    const route = routes.find((r) => r.path === '/me' && r.methods.includes('put'));
    expect(route).toBeDefined();
    // 1 handler (updateMe)
    expect(route.middlewareCount).toBe(1);
  });

  it('should define GET /me/favourites route', () => {
    const route = routes.find((r) => r.path === '/me/favourites');
    expect(route).toBeDefined();
    expect(route.methods).toContain('get');
    // 1 handler (getMyFavourites)
    expect(route.middlewareCount).toBe(1);
  });

  it('should define PUT /:id/role route with roleMiddleware', () => {
    const route = routes.find((r) => r.path === '/:id/role');
    expect(route).toBeDefined();
    expect(route.methods).toContain('put');
    // 2 handlers (roleMiddleware('admin') + changeRole)
    expect(route.middlewareCount).toBe(2);
  });

  it('should define POST /me/avatar route with upload middleware', () => {
    const route = routes.find((r) => r.path === '/me/avatar' && r.methods.includes('post'));
    expect(route).toBeDefined();
    // uploadAvatar middleware array + uploadAvatarHandler
    expect(route.middlewareCount).toBeGreaterThanOrEqual(2);
  });

  it('should define GET /search route', () => {
    const route = routes.find((r) => r.path === '/search' && r.methods.includes('get'));
    expect(route).toBeDefined();
    expect(route.middlewareCount).toBe(1);
  });

  it('should export router as default', () => {
    expect(router).toBeDefined();
    expect(typeof router).toBe('function');
  });
});
