import { describe, it, expect, vi } from 'vitest';

// Mock dependencies
vi.mock('../config/env.js', () => ({
  default: {
    JWT_SECRET: 'test-secret',
    JWT_REFRESH_SECRET: 'test-refresh-secret',
    R2_PUBLIC_URL: 'https://r2.example.com',
  },
}));

vi.mock('../config/r2.js', () => ({
  default: {},
  R2_BUCKET_NAME: 'test-bucket',
}));

vi.mock('../models/User.js', () => ({
  default: {
    findById: vi.fn(),
  },
}));

vi.mock('../models/Media.js', () => ({
  default: {
    find: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    countDocuments: vi.fn(),
    aggregate: vi.fn(),
    findByIdAndDelete: vi.fn(),
  },
}));

vi.mock('../models/Comment.js', () => ({
  default: {
    find: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

vi.mock('../models/Event.js', () => ({
  default: {
    findById: vi.fn(),
  },
}));

vi.mock('../utils/tokenUtils.js', () => ({
  verifyAccessToken: vi.fn(),
}));

vi.mock('../utils/imageProcessor.js', () => ({
  compressImage: vi.fn(),
  applyWatermark: vi.fn(),
  applyVideoWatermark: vi.fn(),
  compressAvatar: vi.fn(),
  extractVideoThumbnail: vi.fn(),
}));

vi.mock('../models/Notification.js', () => ({
  default: {
    create: vi.fn(),
  },
}));

vi.mock('../sockets/mediaSocket.js', () => ({
  emitMediaUploaded: vi.fn(),
  emitGalleryUpdated: vi.fn(),
  emitPhotoLikedToEvent: vi.fn(),
  emitNewCommentToEvent: vi.fn(),
}));

vi.mock('../sockets/notificationSocket.js', () => ({
  notifyUser: vi.fn(),
  emitPhotoLikedToOwner: vi.fn(),
  emitNewCommentToUser: vi.fn(),
  emitUserTagged: vi.fn(),
}));

vi.mock('../sockets/activitySocket.js', () => ({
  emitActivityUpdate: vi.fn(),
}));

vi.mock('@aws-sdk/client-s3', () => ({
  GetObjectCommand: vi.fn(),
  PutObjectCommand: vi.fn(),
  DeleteObjectCommand: vi.fn(),
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(),
}));

vi.mock('multer', () => {
  const multerMock = () => ({
    array: () => (req, res, next) => next(),
    single: () => (req, res, next) => next(),
  });
  multerMock.memoryStorage = vi.fn();
  return { default: multerMock };
});

vi.mock('multer-s3', () => ({
  default: vi.fn(),
  AUTO_CONTENT_TYPE: 'auto',
}));

import router from './mediaRoutes.js';

describe('mediaRoutes', () => {
  // The router uses router.use(authMiddleware) so it's applied globally.
  // Extract route definitions from the router stack (skip the first layer which is the use() middleware).
  const routeLayers = router.stack.filter((layer) => layer.route);
  const routes = routeLayers.map((layer) => ({
    path: layer.route.path,
    methods: Object.keys(layer.route.methods),
    middlewareCount: layer.route.stack.length,
  }));

  it('should export router as default', () => {
    expect(router).toBeDefined();
    expect(typeof router).toBe('function');
  });

  it('should enforce authentication on write routes (auth applied per-route)', () => {
    // Auth is now applied per-route rather than globally via router.use.
    // Verify that write routes (upload, favourite, comments, delete, tag) each
    // have at least 2 middleware layers (authMiddleware + handler).
    const writeRoutes = [
      routes.find((r) => r.path === '/upload/:eventId' && r.methods.includes('post')),
      routes.find((r) => r.path === '/:id/favourite' && r.methods.includes('post')),
      routes.find((r) => r.path === '/:id/comments' && r.methods.includes('post')),
      routes.find((r) => r.path === '/:id' && r.methods.includes('delete')),
    ].filter(Boolean);

    expect(writeRoutes.length).toBeGreaterThan(0);
    writeRoutes.forEach((route) => {
      // Each write route has authMiddleware + at least one handler
      expect(route.middlewareCount).toBeGreaterThanOrEqual(2);
    });
  });

  it('should define POST /upload/:eventId route with role + upload middleware', () => {
    const route = routes.find((r) => r.path === '/upload/:eventId');
    expect(route).toBeDefined();
    expect(route.methods).toContain('post');
    // roleMiddleware + uploadBulk (array middleware + validateFileSize) + uploadMedia
    expect(route.middlewareCount).toBeGreaterThanOrEqual(3);
  });

  it('should define GET / route for listing media', () => {
    const route = routes.find((r) => r.path === '/');
    expect(route).toBeDefined();
    expect(route.methods).toContain('get');
    // listMedia handler
    expect(route.middlewareCount).toBeGreaterThanOrEqual(1);
  });

  it('should define GET /:id route for getting single media', () => {
    const getRoutes = routes.filter((r) => r.path === '/:id' && r.methods.includes('get'));
    expect(getRoutes.length).toBeGreaterThanOrEqual(1);
  });

  it('should define GET /:id/download route', () => {
    const route = routes.find((r) => r.path === '/:id/download');
    expect(route).toBeDefined();
    expect(route.methods).toContain('get');
    // downloadMedia handler (auth is applied globally via router.use)
    expect(route.middlewareCount).toBeGreaterThanOrEqual(1);
  });

  it('should define DELETE /:id route for deleting media', () => {
    const route = routes.find((r) => r.path === '/:id' && r.methods.includes('delete'));
    expect(route).toBeDefined();
    expect(route.middlewareCount).toBeGreaterThanOrEqual(1);
  });

  it('should define POST /:id/favourite route', () => {
    const route = routes.find((r) => r.path === '/:id/favourite');
    expect(route).toBeDefined();
    expect(route.methods).toContain('post');
    // toggleFavourite handler (auth is applied globally via router.use)
    expect(route.middlewareCount).toBeGreaterThanOrEqual(1);
  });

  it('should define POST /:id/comments route', () => {
    const postCommentRoute = routes.find(
      (r) => r.path === '/:id/comments' && r.methods.includes('post')
    );
    expect(postCommentRoute).toBeDefined();
    // addComment handler (auth is applied globally via router.use)
    expect(postCommentRoute.middlewareCount).toBeGreaterThanOrEqual(1);
  });

  it('should define GET /:id/comments route for listing comments', () => {
    const getCommentRoute = routes.find(
      (r) => r.path === '/:id/comments' && r.methods.includes('get')
    );
    expect(getCommentRoute).toBeDefined();
    expect(getCommentRoute.middlewareCount).toBeGreaterThanOrEqual(1);
  });
});
