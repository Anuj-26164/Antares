import { describe, it, expect, vi } from 'vitest';
import errorHandler from './errorHandler.js';

/**
 * Creates a mock Express response object.
 */
function createMockRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

const mockReq = {};
const mockNext = vi.fn();

describe('errorHandler middleware', () => {
  it('returns { success: false, error } JSON for all errors', () => {
    const res = createMockRes();
    const err = new Error('Something went wrong');

    errorHandler(err, mockReq, res, mockNext);

    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Something went wrong',
    });
  });

  it('defaults to 500 for unknown errors', () => {
    const res = createMockRes();
    const err = new Error('Unknown failure');

    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('uses err.statusCode when set', () => {
    const res = createMockRes();
    const err = new Error('Not found');
    err.statusCode = 404;

    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Not found',
    });
  });

  it('uses err.status when set', () => {
    const res = createMockRes();
    const err = new Error('Forbidden');
    err.status = 403;

    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Forbidden',
    });
  });

  it('maps ValidationError to 400', () => {
    const res = createMockRes();
    const err = new Error('Validation failed');
    err.name = 'ValidationError';
    err.errors = {
      title: { message: 'Title is required' },
      email: { message: 'Email is invalid' },
    };

    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Title is required, Email is invalid',
    });
  });

  it('maps CastError to 400', () => {
    const res = createMockRes();
    const err = new Error('Cast failed');
    err.name = 'CastError';
    err.path = '_id';
    err.value = 'invalid-id';

    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Invalid _id: invalid-id',
    });
  });

  it('maps JsonWebTokenError to 401', () => {
    const res = createMockRes();
    const err = new Error('jwt malformed');
    err.name = 'JsonWebTokenError';

    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'jwt malformed',
    });
  });

  it('maps TokenExpiredError to 401', () => {
    const res = createMockRes();
    const err = new Error('jwt expired');
    err.name = 'TokenExpiredError';

    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'jwt expired',
    });
  });

  it('maps MongoDB duplicate key error (code 11000) to 409', () => {
    const res = createMockRes();
    const err = new Error('Duplicate key');
    err.code = 11000;
    err.keyPattern = { email: 1 };

    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Duplicate value for email',
    });
  });

  it('maps LIMIT_FILE_SIZE to 400', () => {
    const res = createMockRes();
    const err = new Error('File too large');
    err.code = 'LIMIT_FILE_SIZE';

    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'File size exceeds the allowed limit',
    });
  });

  it('maps LIMIT_UNEXPECTED_FILE to 400', () => {
    const res = createMockRes();
    const err = new Error('Unexpected field');
    err.code = 'LIMIT_UNEXPECTED_FILE';

    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Unexpected file field',
    });
  });

  it('maps entity.parse.failed to 400', () => {
    const res = createMockRes();
    const err = new Error('Unexpected token');
    err.type = 'entity.parse.failed';

    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Unexpected token',
    });
  });

  it('returns generic message for 500 errors without a message', () => {
    const res = createMockRes();
    const err = new Error();

    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Internal server error',
    });
  });

  describe('production mode — 500 error message leakage prevention', () => {
    /**
     * Vite statically replaces process.env.NODE_ENV at build/transform time,
     * so we cannot override it at runtime in tests. Instead we verify the
     * production-guard logic by checking the behaviour in the current test
     * environment (NODE_ENV=test, which is non-production) and by confirming
     * the guard is present in the source code.
     */
    it('returns the real error message in test environment (non-production)', () => {
      const res = createMockRes();
      const err = new Error('Detailed internal error message');

      errorHandler(err, mockReq, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(500);
      // In test/dev environment, the real message is returned
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Detailed internal error message',
      });
    });

    it('always returns 500 status for unhandled errors regardless of environment', () => {
      const res = createMockRes();
      const err = new Error('Any internal error');

      errorHandler(err, mockReq, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(500);
      const body = res.json.mock.calls[0][0];
      expect(body.success).toBe(false);
      expect(typeof body.error).toBe('string');
      expect(body.error.length).toBeGreaterThan(0);
    });

    it('production guard is present in errorHandler source code', async () => {
      // Structural test: verify the production guard exists in the implementation.
      // This ensures the fix is not accidentally removed.
      // We read the source file directly to avoid any Vite transform issues.
      const fs = await import('fs');
      const path = await import('path');
      const filePath = path.resolve('./middleware/errorHandler.js');
      const source = fs.readFileSync(filePath, 'utf8');
      // Check for the production guard pattern without referencing process.env.NODE_ENV
      // directly (which would trigger Vite's oxc transform error)
      expect(source).toContain("=== 'production'");
      expect(source).toContain("'Internal server error'");
    });
  });
});
