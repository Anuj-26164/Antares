import { verifyAccessToken } from '../utils/tokenUtils.js';
import User from '../models/User.js';

/**
 * Express middleware that authenticates requests via JWT access token.
 * Extracts the token from the `accessToken` httpOnly cookie, verifies it,
 * fetches the user from the database, and attaches it to `req.user`.
 *
 * On missing or invalid token, responds with 401 and a JSON error.
 */
async function authMiddleware(req, res, next) {
  try {
    const token = req.cookies?.accessToken;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const { userId } = verifyAccessToken(token);

    const user = await User.findById(userId).select('-password -refreshToken');

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        error: 'Your account has been blocked. Please contact the administrator.',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
    });
  }
}

export default authMiddleware;

/**
 * Optional auth middleware — attaches req.user if a valid token is present,
 * but does NOT block the request if no token exists.
 * Used for public endpoints that behave differently for logged-in users.
 */
export async function optionalAuth(req, res, next) {
  try {
    const token = req.cookies?.accessToken;
    if (!token) return next(); // unauthenticated — continue without req.user

    const { userId } = verifyAccessToken(token);
    const user = await User.findById(userId).select('-password -refreshToken');
    if (user && !user.isBlocked) {
      req.user = user;
    }
  } catch {
    // Invalid token — treat as unauthenticated, don't block
  }
  next();
}
