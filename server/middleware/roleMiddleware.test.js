import { describe, it, expect, vi } from 'vitest';
import { roleMiddleware } from './roleMiddleware.js';

describe('roleMiddleware', () => {
  function createMockRes() {
    const res = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res;
  }

  it('should call next() when user role is in allowedRoles', () => {
    const middleware = roleMiddleware('admin', 'photographer');
    const req = { user: { role: 'admin' } };
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should return 403 when user role is not in allowedRoles', () => {
    const middleware = roleMiddleware('admin', 'photographer');
    const req = { user: { role: 'viewer' } };
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Insufficient permissions'
    });
  });

  it('should return 403 when req.user is missing', () => {
    const middleware = roleMiddleware('admin');
    const req = {};
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Insufficient permissions'
    });
  });

  it('should allow club_member when club_member is in allowedRoles', () => {
    const middleware = roleMiddleware('admin', 'photographer', 'club_member');
    const req = { user: { role: 'club_member' } };
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should reject club_member when only admin is allowed', () => {
    const middleware = roleMiddleware('admin');
    const req = { user: { role: 'club_member' } };
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('should work with a single allowed role', () => {
    const middleware = roleMiddleware('photographer');
    const req = { user: { role: 'photographer' } };
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
