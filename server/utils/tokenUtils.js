/**
 * JWT token utilities for authentication.
 * Provides helpers to generate, verify, and manage JWT tokens
 * stored in httpOnly cookies.
 */

import jwt from 'jsonwebtoken';
import config from '../config/env.js';

/**
 * Generates a short-lived access token.
 * @param {string} userId - The user's MongoDB ObjectId as a string.
 * @returns {string} Signed JWT access token with 15-minute expiry.
 */
export function generateAccessToken(userId) {
  return jwt.sign({ userId }, config.JWT_SECRET, { expiresIn: '1d' });
}

/**
 * Generates a long-lived refresh token.
 * @param {string} userId - The user's MongoDB ObjectId as a string.
 * @returns {string} Signed JWT refresh token with 7-day expiry.
 */
export function generateRefreshToken(userId) {
  return jwt.sign({ userId }, config.JWT_REFRESH_SECRET, { expiresIn: '7d' });
}

/**
 * Verifies an access token and extracts the payload.
 * @param {string} token - The JWT access token to verify.
 * @returns {{ userId: string }} Decoded payload containing the userId.
 * @throws {JsonWebTokenError|TokenExpiredError} If the token is invalid or expired.
 */
export function verifyAccessToken(token) {
  const decoded = jwt.verify(token, config.JWT_SECRET);
  return { userId: decoded.userId };
}

/**
 * Verifies a refresh token and extracts the payload.
 * @param {string} token - The JWT refresh token to verify.
 * @returns {{ userId: string }} Decoded payload containing the userId.
 * @throws {JsonWebTokenError|TokenExpiredError} If the token is invalid or expired.
 */
export function verifyRefreshToken(token) {
  const decoded = jwt.verify(token, config.JWT_REFRESH_SECRET);
  return { userId: decoded.userId };
}

/**
 * Sets access and refresh tokens as httpOnly cookies on the response.
 * @param {import('express').Response} res - Express response object.
 * @param {string} accessToken - The JWT access token.
 * @param {string} refreshToken - The JWT refresh token.
 */
export function setAuthCookies(res, accessToken, refreshToken) {
  const isProduction = process.env.NODE_ENV === 'production';

  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: isProduction,
    // 'none' required for cross-origin requests (frontend/backend on different domains).
    // Falls back to 'strict' in local dev where both run on localhost.
    sameSite: isProduction ? 'none' : 'strict',
    maxAge: 24 * 60 * 60 * 1000, // 1 day
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

/**
 * Clears both authentication cookies from the response.
 * @param {import('express').Response} res - Express response object.
 */
export function clearAuthCookies(res) {
  const isProduction = process.env.NODE_ENV === 'production';

  res.clearCookie('accessToken', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'strict',
  });

  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'strict',
  });
}
