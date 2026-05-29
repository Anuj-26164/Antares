import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEvent, listEvents, getEvent, updateEvent, deleteEvent } from './eventController.js';

// Mock dependencies
vi.mock('../models/Event.js', () => {
  const mockEvent = vi.fn();
  mockEvent.find = vi.fn();
  mockEvent.findById = vi.fn();
  mockEvent.findByIdAndDelete = vi.fn();
  mockEvent.countDocuments = vi.fn();
  mockEvent.deleteMany = vi.fn();
  return { default: mockEvent };
});

vi.mock('../models/Media.js', () => {
  const mockMedia = vi.fn();
  mockMedia.find = vi.fn();
  mockMedia.deleteMany = vi.fn();
  return { default: mockMedia };
});

vi.mock('../models/Comment.js', () => {
  const mockComment = vi.fn();
  mockComment.deleteMany = vi.fn();
  return { default: mockComment };
});

vi.mock('../config/r2.js', () => ({
  default: { send: vi.fn() },
  R2_BUCKET_NAME: 'test-bucket'
}));

vi.mock('@aws-sdk/client-s3', () => ({
  DeleteObjectCommand: vi.fn()
}));

import Event from '../models/Event.js';
import Media from '../models/Media.js';
import Comment from '../models/Comment.js';
import r2Client from '../config/r2.js';

function mockReq(overrides = {}) {
  return {
    body: {},
    params: {},
    query: {},
    user: { _id: 'user123', role: 'photographer' },
    ...overrides
  };
}

function mockRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('createEvent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 when title is missing', async () => {
    const req = mockReq({ body: {} });
    const res = mockRes();

    await createEvent(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Title is required'
    });
  });

  it('returns 400 when title is empty string', async () => {
    const req = mockReq({ body: { title: '   ' } });
    const res = mockRes();

    await createEvent(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Title is required'
    });
  });

  it('returns 201 with created event on valid input', async () => {
    const savedEvent = { _id: 'evt1', title: 'Test Event', createdBy: 'user123' };
    Event.mockImplementation(function (data) {
      Object.assign(this, data);
      this.save = vi.fn().mockResolvedValue(undefined);
      Object.assign(this, savedEvent);
    });

    const req = mockReq({ body: { title: 'Test Event' } });
    const res = mockRes();

    await createEvent(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: expect.objectContaining({ title: 'Test Event' })
    });
  });

  it('sets createdBy to req.user._id', async () => {
    let capturedData;
    Event.mockImplementation(function (data) {
      capturedData = data;
      Object.assign(this, data);
      this.save = vi.fn().mockResolvedValue(undefined);
    });

    const req = mockReq({ body: { title: 'My Event' }, user: { _id: 'abc999', role: 'admin' } });
    const res = mockRes();

    await createEvent(req, res);

    expect(capturedData.createdBy).toBe('abc999');
  });

  it('returns 400 on mongoose validation error', async () => {
    const validationError = new Error('Validation failed');
    validationError.name = 'ValidationError';

    Event.mockImplementation(function (data) {
      Object.assign(this, data);
      this.save = vi.fn().mockRejectedValue(validationError);
    });

    const req = mockReq({ body: { title: 'X' } });
    const res = mockRes();

    await createEvent(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Validation failed'
    });
  });
});

describe('listEvents', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns paginated events with default page size 20', async () => {
    const events = [{ _id: 'e1', title: 'Event 1' }];
    const chainMock = {
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(events)
    };
    Event.find.mockReturnValue(chainMock);
    Event.countDocuments.mockResolvedValue(1);

    const req = mockReq({ query: {} });
    const res = mockRes();

    await listEvents(req, res);

    expect(chainMock.limit).toHaveBeenCalledWith(20);
    expect(chainMock.skip).toHaveBeenCalledWith(0);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: expect.objectContaining({ events, page: 1, limit: 20, total: 1 })
    });
  });

  it('caps limit at 100', async () => {
    const chainMock = {
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([])
    };
    Event.find.mockReturnValue(chainMock);
    Event.countDocuments.mockResolvedValue(0);

    const req = mockReq({ query: { limit: '500' } });
    const res = mockRes();

    await listEvents(req, res);

    expect(chainMock.limit).toHaveBeenCalledWith(100);
  });

  it('admin sees all events (no filter)', async () => {
    const chainMock = {
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([])
    };
    Event.find.mockReturnValue(chainMock);
    Event.countDocuments.mockResolvedValue(0);

    const req = mockReq({ query: {}, user: { _id: 'admin1', role: 'admin' } });
    const res = mockRes();

    await listEvents(req, res);

    expect(Event.find).toHaveBeenCalledWith({});
  });

  it('non-admin sees public events + own private events', async () => {
    const chainMock = {
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([])
    };
    Event.find.mockReturnValue(chainMock);
    Event.countDocuments.mockResolvedValue(0);

    const req = mockReq({ query: {}, user: { _id: 'user1', role: 'club_member' } });
    const res = mockRes();

    await listEvents(req, res);

    expect(Event.find).toHaveBeenCalledWith({
      $or: [
        { isPublic: true },
        { createdBy: 'user1' }
      ]
    });
  });
});

describe('getEvent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 404 when event does not exist', async () => {
    Event.findById.mockResolvedValue(null);

    const req = mockReq({ params: { id: 'nonexistent' } });
    const res = mockRes();

    await getEvent(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Event not found' });
  });

  it('returns 200 with public event', async () => {
    const event = { _id: 'e1', title: 'Public', isPublic: true, createdBy: { toString: () => 'other' } };
    Event.findById.mockResolvedValue(event);

    const req = mockReq({ params: { id: 'e1' } });
    const res = mockRes();

    await getEvent(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: event });
  });

  it('returns 404 for private event when user is not creator or admin', async () => {
    const event = { _id: 'e1', title: 'Private', isPublic: false, createdBy: { toString: () => 'otherUser' } };
    Event.findById.mockResolvedValue(event);

    const req = mockReq({ params: { id: 'e1' }, user: { _id: { toString: () => 'user123' }, role: 'viewer' } });
    const res = mockRes();

    await getEvent(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 200 for private event when user is creator', async () => {
    const event = { _id: 'e1', title: 'Private', isPublic: false, createdBy: { toString: () => 'user123' } };
    Event.findById.mockResolvedValue(event);

    const req = mockReq({ params: { id: 'e1' }, user: { _id: { toString: () => 'user123' }, role: 'photographer' } });
    const res = mockRes();

    await getEvent(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: event });
  });
});

describe('updateEvent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 404 when event does not exist', async () => {
    Event.findById.mockResolvedValue(null);

    const req = mockReq({ params: { id: 'nonexistent' }, body: { title: 'New' } });
    const res = mockRes();

    await updateEvent(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 403 when user is not admin or creator', async () => {
    const event = { _id: 'e1', createdBy: { toString: () => 'otherUser' }, save: vi.fn() };
    Event.findById.mockResolvedValue(event);

    const req = mockReq({
      params: { id: 'e1' },
      body: { title: 'Hacked' },
      user: { _id: { toString: () => 'user123' }, role: 'club_member' }
    });
    const res = mockRes();

    await updateEvent(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Insufficient permissions' });
  });

  it('updates only mutable fields and returns 200', async () => {
    const event = {
      _id: 'e1',
      title: 'Old',
      createdBy: { toString: () => 'user123' },
      save: vi.fn().mockResolvedValue(undefined)
    };
    Event.findById.mockResolvedValue(event);

    const req = mockReq({
      params: { id: 'e1' },
      body: { title: 'New Title', description: 'Updated', createdBy: 'hacker' },
      user: { _id: { toString: () => 'user123' }, role: 'photographer' }
    });
    const res = mockRes();

    await updateEvent(req, res);

    expect(event.title).toBe('New Title');
    expect(event.description).toBe('Updated');
    // createdBy should NOT be updated (not a mutable field)
    expect(event.createdBy.toString()).toBe('user123');
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('deleteEvent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 404 when event does not exist', async () => {
    Event.findById.mockResolvedValue(null);

    const req = mockReq({ params: { id: 'nonexistent' } });
    const res = mockRes();

    await deleteEvent(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 403 when user is not admin or creator', async () => {
    const event = { _id: 'e1', createdBy: { toString: () => 'otherUser' } };
    Event.findById.mockResolvedValue(event);

    const req = mockReq({
      params: { id: 'e1' },
      user: { _id: { toString: () => 'user123' }, role: 'viewer' }
    });
    const res = mockRes();

    await deleteEvent(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('cascades deletion: removes media, comments, R2 objects, and event', async () => {
    const event = { _id: 'e1', createdBy: { toString: () => 'user123' }, coverImage: null };
    Event.findById.mockResolvedValue(event);
    Event.findByIdAndDelete.mockResolvedValue(undefined);

    const mediaItems = [
      { _id: 'm1', r2Key: 'key1' },
      { _id: 'm2', r2Key: 'key2' }
    ];
    Media.find.mockResolvedValue(mediaItems);
    Media.deleteMany.mockResolvedValue(undefined);
    Comment.deleteMany.mockResolvedValue(undefined);
    r2Client.send.mockResolvedValue(undefined);

    const req = mockReq({
      params: { id: 'e1' },
      user: { _id: { toString: () => 'user123' }, role: 'photographer' }
    });
    const res = mockRes();

    await deleteEvent(req, res);

    expect(r2Client.send).toHaveBeenCalledTimes(2);
    expect(Comment.deleteMany).toHaveBeenCalledWith({ mediaId: { $in: ['m1', 'm2'] } });
    expect(Media.deleteMany).toHaveBeenCalledWith({ eventId: 'e1' });
    expect(Event.findByIdAndDelete).toHaveBeenCalledWith('e1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { message: 'Event and all associated data deleted successfully' }
    });
  });

  it('deletes R2-hosted cover image when event is deleted', async () => {
    const coverKey = 'covers/abc123.webp';
    const event = {
      _id: 'e1',
      createdBy: { toString: () => 'user123' },
      coverImage: `https://cdn.example.com/${coverKey}`,
    };
    Event.findById.mockResolvedValue(event);
    Event.findByIdAndDelete.mockResolvedValue(undefined);
    Media.find.mockResolvedValue([]);
    Media.deleteMany.mockResolvedValue(undefined);
    r2Client.send.mockResolvedValue(undefined);

    // Mock config.R2_PUBLIC_URL
    vi.mock('../config/env.js', () => ({
      default: { R2_PUBLIC_URL: 'https://cdn.example.com' },
    }));

    const req = mockReq({
      params: { id: 'e1' },
      user: { _id: { toString: () => 'user123' }, role: 'photographer' }
    });
    const res = mockRes();

    await deleteEvent(req, res);

    // r2Client.send should be called for the cover image deletion
    // (fire-and-forget via .catch, so we check it was called)
    expect(r2Client.send).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('does not attempt R2 deletion when coverImage is null', async () => {
    const event = { _id: 'e1', createdBy: { toString: () => 'user123' }, coverImage: null };
    Event.findById.mockResolvedValue(event);
    Event.findByIdAndDelete.mockResolvedValue(undefined);
    Media.find.mockResolvedValue([]);
    Media.deleteMany.mockResolvedValue(undefined);
    r2Client.send.mockResolvedValue(undefined);

    const req = mockReq({
      params: { id: 'e1' },
      user: { _id: { toString: () => 'user123' }, role: 'photographer' }
    });
    const res = mockRes();

    await deleteEvent(req, res);

    // No R2 calls since there are no media items and no cover image
    expect(r2Client.send).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('does not attempt R2 deletion when coverImage is an external URL (not R2-hosted)', async () => {
    const event = {
      _id: 'e1',
      createdBy: { toString: () => 'user123' },
      coverImage: 'https://external-cdn.example.com/cover.jpg',
    };
    Event.findById.mockResolvedValue(event);
    Event.findByIdAndDelete.mockResolvedValue(undefined);
    Media.find.mockResolvedValue([]);
    Media.deleteMany.mockResolvedValue(undefined);
    r2Client.send.mockResolvedValue(undefined);

    const req = mockReq({
      params: { id: 'e1' },
      user: { _id: { toString: () => 'user123' }, role: 'photographer' }
    });
    const res = mockRes();

    await deleteEvent(req, res);

    // No R2 calls — external URL should not trigger R2 deletion
    expect(r2Client.send).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('admin can delete any event', async () => {
    const event = { _id: 'e1', createdBy: { toString: () => 'otherUser' } };
    Event.findById.mockResolvedValue(event);
    Event.findByIdAndDelete.mockResolvedValue(undefined);
    Media.find.mockResolvedValue([]);
    Media.deleteMany.mockResolvedValue(undefined);

    const req = mockReq({
      params: { id: 'e1' },
      user: { _id: { toString: () => 'admin1' }, role: 'admin' }
    });
    const res = mockRes();

    await deleteEvent(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });
});
