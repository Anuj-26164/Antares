/**
 * Global Express error handler middleware.
 * Catches all errors passed via next(err) and returns a consistent
 * JSON error response: { success: false, error: message }.
 *
 * Maps known error types/names to appropriate HTTP status codes;
 * defaults to 500 for unrecognized errors.
 */

/**
 * @param {Error} err - The error object
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Express next function
 */
export default function errorHandler(err, req, res, next) {
  const statusCode = getStatusCode(err);
  const message = getMessage(err, statusCode);

  // Log 500 errors server-side so details are never lost even when hidden from clients
  if (statusCode === 500) {
    console.error('[errorHandler] Unhandled error:', err);
  }

  res.status(statusCode).json({
    success: false,
    error: message,
  });
}

/**
 * Determines the HTTP status code from the error.
 * Maps known error types/names to their corresponding codes.
 *
 * @param {Error} err
 * @returns {number}
 */
function getStatusCode(err) {
  // Explicit statusCode set on the error (common Express pattern)
  if (err.statusCode && typeof err.statusCode === 'number') {
    return err.statusCode;
  }

  // Explicit status property (alternative pattern)
  if (err.status && typeof err.status === 'number') {
    return err.status;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    return 400;
  }

  // Mongoose CastError (invalid ObjectId, etc.)
  if (err.name === 'CastError') {
    return 400;
  }

  // JSON parse errors (malformed request body)
  if (err.type === 'entity.parse.failed') {
    return 400;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return 401;
  }

  if (err.name === 'TokenExpiredError') {
    return 401;
  }

  // MongoDB duplicate key error
  if (err.code === 11000) {
    return 409;
  }

  // Multer file size/type errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return 400;
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return 400;
  }

  // Default to 500 for unknown errors
  return 500;
}

/**
 * Extracts a human-readable message from the error.
 * For 500 errors in production, always returns a generic message to prevent
 * leaking internal details (stack traces, DB connection strings, file paths).
 * In non-production environments the actual message is returned for debugging.
 *
 * @param {Error} err
 * @param {number} statusCode
 * @returns {string}
 */
function getMessage(err, statusCode) {
  // For server errors, don't leak internal details in production
  if (statusCode === 500) {
    if (process.env.NODE_ENV === 'production') {
      return 'Internal server error';
    }
    return err.message || 'Internal server error';
  }

  // Mongoose validation: collect field-level messages
  if (err.name === 'ValidationError' && err.errors) {
    const messages = Object.values(err.errors).map((e) => e.message);
    return messages.join(', ');
  }

  // Mongoose CastError
  if (err.name === 'CastError') {
    return `Invalid ${err.path}: ${err.value}`;
  }

  // MongoDB duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    return `Duplicate value for ${field}`;
  }

  // Multer file size
  if (err.code === 'LIMIT_FILE_SIZE') {
    return 'File size exceeds the allowed limit';
  }

  // Multer unexpected file
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return 'Unexpected file field';
  }

  return err.message || 'An error occurred';
}
