import rateLimit from 'express-rate-limit';

/**
 * Factory function that creates a rate limiter middleware.
 * @param {Object} options
 * @param {number} [options.windowMs=60000] - Time window in milliseconds
 * @param {number} [options.max=100] - Maximum requests per window
 * @returns {Function} Express rate limiter middleware
 */
export default function createRateLimiter({ windowMs = 60000, max = 100 } = {}) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        success: false,
        error: 'Too many requests. Try again later.'
      });
    }
  });
}
