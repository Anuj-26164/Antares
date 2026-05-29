/**
 * Creates a minimal Express app for integration tests.
 * Provides both a standard app and an authenticated app variant.
 */
import express from 'express';
import cookieParser from 'cookie-parser';
import authRoutes from '../../routes/authRoutes.js';
import eventRoutes from '../../routes/eventRoutes.js';
import mediaRoutes from '../../routes/mediaRoutes.js';
import userRoutes from '../../routes/userRoutes.js';
import notificationRoutes from '../../routes/notificationRoutes.js';
import errorHandler from '../../middleware/errorHandler.js';

export function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.use('/api/events', eventRoutes);
  app.use('/api/media', mediaRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use(errorHandler);
  return app;
}

/**
 * Creates an app with a pre-injected authenticated user.
 * Injects req.user AND overrides the auth middleware check so routes
 * that use router.use(authMiddleware) still pass through.
 */
export function createAuthenticatedApp(user) {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  // Inject user AND a fake auth cookie so authMiddleware passes
  app.use((req, res, next) => {
    req.user = user;
    // Set a fake cookie so authMiddleware's token check passes
    req.cookies = req.cookies || {};
    req.cookies.accessToken = 'test-token';
    next();
  });

  app.use('/api/events', eventRoutes);
  app.use('/api/media', mediaRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use(errorHandler);
  return app;
}
