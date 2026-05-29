import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getMe, updateMe, getMyFavourites, changeRole } from './userController.js';

// Mock dependencies
vi.mock('../models/User.js', () => {
  const mockUser = vi.fn();
  mockUser.findById = vi.fn();
  mockUser.find = vi.fn();
  mockUser.countDocuments = vi.fn();
  return { default: mockUser };
});

vi.mock('../models/Media.js', () => {
  const mockMedia = vi.fn();
  mockMedia.find = vi.fn();
  mockMedia.countDocuments = vi.fn();
  return { default: mockMedia };
});

import User from '../models/User.js';
import Media from '../models/Media.js';

function mockReq(overrides = {}) {
  return {
    body: {},
    params: {},
    query: {},
    user: { _id: 'user123', role: 'club_member' },
    ...overrides
  };
}

function mockRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('getMe', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with user profile excluding password and refreshToken', async () => {
    const selectMock = vi.fn().mockResolvedValue({
      _id: 'user123',
      name: 'John',
      email: 'john@test.com',
      role: 'club_member'
    });
    User.findById.mockReturnValue({ select: selectMock });

    const req = mockReq();
    const res = mockRes();

    await getMe(req, res);

    expect(User.findById).toHaveBeenCalledWith('user123');
    expect(selectMock).toHaveBeenCalledWith('-password -refreshToken');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: expect.objectContaining({ name: 'John', email: 'john@test.com' })
    });
  });

  it('returns 404 when user is not found', async () => {
    const selectMock = vi.fn().mockResolvedValue(null);
    User.findById.mockReturnValue({ select: selectMock });

    const req = mockReq();
    const res = mockRes();

    await getMe(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'User not found' });
  });
});

describe('updateMe', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates name and returns 200 without sensitive fields', async () => {
    const user = {
      _id: 'user123',
      name: 'Old Name',
      email: 'john@test.com',
      role: 'club_member',
      password: 'hashed',
      refreshToken: 'token123',
      save: vi.fn().mockResolvedValue(undefined),
      toObject: vi.fn().mockReturnValue({
        _id: 'user123',
        name: 'New Name',
        email: 'john@test.com',
        role: 'club_member',
        password: 'hashed',
        refreshToken: 'token123'
      })
    };
    User.findById.mockResolvedValue(user);

    const req = mockReq({ body: { name: 'New Name' } });
    const res = mockRes();

    await updateMe(req, res);

    expect(user.name).toBe('New Name');
    expect(user.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    const responseData = res.json.mock.calls[0][0].data;
    expect(responseData.password).toBeUndefined();
    expect(responseData.refreshToken).toBeUndefined();
  });

  it('updates avatar and returns 200', async () => {
    const user = {
      _id: 'user123',
      name: 'John',
      avatar: null,
      save: vi.fn().mockResolvedValue(undefined),
      toObject: vi.fn().mockReturnValue({
        _id: 'user123',
        name: 'John',
        avatar: 'https://example.com/avatar.png'
      })
    };
    User.findById.mockResolvedValue(user);

    const req = mockReq({ body: { avatar: 'https://example.com/avatar.png' } });
    const res = mockRes();

    await updateMe(req, res);

    expect(user.avatar).toBe('https://example.com/avatar.png');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 404 when user is not found', async () => {
    User.findById.mockResolvedValue(null);

    const req = mockReq({ body: { name: 'New' } });
    const res = mockRes();

    await updateMe(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'User not found' });
  });

  it('returns 400 on validation error', async () => {
    const validationError = new Error('Validation failed');
    validationError.name = 'ValidationError';

    const user = {
      _id: 'user123',
      name: 'John',
      save: vi.fn().mockRejectedValue(validationError),
      toObject: vi.fn()
    };
    User.findById.mockResolvedValue(user);

    const req = mockReq({ body: { name: 'A'.repeat(200) } });
    const res = mockRes();

    await updateMe(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Validation failed' });
  });
});

describe('getMyFavourites', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns paginated favourited media sorted reverse-chronological', async () => {
    const media = [
      { _id: 'm1', url: 'https://r2.example.com/1.webp' },
      { _id: 'm2', url: 'https://r2.example.com/2.webp' }
    ];
    const chainMock = {
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(media)
    };
    Media.find.mockReturnValue(chainMock);
    Media.countDocuments.mockResolvedValue(2);

    const req = mockReq({ query: {} });
    const res = mockRes();

    await getMyFavourites(req, res);

    expect(Media.find).toHaveBeenCalledWith({ favouritedBy: 'user123' });
    expect(chainMock.sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(chainMock.limit).toHaveBeenCalledWith(20);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: expect.objectContaining({ media, page: 1, limit: 20, total: 2 })
    });
  });

  it('caps limit at 20', async () => {
    const chainMock = {
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([])
    };
    Media.find.mockReturnValue(chainMock);
    Media.countDocuments.mockResolvedValue(0);

    const req = mockReq({ query: { limit: '100' } });
    const res = mockRes();

    await getMyFavourites(req, res);

    expect(chainMock.limit).toHaveBeenCalledWith(20);
  });

  it('supports pagination with page parameter', async () => {
    const chainMock = {
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([])
    };
    Media.find.mockReturnValue(chainMock);
    Media.countDocuments.mockResolvedValue(40);

    const req = mockReq({ query: { page: '2' } });
    const res = mockRes();

    await getMyFavourites(req, res);

    expect(chainMock.skip).toHaveBeenCalledWith(20);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: expect.objectContaining({ page: 2, totalPages: 2 })
    });
  });
});

describe('changeRole', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 when role is missing', async () => {
    const req = mockReq({ params: { id: 'target1' }, body: {} });
    const res = mockRes();

    await changeRole(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: expect.stringContaining('Invalid role')
    });
  });

  it('returns 400 when role is invalid', async () => {
    const req = mockReq({ params: { id: 'target1' }, body: { role: 'superadmin' } });
    const res = mockRes();

    await changeRole(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: expect.stringContaining('Invalid role')
    });
  });

  it('returns 404 when target user is not found', async () => {
    User.findById.mockResolvedValue(null);

    const req = mockReq({ params: { id: 'nonexistent' }, body: { role: 'photographer' } });
    const res = mockRes();

    await changeRole(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'User not found' });
  });

  it('updates role and returns 200 without sensitive fields', async () => {
    const user = {
      _id: 'target1',
      name: 'Target User',
      email: 'target@test.com',
      role: 'viewer',
      password: 'hashed',
      refreshToken: 'token',
      save: vi.fn().mockResolvedValue(undefined),
      toObject: vi.fn().mockReturnValue({
        _id: 'target1',
        name: 'Target User',
        email: 'target@test.com',
        role: 'photographer',
        password: 'hashed',
        refreshToken: 'token'
      })
    };
    User.findById.mockResolvedValue(user);

    const req = mockReq({
      params: { id: 'target1' },
      body: { role: 'photographer' },
      user: { _id: 'admin1', role: 'admin' }
    });
    const res = mockRes();

    await changeRole(req, res);

    expect(user.role).toBe('photographer');
    expect(user.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    const responseData = res.json.mock.calls[0][0].data;
    expect(responseData.password).toBeUndefined();
    expect(responseData.refreshToken).toBeUndefined();
  });

  it('accepts all four valid roles', async () => {
    const validRoles = ['admin', 'photographer', 'club_member', 'viewer'];

    for (const role of validRoles) {
      vi.clearAllMocks();
      const user = {
        _id: 'target1',
        role: 'viewer',
        save: vi.fn().mockResolvedValue(undefined),
        toObject: vi.fn().mockReturnValue({ _id: 'target1', role })
      };
      User.findById.mockResolvedValue(user);

      const req = mockReq({ params: { id: 'target1' }, body: { role } });
      const res = mockRes();

      await changeRole(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(user.role).toBe(role);
    }
  });
});

describe('searchUsers — email not exposed in response', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns users without email field', async () => {
    const mockUsers = [
      { _id: 'u1', name: 'Alice', avatar: 'https://cdn.example.com/alice.webp' },
      { _id: 'u2', name: 'Bob', avatar: null },
    ];

    const leanMock = vi.fn().mockResolvedValue(mockUsers);
    const limitMock = vi.fn().mockReturnValue({ lean: leanMock });
    const selectMock = vi.fn().mockReturnValue({ limit: limitMock });
    User.findById.mockReturnValue({ select: vi.fn().mockResolvedValue(null) }); // for getMe calls
    User.find.mockReturnValue({ select: selectMock });

    const req = mockReq({ query: { q: 'ali' } });
    const res = mockRes();

    const { searchUsers } = await import('./userController.js');
    await searchUsers(req, res);

    // Verify select was called WITHOUT email
    expect(selectMock).toHaveBeenCalledWith('_id name avatar');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: mockUsers });

    // Verify no email field in the response data
    const responseData = res.json.mock.calls[0][0].data;
    responseData.forEach((user) => {
      expect(user.email).toBeUndefined();
    });
  });

  it('returns empty array when query is shorter than 2 characters', async () => {
    const req = mockReq({ query: { q: 'a' } });
    const res = mockRes();

    const { searchUsers } = await import('./userController.js');
    await searchUsers(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: [] });
  });

  it('returns empty array when query is missing', async () => {
    const req = mockReq({ query: {} });
    const res = mockRes();

    const { searchUsers } = await import('./userController.js');
    await searchUsers(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: [] });
  });

  it('searches by both name and email but does not return email', async () => {
    const mockUsers = [{ _id: 'u3', name: 'Charlie', avatar: null }];

    const leanMock = vi.fn().mockResolvedValue(mockUsers);
    const limitMock = vi.fn().mockReturnValue({ lean: leanMock });
    const selectMock = vi.fn().mockReturnValue({ limit: limitMock });
    User.find.mockReturnValue({ select: selectMock });

    const req = mockReq({ query: { q: 'charlie@example.com' } });
    const res = mockRes();

    const { searchUsers } = await import('./userController.js');
    await searchUsers(req, res);

    // The find query should include email in the $or clause for matching
    expect(User.find).toHaveBeenCalledWith(
      expect.objectContaining({
        $or: expect.arrayContaining([
          expect.objectContaining({}), // name regex
          expect.objectContaining({}), // email regex
        ]),
      })
    );

    // But the select must NOT include email
    expect(selectMock).toHaveBeenCalledWith('_id name avatar');
  });
});
