import { Router } from 'express';
import passport from 'passport';
import {
  register,
  login,
  logout,
  refresh,
  googleCallback,
  exchangeToken,
} from '../controllers/authController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import createRateLimiter from '../middleware/rateLimiter.js';

const router = Router();

// Strict rate limiter for credential endpoints: 10 attempts per 15 minutes
const authLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10 });

// Slightly looser limiter for token refresh: 20 attempts per 15 minutes
const refreshLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 20 });

// POST /api/auth/register — Create account with email/password
router.post('/register', authLimiter, register);

// POST /api/auth/login — Login, receive JWT cookies
router.post('/login', authLimiter, login);

// POST /api/auth/logout — Invalidate refresh token, clear cookies (requires auth)
router.post('/logout', authMiddleware, logout);

// POST /api/auth/refresh — Refresh access token via refresh cookie
router.post('/refresh', refreshLimiter, refresh);

// POST /api/auth/session — Exchange a one-time token (from OAuth redirect) for cookies
router.post('/session', exchangeToken);

// GET /api/auth/google — Redirect to Google OAuth consent screen
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// GET /api/auth/google/callback — Handle Google OAuth callback
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  googleCallback
);

export default router;
