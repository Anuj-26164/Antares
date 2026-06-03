/**
 * Authentication controller.
 * Handles user registration, login, logout, token refresh,
 * and Google OAuth callback.
 */

import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  setAuthCookies,
  clearAuthCookies,
} from '../utils/tokenUtils.js';
import config from '../config/env.js';

/** Email regex matching the User model validation pattern. */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Register a new user with email and password.
 * Validates email format and password length (8–128 chars),
 * hashes password with bcrypt (saltRounds 12), creates user.
 *
 * @route POST /api/auth/register
 * @returns 201 { success: true, data: user }
 * @returns 400 on validation failure
 * @returns 409 on duplicate email
 */
export async function register(req, res) {
  try {
    const { name, email, password } = req.body;

    // Validate email format
    if (!email || !EMAIL_REGEX.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format',
      });
    }

    // Validate password length
    if (!password || password.length < 8 || password.length > 128) {
      return res.status(400).json({
        success: false,
        error: 'Password must be between 8 and 128 characters',
      });
    }

    // Validate name
    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Name is required',
      });
    }

    // Check for existing user with same email
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'Email is already registered',
      });
    }

    // Hash password with bcrypt saltRounds 12
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await User.create({
      name: name.trim(),
      email,
      password: hashedPassword,
    });

    // Issue tokens so the user is immediately authenticated after registration
    const accessToken = generateAccessToken(user._id.toString());
    const refreshToken = generateRefreshToken(user._id.toString());

    // Store refresh token on user document
    user.refreshToken = refreshToken;
    await user.save();

    // Set auth cookies — same as login
    setAuthCookies(res, accessToken, refreshToken);

    // Return user without password
    const userResponse = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      createdAt: user.createdAt,
    };

    return res.status(201).json({
      success: true,
      data: userResponse,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Registration failed',
    });
  }
}

/**
 * Login with email and password.
 * Finds user by email, compares password with bcrypt,
 * issues tokens via tokenUtils, sets cookies.
 *
 * @route POST /api/auth/login
 * @returns 200 { success: true, data: user }
 * @returns 400 on validation failure
 * @returns 401 on invalid credentials (generic message)
 */
export async function login(req, res) {
  try {
    const { email, password } = req.body;

    // Validate email format
    if (!email || !EMAIL_REGEX.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format',
      });
    }

    // Validate password presence and length
    if (!password || password.length < 8 || password.length > 128) {
      return res.status(400).json({
        success: false,
        error: 'Password must be between 8 and 128 characters',
      });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user || !user.password) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
    }

    // Check if user is blocked
    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        error: 'Your account has been blocked. Please contact the administrator.',
      });
    }

    // Compare password with bcrypt
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
    }

    // Issue tokens
    const accessToken = generateAccessToken(user._id.toString());
    const refreshToken = generateRefreshToken(user._id.toString());

    // Store refresh token on user document
    user.refreshToken = refreshToken;
    await user.save();

    // Set cookies
    setAuthCookies(res, accessToken, refreshToken);

    // Return user without password
    const userResponse = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      createdAt: user.createdAt,
    };

    return res.status(200).json({
      success: true,
      data: userResponse,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Login failed',
    });
  }
}

/**
 * Logout the current user.
 * Clears cookies and nullifies refreshToken on User document.
 *
 * @route POST /api/auth/logout
 * @returns 200 { success: true, data: { message } }
 */
export async function logout(req, res) {
  try {
    // Nullify refresh token on user document
    if (req.user) {
      await User.findByIdAndUpdate(req.user._id, { refreshToken: null });
    }

    // Clear auth cookies
    clearAuthCookies(res);

    return res.status(200).json({
      success: true,
      data: { message: 'Logged out successfully' },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Logout failed',
    });
  }
}

/**
 * Refresh the access token using the refresh cookie.
 * Verifies refresh token, finds user, issues new access token.
 *
 * @route POST /api/auth/refresh
 * @returns 200 { success: true, data: { accessToken } }
 * @returns 401 on invalid/expired token
 */
export async function refresh(req, res) {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        error: 'Refresh token not found',
      });
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (err) {
      clearAuthCookies(res);
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired refresh token',
      });
    }

    // Find user and verify stored refresh token matches
    const user = await User.findById(decoded.userId);
    if (!user || user.refreshToken !== refreshToken) {
      clearAuthCookies(res);
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired refresh token',
      });
    }

    // Check if user is blocked
    if (user.isBlocked) {
      clearAuthCookies(res);
      return res.status(403).json({
        success: false,
        error: 'Your account has been blocked. Please contact the administrator.',
      });
    }

    // Issue new access token
    const newAccessToken = generateAccessToken(user._id.toString());

    // Set updated access token cookie
    setAuthCookies(res, newAccessToken, refreshToken);

    return res.status(200).json({
      success: true,
      data: { accessToken: newAccessToken },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Token refresh failed',
    });
  }
}

/**
 * Exchange a short-lived token (passed via OAuth redirect query param) for
 * proper httpOnly cookies. Called by the frontend immediately after Google
 * OAuth redirects back with ?token=...
 *
 * @route POST /api/auth/session
 * @body { token: string }
 * @returns 200 { success: true, data: user }
 * @returns 401 on invalid token
 */
export async function exchangeToken(req, res) {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(401).json({ success: false, error: 'Token required' });
    }

    // Verify the access token
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch {
      return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }

    const user = await User.findById(decoded.userId).select('-password -refreshToken');
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    if (user.isBlocked) {
      return res.status(403).json({ success: false, error: 'Account blocked' });
    }

    // Issue fresh tokens and set cookies now that we're in a direct API call
    // (cookies set here will be accepted by the browser for this domain)
    const accessToken = generateAccessToken(user._id.toString());
    const refreshToken = generateRefreshToken(user._id.toString());

    await User.findByIdAndUpdate(user._id, { refreshToken });
    setAuthCookies(res, accessToken, refreshToken);

    return res.status(200).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Session exchange failed' });
  }
}

/**
 * Google OAuth callback handler.
 * Called after Passport success; issues tokens, sets cookies,
 * redirects to CLIENT_URL. On failure redirects to login with error.
 *
 * @route GET /api/auth/google/callback
 */
export async function googleCallback(req, res) {
  try {
    // Passport attaches user on success
    if (!req.user) {
      return res.redirect(
        `${config.CLIENT_URL}/login?error=google_auth_failed`
      );
    }

    const user = req.user;

    // Check if user is blocked
    if (user.isBlocked) {
      return res.redirect(
        `${config.CLIENT_URL}/login?error=account_blocked`
      );
    }

    // Issue tokens
    const accessToken = generateAccessToken(user._id.toString());
    const refreshToken = generateRefreshToken(user._id.toString());

    // Store refresh token on user document
    user.refreshToken = refreshToken;
    await user.save();

    // Set cookies
    setAuthCookies(res, accessToken, refreshToken);

    // Redirect to client — admins go to /admin, others to /gallery
    // Pass the access token as a query param so the frontend can bootstrap
    // the session even though the cookie was set on a different domain.
    const redirectPath = user.role === 'admin' ? '/admin' : '/gallery';
    return res.redirect(`${config.CLIENT_URL}${redirectPath}?token=${accessToken}`);
  } catch (error) {
    return res.redirect(
      `${config.CLIENT_URL}/login?error=google_auth_failed`
    );
  }
}
