/**
 * Unit tests for mediaController — uploadMedia and interaction handlers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('@aws-sdk/client-s3', () => ({
  GetObjectCommand: vi.fn(),
  PutObjectCommand: vi.fn(),
  DeleteObjectCommand: vi.fn(),
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(),
}));

vi.mock('../config/r2.js', () => ({
  default: { send: vi.fn() },
  R2_BUCKET_NAME: 'test-bucket',
}));

vi.mock('../config/env.js', () => ({
  default: { R2_PUBLIC_URL: 'https://cdn.example.com' },
}));

vi.mock('../utils/imageProcessor.js', () => ({
  compressImage: vi.fn(),
  compressAvatar: vi.fn(),
  applyWatermark: vi.fn(),
  applyVideoWatermark: vi.fn(),
  extractVideoThumbnail: vi.fn(),
}));

vi.mock('../models/Media.js', () => ({
  default: {
    create: vi.fn(),
    findById: vi.fn(),
    findByIdAndDelete: vi.fn(),
    find: vi.fn(),
    countDocuments: vi.fn(),
    aggregate: vi.fn(),
  },
}));

vi.mock('../models/Comment.js', () => ({
  default: {
    create: vi.fn(),
    find: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

vi.mock('../models/Event.js', () => ({
  default: {
    findById: vi.fn(),
  },
}));

vi.mock('../models/User.js', () => ({
  default: {
    find: vi.fn(),
    findById: vi.fn(),
  },
}));

vi.mock('../models/Notification.js', () => ({
  default: {
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

vi.mock('../utils/notificationAggregator.js', () => ({
  upsertAggregatedNotification: vi.fn(),
}));

vi.mock('../sockets/notificationSocket.js', () => ({
  notifyUser: vi.fn(),
  emitPhotoLikedToOwner: vi.fn(),
  emitNewCommentToUser: vi.fn(),
  emitUserTagged: vi.fn(),
}));

vi.mock('../sockets/mediaSocket.js', () => ({
  emitMediaUploaded: vi.fn(),
  emitGalleryUpdated: vi.fn(),
  emitPhotoLikedToEvent: vi.fn(),
  emitNewCommentToEvent: vi.fn(),
}));

vi.mock('../sockets/activitySocket.js', () => ({
  emitActivityUpdate: vi.fn(),
}));

import { uploadMedia, listMedia, getMedia, serveMedia, downloadMedia, toggleFavourite, addComment, listComments, deleteMedia, tagUsers } from './mediaController.js';
import r2Client from '../config/r2.js';
import { compressImage, applyWatermark } from '../utils/imageProcessor.js';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import Media from '../models/Media.js';
import Comment from '../models/Comment.js';
import Event from '../models/Event.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { notifyUser, emitUserTagged } from '../sockets/notificationSocket.js';
import { upsertAggregatedNotification } from '../utils/notificationAggregator.js';

describe('mediaController — uploadMedia', () => {
  let req, res, next;

  beforeEach(() => {
    vi.clearAllMocks();

    req = {
      params: { eventId: '507f1f77bcf86cd799439011' },
      user: { _id: '507f1f77bcf86cd799439022', name: 'Test User' },
      files: [],
      file: null,
    };

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    next = vi.fn();

    // Default: event exists and is public
    Event.findById.mockResolvedValue({ _id: '507f1f77bcf86cd799439011', isPublic: true });
  });

  it('returns 400 when no files are provided', async () => {
    req.files = [];
    req.file = null;

    await uploadMedia(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'No files provided for upload.',
    });
  });

  it('processes video files without compression and creates Media record', async () => {
    const mockMedia = {
      _id: 'media-id-1',
      eventId: req.params.eventId,
      uploadedBy: req.user._id,
      url: 'https://cdn.example.com/abc123.mp4',
      r2Key: 'abc123.mp4',
      type: 'video',
    };

    Media.create.mockResolvedValue(mockMedia);

    req.files = [
      {
        key: 'abc123.mp4',
        mimetype: 'video/mp4',
        originalname: 'event-clip.mp4',
        size: 50 * 1024 * 1024,
      },
    ];

    await uploadMedia(req, res, next);

    expect(compressImage).not.toHaveBeenCalled();
    expect(Media.create).toHaveBeenCalledWith({
      eventId: req.params.eventId,
      uploadedBy: req.user._id,
      url: 'https://cdn.example.com/abc123.mp4',
      r2Key: 'abc123.mp4',
      type: 'video',
      isPublic: true,
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { uploaded: [mockMedia], rejected: [] },
    });
  });

  it('compresses image files and re-uploads with .webp extension', async () => {
    // Buffer must start with JPEG magic bytes (FF D8 FF) to pass the magic byte check
    const originalBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const compressedBuffer = Buffer.from('compressed-webp-data');

    // Mock r2Client.send for GetObject, PutObject, DeleteObject
    r2Client.send
      .mockResolvedValueOnce({
        Body: (async function* () { yield originalBuffer; })(),
      }) // GetObject
      .mockResolvedValueOnce({}) // PutObject (compressed)
      .mockResolvedValueOnce({}); // DeleteObject (original)

    compressImage.mockResolvedValue(compressedBuffer);

    const mockMedia = {
      _id: 'media-id-2',
      eventId: req.params.eventId,
      uploadedBy: req.user._id,
      url: 'https://cdn.example.com/abc123.webp',
      r2Key: 'abc123.webp',
      type: 'photo',
    };

    Media.create.mockResolvedValue(mockMedia);

    req.files = [
      {
        key: 'abc123.jpg',
        mimetype: 'image/jpeg',
        originalname: 'photo.jpg',
        size: 5 * 1024 * 1024,
      },
    ];

    await uploadMedia(req, res, next);

    expect(compressImage).toHaveBeenCalledWith(originalBuffer);
    expect(r2Client.send).toHaveBeenCalledTimes(3); // Get + Put + Delete
    expect(Media.create).toHaveBeenCalledWith({
      eventId: req.params.eventId,
      uploadedBy: req.user._id,
      url: 'https://cdn.example.com/abc123.webp',
      r2Key: 'abc123.webp',
      type: 'photo',
      isPublic: true,
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('handles partial failures — processes valid files and collects rejected ones', async () => {
    // First file (image) will fail during compression
    // Buffer must have valid JPEG magic bytes to pass the magic byte check
    const originalBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]);
    r2Client.send.mockResolvedValueOnce({
      Body: (async function* () { yield originalBuffer; })(),
    });
    compressImage.mockRejectedValueOnce(new Error('Sharp processing failed'));

    // Second file (video) will succeed
    const mockMedia = {
      _id: 'media-id-3',
      eventId: req.params.eventId,
      uploadedBy: req.user._id,
      url: 'https://cdn.example.com/def456.mp4',
      r2Key: 'def456.mp4',
      type: 'video',
    };
    Media.create.mockResolvedValue(mockMedia);

    req.files = [
      {
        key: 'abc123.png',
        mimetype: 'image/png',
        originalname: 'broken-image.png',
        size: 3 * 1024 * 1024,
      },
      {
        key: 'def456.mp4',
        mimetype: 'video/mp4',
        originalname: 'good-video.mp4',
        size: 100 * 1024 * 1024,
      },
    ];

    await uploadMedia(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
    const responseData = res.json.mock.calls[0][0];
    expect(responseData.success).toBe(true);
    expect(responseData.data.uploaded).toHaveLength(1);
    expect(responseData.data.uploaded[0]).toEqual(mockMedia);
    expect(responseData.data.rejected).toHaveLength(1);
    expect(responseData.data.rejected[0].originalname).toBe('broken-image.png');
    expect(responseData.data.rejected[0].reason).toBe('Sharp processing failed');
  });

  it('handles bulk upload with multiple files', async () => {
    const mockMediaVideo = {
      _id: 'media-v1',
      type: 'video',
      r2Key: 'vid1.mp4',
      url: 'https://cdn.example.com/vid1.mp4',
    };
    const mockMediaVideo2 = {
      _id: 'media-v2',
      type: 'video',
      r2Key: 'vid2.webm',
      url: 'https://cdn.example.com/vid2.webm',
    };

    Media.create
      .mockResolvedValueOnce(mockMediaVideo)
      .mockResolvedValueOnce(mockMediaVideo2);

    req.files = [
      { key: 'vid1.mp4', mimetype: 'video/mp4', originalname: 'a.mp4', size: 50 * 1024 * 1024 },
      { key: 'vid2.webm', mimetype: 'video/webm', originalname: 'b.webm', size: 30 * 1024 * 1024 },
    ];

    await uploadMedia(req, res, next);

    expect(Media.create).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(201);
    const responseData = res.json.mock.calls[0][0];
    expect(responseData.data.uploaded).toHaveLength(2);
    expect(responseData.data.rejected).toHaveLength(0);
  });

  it('falls back to req.file when req.files is empty', async () => {
    const mockMedia = {
      _id: 'media-single',
      type: 'video',
      r2Key: 'single.mp4',
      url: 'https://cdn.example.com/single.mp4',
    };
    Media.create.mockResolvedValue(mockMedia);

    req.files = undefined;
    req.file = {
      key: 'single.mp4',
      mimetype: 'video/mp4',
      originalname: 'single.mp4',
      size: 20 * 1024 * 1024,
    };

    await uploadMedia(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json.mock.calls[0][0].data.uploaded).toHaveLength(1);
  });

  it('calls next with error when an unexpected error occurs', async () => {
    // Simulate an unexpected error (e.g., params missing)
    req.params = undefined;
    req.files = [{ key: 'x.mp4', mimetype: 'video/mp4', originalname: 'x.mp4', size: 1024 }];

    await uploadMedia(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});


describe('mediaController — toggleFavourite', () => {
  let req, res, next;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      params: { id: '507f1f77bcf86cd799439011' },
      user: { _id: '507f1f77bcf86cd799439022', name: 'Test User' },
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  it('returns 404 when media is not found', async () => {
    Media.findById.mockResolvedValue(null);

    await toggleFavourite(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Media not found.',
    });
  });

  it('adds user to favouritedBy when not already favourited', async () => {
    const media = {
      favouritedBy: [],
      eventId: 'event123',
      uploadedBy: 'owner456',
      save: vi.fn().mockResolvedValue(undefined),
    };
    Media.findById.mockResolvedValue(media);

    await toggleFavourite(req, res, next);

    expect(media.favouritedBy).toContain(req.user._id);
    expect(media.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { favourited: true, favouriteCount: 1 },
    });
  });

  it('removes user from favouritedBy when already favourited', async () => {
    const media = {
      favouritedBy: [{ toString: () => '507f1f77bcf86cd799439022' }],
      eventId: 'event123',
      uploadedBy: 'owner456',
      save: vi.fn().mockResolvedValue(undefined),
    };
    Media.findById.mockResolvedValue(media);

    await toggleFavourite(req, res, next);

    expect(media.favouritedBy).toHaveLength(0);
    expect(media.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { favourited: false, favouriteCount: 0 },
    });
  });
});

describe('mediaController — addComment', () => {
  let req, res, next;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      params: { id: '507f1f77bcf86cd799439011' },
      user: { _id: '507f1f77bcf86cd799439022', name: 'Test User' },
      body: { text: 'Great photo!' },
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  it('returns 400 when text is empty', async () => {
    req.body.text = '';

    await addComment(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Comment text must be between 1 and 1000 characters.',
    });
  });

  it('returns 400 when text exceeds 1000 characters', async () => {
    req.body.text = 'a'.repeat(1001);

    await addComment(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Comment text must be between 1 and 1000 characters.',
    });
  });

  it('returns 400 when text is missing', async () => {
    req.body = {};

    await addComment(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Comment text must be between 1 and 1000 characters.',
    });
  });

  it('returns 404 when media is not found', async () => {
    Media.findById.mockResolvedValue(null);

    await addComment(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Media not found.',
    });
  });

  it('creates comment and pushes to media.comments on valid input', async () => {
    const mockComment = {
      _id: 'comment-id-1',
      mediaId: req.params.id,
      userId: { _id: req.user._id, name: 'Test User', avatar: null },
      text: 'Great photo!',
      createdAt: new Date().toISOString(),
      populate: vi.fn().mockImplementation(function () { return Promise.resolve(this); }),
    };
    Comment.create.mockResolvedValue(mockComment);

    // Mock Comment.find().distinct() for recipient set computation
    Comment.find.mockReturnValue({ distinct: vi.fn().mockResolvedValue([]) });

    const media = {
      comments: [],
      eventId: 'event123',
      uploadedBy: req.user._id,
      save: vi.fn().mockResolvedValue(undefined),
    };
    Media.findById.mockResolvedValue(media);

    await addComment(req, res, next);

    expect(Comment.create).toHaveBeenCalledWith({
      mediaId: req.params.id,
      userId: req.user._id,
      text: 'Great photo!',
    });
    expect(media.comments).toContain('comment-id-1');
    expect(media.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: mockComment,
    });
  });
});

describe('mediaController — listComments', () => {
  let req, res, next;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      params: { id: '507f1f77bcf86cd799439011' },
      user: { _id: 'user1', role: 'club_member' }, // authenticated user
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  it('returns 200 with populated comments for public media', async () => {
    const mockComments = [
      { _id: 'c1', text: 'Nice!', userId: { name: 'Alice', avatar: 'url1' } },
      { _id: 'c2', text: 'Cool!', userId: { name: 'Bob', avatar: 'url2' } },
    ];

    // listComments now calls Media.findById().select() first
    Media.findById.mockReturnValue({ select: vi.fn().mockResolvedValue({ isPublic: true }) });

    const sortMock = vi.fn().mockResolvedValue(mockComments);
    const populateMock = vi.fn().mockReturnValue({ sort: sortMock });
    Comment.find.mockReturnValue({ populate: populateMock });

    await listComments(req, res, next);

    expect(Comment.find).toHaveBeenCalledWith({ mediaId: req.params.id });
    expect(populateMock).toHaveBeenCalledWith('userId', 'name avatar');
    expect(sortMock).toHaveBeenCalledWith({ createdAt: 1 });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: mockComments,
    });
  });
});

describe('mediaController — deleteMedia', () => {
  let req, res, next;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      params: { id: '507f1f77bcf86cd799439011' },
      user: { _id: '507f1f77bcf86cd799439022', role: 'admin' },
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  it('returns 404 when media is not found', async () => {
    Media.findById.mockResolvedValue(null);

    await deleteMedia(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Media not found.',
    });
  });

  it('returns 403 when requester is not admin or uploader', async () => {
    req.user = { _id: '507f1f77bcf86cd799439033', role: 'club_member' };
    const media = {
      uploadedBy: { toString: () => '507f1f77bcf86cd799439022' },
      r2Key: 'some-key.webp',
    };
    Media.findById.mockResolvedValue(media);

    await deleteMedia(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Insufficient permissions.',
    });
  });

  it('returns 500 and retains record when R2 deletion fails', async () => {
    const media = {
      uploadedBy: { toString: () => '507f1f77bcf86cd799439022' },
      r2Key: 'some-key.webp',
    };
    Media.findById.mockResolvedValue(media);
    Comment.deleteMany.mockResolvedValue({});
    Notification.deleteMany.mockResolvedValue({});
    r2Client.send.mockRejectedValue(new Error('R2 unavailable'));

    await deleteMedia(req, res, next);

    expect(Comment.deleteMany).toHaveBeenCalledWith({ mediaId: req.params.id });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Media deletion could not be completed due to storage failure.',
    });
    expect(Media.findByIdAndDelete).not.toHaveBeenCalled();
  });

  it('deletes comments, R2 object, and media record when admin requests deletion', async () => {
    const media = {
      uploadedBy: { toString: () => '507f1f77bcf86cd799439099' },
      r2Key: 'event-photo.webp',
    };
    Media.findById.mockResolvedValue(media);
    Comment.deleteMany.mockResolvedValue({});
    Notification.deleteMany.mockResolvedValue({});
    r2Client.send.mockResolvedValue({});
    Media.findByIdAndDelete.mockResolvedValue({});

    await deleteMedia(req, res, next);

    expect(Comment.deleteMany).toHaveBeenCalledWith({ mediaId: req.params.id });
    expect(r2Client.send).toHaveBeenCalled();
    expect(Media.findByIdAndDelete).toHaveBeenCalledWith(req.params.id);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { message: 'Media deleted successfully.' },
    });
  });

  it('allows uploader (photographer) to delete their own media', async () => {
    req.user = { _id: '507f1f77bcf86cd799439022', role: 'photographer' };
    const media = {
      uploadedBy: { toString: () => '507f1f77bcf86cd799439022' },
      r2Key: 'my-photo.webp',
    };
    Media.findById.mockResolvedValue(media);
    Comment.deleteMany.mockResolvedValue({});
    Notification.deleteMany.mockResolvedValue({});
    r2Client.send.mockResolvedValue({});
    Media.findByIdAndDelete.mockResolvedValue({});

    await deleteMedia(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { message: 'Media deleted successfully.' },
    });
  });
});

describe('mediaController — listMedia', () => {
  let req, res, next;

  beforeEach(() => {
    vi.clearAllMocks();

    req = {
      query: {},
      user: { _id: '507f1f77bcf86cd799439022', role: 'club_member' },
    };

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    next = vi.fn();
  });

  it('returns paginated media with default params (page 1, limit 20, sortBy uploadDate desc)', async () => {
    const mockItems = [
      { _id: 'media1', toObject: () => ({ _id: 'media1' }) },
      { _id: 'media2', toObject: () => ({ _id: 'media2' }) },
    ];
    Media.countDocuments.mockResolvedValue(2);
    Media.find.mockReturnValue({
      populate: vi.fn().mockReturnValue({
        populate: vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            skip: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(mockItems),
            }),
          }),
        }),
      }),
    });

    await listMedia(req, res, next);

    expect(Media.countDocuments).toHaveBeenCalledWith({});
    expect(Media.find).toHaveBeenCalledWith({});
    expect(res.status).toHaveBeenCalledWith(200);
    const response = res.json.mock.calls[0][0];
    expect(response.success).toBe(true);
    expect(response.data.items).toHaveLength(2);
    expect(response.data.page).toBe(1);
    expect(response.data.limit).toBe(20);
    expect(response.data.total).toBe(2);
    expect(response.data.hasMore).toBe(false);
  });

  it('filters by eventId when provided', async () => {
    req.query.eventId = '507f1f77bcf86cd799439099';
    const mockItems = [{ _id: 'media1', toObject: () => ({ _id: 'media1' }) }];
    Media.countDocuments.mockResolvedValue(1);
    Media.find.mockReturnValue({
      populate: vi.fn().mockReturnValue({
        populate: vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            skip: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(mockItems),
            }),
          }),
        }),
      }),
    });

    await listMedia(req, res, next);

    expect(Media.find).toHaveBeenCalledWith({ eventId: '507f1f77bcf86cd799439099' });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('restricts viewer role to public media only', async () => {
    req.user.role = 'viewer';
    Media.countDocuments.mockResolvedValue(0);
    Media.find.mockReturnValue({
      populate: vi.fn().mockReturnValue({
        populate: vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            skip: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      }),
    });

    await listMedia(req, res, next);

    expect(Media.find).toHaveBeenCalledWith({ isPublic: true });
  });

  it('supports sorting by likes', async () => {
    req.query.sortBy = 'likes';
    req.query.sortOrder = 'desc';
    Media.aggregate
      .mockResolvedValueOnce([{ total: 0 }]) // count
      .mockResolvedValueOnce([]); // data

    await listMedia(req, res, next);

    expect(Media.aggregate).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('uses aggregation for eventDate sorting', async () => {
    req.query.sortBy = 'eventDate';
    Media.aggregate.mockResolvedValueOnce([{ total: 5 }]); // count
    Media.aggregate.mockResolvedValueOnce([{ _id: 'media1' }]); // data

    await listMedia(req, res, next);

    expect(Media.aggregate).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns hasMore true when more items exist', async () => {
    req.query.limit = '2';
    const mockItems = [
      { _id: 'a', toObject: () => ({ _id: 'a' }) },
      { _id: 'b', toObject: () => ({ _id: 'b' }) },
    ];
    Media.countDocuments.mockResolvedValue(5);
    Media.find.mockReturnValue({
      populate: vi.fn().mockReturnValue({
        populate: vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            skip: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(mockItems),
            }),
          }),
        }),
      }),
    });

    await listMedia(req, res, next);

    const response = res.json.mock.calls[0][0];
    expect(response.data.hasMore).toBe(true);
  });
});

describe('mediaController — getMedia', () => {
  let req, res, next;

  beforeEach(() => {
    vi.clearAllMocks();

    req = {
      params: { id: '507f1f77bcf86cd799439033' },
      user: { _id: '507f1f77bcf86cd799439022', role: 'club_member' },
    };

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    next = vi.fn();
  });

  it('returns 404 when media is not found', async () => {
    Media.findById.mockResolvedValue(null);

    await getMedia(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Media not found.',
    });
  });

  it('returns public media with public URL as accessUrl', async () => {
    const mockMedia = {
      _id: '507f1f77bcf86cd799439033',
      url: 'https://cdn.example.com/photo.webp',
      r2Key: 'photo.webp',
      isPublic: true,
      toObject: () => ({
        _id: '507f1f77bcf86cd799439033',
        url: 'https://cdn.example.com/photo.webp',
        r2Key: 'photo.webp',
        isPublic: true,
      }),
    };
    Media.findById.mockResolvedValue(mockMedia);

    await getMedia(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    const response = res.json.mock.calls[0][0];
    expect(response.success).toBe(true);
    expect(response.data.accessUrl).toBe('https://cdn.example.com/photo.webp');
  });

  it('returns signed URL for private media when user has authorized role', async () => {
    const mockMedia = {
      _id: '507f1f77bcf86cd799439033',
      url: 'https://cdn.example.com/private.webp',
      r2Key: 'private.webp',
      isPublic: false,
      toObject: () => ({
        _id: '507f1f77bcf86cd799439033',
        url: 'https://cdn.example.com/private.webp',
        r2Key: 'private.webp',
        isPublic: false,
      }),
    };
    Media.findById.mockResolvedValue(mockMedia);
    getSignedUrl.mockResolvedValue('https://signed-url.example.com/private.webp?token=abc');

    await getMedia(req, res, next);

    expect(getSignedUrl).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    const response = res.json.mock.calls[0][0];
    expect(response.data.accessUrl).toBe('https://signed-url.example.com/private.webp?token=abc');
  });

  it('returns 403 for viewer role on private media', async () => {
    req.user.role = 'viewer';
    const mockMedia = {
      _id: '507f1f77bcf86cd799439033',
      isPublic: false,
      toObject: () => ({ _id: '507f1f77bcf86cd799439033', isPublic: false }),
    };
    Media.findById.mockResolvedValue(mockMedia);

    await getMedia(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Insufficient permissions.',
    });
  });
});

describe('mediaController — downloadMedia', () => {
  let req, res, next;

  beforeEach(() => {
    vi.clearAllMocks();

    req = {
      params: { id: '507f1f77bcf86cd799439033' },
      user: { _id: '507f1f77bcf86cd799439022', name: 'John Doe', role: 'club_member' },
    };

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    next = vi.fn();
  });

  it('returns 404 when media is not found', async () => {
    Media.findById.mockReturnValue({ populate: vi.fn().mockResolvedValue(null) });

    await downloadMedia(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Media not found.',
    });
  });

  it('returns 503 when R2 is unavailable', async () => {
    const mockMedia = {
      _id: '507f1f77bcf86cd799439033',
      r2Key: 'photo.webp',
      type: 'photo',
      eventId: { title: 'Test Event' },
    };
    Media.findById.mockReturnValue({ populate: vi.fn().mockResolvedValue(mockMedia) });
    r2Client.send.mockRejectedValue(new Error('R2 connection failed'));

    await downloadMedia(req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Service temporarily unavailable. Please try again later.',
    });
  });

  it('returns watermarked image buffer as download on success', async () => {
    const mockMedia = {
      _id: '507f1f77bcf86cd799439033',
      r2Key: 'events/photo.webp',
      type: 'photo',
      eventId: { title: 'Test Event' },
    };
    Media.findById.mockReturnValue({ populate: vi.fn().mockResolvedValue(mockMedia) });

    const fileBuffer = Buffer.from('original-image-data');
    r2Client.send.mockResolvedValue({
      Body: (async function* () { yield fileBuffer; })(),
    });

    const watermarkedBuffer = Buffer.from('watermarked-image-data');
    applyWatermark.mockResolvedValue(watermarkedBuffer);

    await downloadMedia(req, res, next);

    expect(applyWatermark).toHaveBeenCalledWith(fileBuffer, {
      clubName: 'Antares',
      eventName: 'Test Event',
      userName: 'John Doe',
      userRole: 'club_member',
      timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
    // Images are now always served as JPEG (converted from WebP storage format)
    expect(res.set).toHaveBeenCalledWith({
      'Content-Type': 'image/jpeg',
      'Content-Disposition': `attachment; filename="Test_Event_507f1f77bcf86cd799439033.jpg"`,
      'Content-Length': watermarkedBuffer.length,
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(watermarkedBuffer);
  });
});


describe('mediaController — tagUsers', () => {
  let req, res, next;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      params: { id: '507f1f77bcf86cd799439011' },
      user: { _id: '507f1f77bcf86cd799439022', name: 'Alice' },
      body: { userIds: ['user1', 'user2'] },
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  it('returns 400 when userIds is not an array', async () => {
    req.body = { userIds: 'not-an-array' };

    await tagUsers(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'userIds must be a non-empty array.',
    });
  });

  it('returns 400 when userIds is an empty array', async () => {
    req.body = { userIds: [] };

    await tagUsers(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'userIds must be a non-empty array.',
    });
  });

  it('returns 404 when media is not found', async () => {
    Media.findById.mockResolvedValue(null);

    await tagUsers(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Media not found.',
    });
  });

  it('creates notifications and emits socket events for each tagged user', async () => {
    const media = {
      _id: '507f1f77bcf86cd799439011',
      eventId: 'event123',
      uploadedBy: 'owner456',
      comments: [],
      save: vi.fn().mockResolvedValue(undefined),
    };
    Media.findById.mockResolvedValue(media);

    // tagUsers now fetches user names for the auto-generated tag comment
    User.find.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([
        { _id: 'user1', name: 'User One' },
        { _id: 'user2', name: 'User Two' },
      ]),
    });

    const mockNotif1 = { _id: 'notif1', type: 'tag', recipient: 'user1' };
    const mockNotif2 = { _id: 'notif2', type: 'tag', recipient: 'user2' };
    upsertAggregatedNotification
      .mockResolvedValueOnce(mockNotif1)
      .mockResolvedValueOnce(mockNotif2);

    // Mock the auto-generated tag comment
    const tagComment = {
      _id: 'tag-comment-1',
      text: 'Alice tagged User One and User Two in this photo.',
      populate: vi.fn().mockImplementation(function() { return Promise.resolve({ ...this, userId: { _id: req.user._id, name: 'Alice', avatar: null } }); }),
    };
    Comment.create.mockResolvedValue(tagComment);

    await tagUsers(req, res, next);

    expect(upsertAggregatedNotification).toHaveBeenCalledTimes(2);
    expect(upsertAggregatedNotification).toHaveBeenCalledWith({
      type: 'tag',
      recipient: 'user1',
      actor: { _id: req.user._id, name: 'Alice' },
      relatedMedia: req.params.id,
    });
    expect(notifyUser).toHaveBeenCalledTimes(2);
    expect(emitUserTagged).toHaveBeenCalledTimes(2);
    expect(emitUserTagged).toHaveBeenCalledWith(
      'user1',
      { mediaId: req.params.id, eventId: 'event123', by: { _id: '507f1f77bcf86cd799439022', name: 'Alice' } },
      '507f1f77bcf86cd799439022'
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { tagged: ['user1', 'user2'] },
    });
  });

  it('excludes the actor from being tagged (Requirement 3.5)', async () => {
    req.body = { userIds: ['507f1f77bcf86cd799439022', 'user2'] };
    const media = {
      _id: '507f1f77bcf86cd799439011',
      eventId: 'event123',
      uploadedBy: 'owner456',
      comments: [],
      save: vi.fn().mockResolvedValue(undefined),
    };
    Media.findById.mockResolvedValue(media);

    User.find.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([{ _id: 'user2', name: 'User Two' }]),
    });

    const mockNotif = { _id: 'notif1', type: 'tag', recipient: 'user2' };
    upsertAggregatedNotification.mockResolvedValue(mockNotif);

    const tagComment = {
      _id: 'tag-comment-1',
      text: 'Alice tagged User Two in this photo.',
      populate: vi.fn().mockImplementation(function() { return Promise.resolve({ ...this, userId: { _id: req.user._id, name: 'Alice', avatar: null } }); }),
    };
    Comment.create.mockResolvedValue(tagComment);

    await tagUsers(req, res, next);

    // Only user2 should be tagged, not the actor
    expect(upsertAggregatedNotification).toHaveBeenCalledTimes(1);
    expect(notifyUser).toHaveBeenCalledTimes(1);
    expect(emitUserTagged).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { tagged: ['user2'] },
    });
  });

  it('deduplicates userIds', async () => {
    req.body = { userIds: ['user1', 'user1', 'user2'] };
    const media = {
      _id: '507f1f77bcf86cd799439011',
      eventId: 'event123',
      uploadedBy: 'owner456',
      comments: [],
      save: vi.fn().mockResolvedValue(undefined),
    };
    Media.findById.mockResolvedValue(media);

    User.find.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([
        { _id: 'user1', name: 'User One' },
        { _id: 'user2', name: 'User Two' },
      ]),
    });

    const mockNotif = { _id: 'notif1', type: 'tag', recipient: 'user1' };
    upsertAggregatedNotification.mockResolvedValue(mockNotif);

    const tagComment = {
      _id: 'tag-comment-1',
      text: 'Alice tagged User One and User Two in this photo.',
      populate: vi.fn().mockImplementation(function() { return Promise.resolve({ ...this, userId: { _id: req.user._id, name: 'Alice', avatar: null } }); }),
    };
    Comment.create.mockResolvedValue(tagComment);

    await tagUsers(req, res, next);

    // Should only create 2 notifications (user1 deduplicated)
    expect(upsertAggregatedNotification).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('continues processing when a notification creation fails for one user', async () => {
    const media = {
      _id: '507f1f77bcf86cd799439011',
      eventId: 'event123',
      uploadedBy: 'owner456',
      comments: [],
      save: vi.fn().mockResolvedValue(undefined),
    };
    Media.findById.mockResolvedValue(media);

    User.find.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([
        { _id: 'user1', name: 'User One' },
        { _id: 'user2', name: 'User Two' },
      ]),
    });

    upsertAggregatedNotification
      .mockRejectedValueOnce(new Error('DB error'))
      .mockResolvedValueOnce({ _id: 'notif2', type: 'tag', recipient: 'user2' });

    const tagComment = {
      _id: 'tag-comment-1',
      text: 'Alice tagged User Two in this photo.',
      populate: vi.fn().mockImplementation(function() { return Promise.resolve({ ...this, userId: { _id: req.user._id, name: 'Alice', avatar: null } }); }),
    };
    Comment.create.mockResolvedValue(tagComment);

    await tagUsers(req, res, next);

    // Should still process user2 even though user1 failed
    expect(upsertAggregatedNotification).toHaveBeenCalledTimes(2);
    expect(notifyUser).toHaveBeenCalledTimes(1); // only user2 succeeded
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { tagged: ['user2'] },
    });
  });
});

describe('mediaController — listComments (privacy enforcement)', () => {
  let req, res, next;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      params: { id: '507f1f77bcf86cd799439011' },
      user: undefined, // unauthenticated by default
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  it('returns 404 when media is not found', async () => {
    Media.findById.mockReturnValue({ select: vi.fn().mockResolvedValue(null) });

    await listComments(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Media not found.' });
  });

  it('returns 200 with comments for public media without authentication', async () => {
    Media.findById.mockReturnValue({ select: vi.fn().mockResolvedValue({ isPublic: true }) });

    const mockComments = [{ _id: 'c1', text: 'Nice!' }];
    const sortMock = vi.fn().mockResolvedValue(mockComments);
    const populateMock = vi.fn().mockReturnValue({ sort: sortMock });
    Comment.find.mockReturnValue({ populate: populateMock });

    await listComments(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: mockComments });
  });

  it('returns 401 for private media when user is not authenticated', async () => {
    Media.findById.mockReturnValue({ select: vi.fn().mockResolvedValue({ isPublic: false }) });
    req.user = undefined;

    await listComments(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Authentication required.' });
  });

  it('returns 403 for private media when user has viewer role', async () => {
    Media.findById.mockReturnValue({ select: vi.fn().mockResolvedValue({ isPublic: false }) });
    req.user = { _id: 'user1', role: 'viewer' };

    await listComments(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Insufficient permissions.' });
  });

  it('returns 200 with comments for private media when user is club_member', async () => {
    Media.findById.mockReturnValue({ select: vi.fn().mockResolvedValue({ isPublic: false }) });
    req.user = { _id: 'user1', role: 'club_member' };

    const mockComments = [{ _id: 'c1', text: 'Private comment' }];
    const sortMock = vi.fn().mockResolvedValue(mockComments);
    const populateMock = vi.fn().mockReturnValue({ sort: sortMock });
    Comment.find.mockReturnValue({ populate: populateMock });

    await listComments(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: mockComments });
  });

  it('returns 200 with comments for private media when user is admin', async () => {
    Media.findById.mockReturnValue({ select: vi.fn().mockResolvedValue({ isPublic: false }) });
    req.user = { _id: 'admin1', role: 'admin' };

    const mockComments = [];
    const sortMock = vi.fn().mockResolvedValue(mockComments);
    const populateMock = vi.fn().mockReturnValue({ sort: sortMock });
    Comment.find.mockReturnValue({ populate: populateMock });

    await listComments(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 200 with comments for private media when user is photographer', async () => {
    Media.findById.mockReturnValue({ select: vi.fn().mockResolvedValue({ isPublic: false }) });
    req.user = { _id: 'photo1', role: 'photographer' };

    const mockComments = [{ _id: 'c2', text: 'Photographer comment' }];
    const sortMock = vi.fn().mockResolvedValue(mockComments);
    const populateMock = vi.fn().mockReturnValue({ sort: sortMock });
    Comment.find.mockReturnValue({ populate: populateMock });

    await listComments(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: mockComments });
  });
});

describe('mediaController — serveMedia (safe req.user handling)', () => {
  let req, res, next;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      params: { id: '507f1f77bcf86cd799439011' },
      user: undefined,
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  it('returns 404 when media is not found', async () => {
    Media.findById.mockResolvedValue(null);

    await serveMedia(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Media not found.' });
  });

  it('streams public media without authentication (no crash)', async () => {
    const mockMedia = {
      _id: '507f1f77bcf86cd799439011',
      isPublic: true,
      r2Key: 'photo.webp',
    };
    Media.findById.mockResolvedValue(mockMedia);

    const mockStream = { pipe: vi.fn() };
    r2Client.send.mockResolvedValue({ Body: mockStream });

    // req.user is undefined — should NOT crash
    req.user = undefined;

    await serveMedia(req, res, next);

    expect(res.set).toHaveBeenCalledWith(expect.objectContaining({ 'Content-Type': 'image/webp' }));
    expect(mockStream.pipe).toHaveBeenCalledWith(res);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for private media when user is not authenticated (was crashing before fix)', async () => {
    const mockMedia = {
      _id: '507f1f77bcf86cd799439011',
      isPublic: false,
      r2Key: 'private.webp',
    };
    Media.findById.mockResolvedValue(mockMedia);

    // req.user is undefined — previously caused TypeError: Cannot read properties of undefined (reading 'role')
    req.user = undefined;

    await serveMedia(req, res, next);

    // Must return 401, NOT call next() with a TypeError
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Authentication required.' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 for private media when user has viewer role', async () => {
    const mockMedia = {
      _id: '507f1f77bcf86cd799439011',
      isPublic: false,
      r2Key: 'private.webp',
    };
    Media.findById.mockResolvedValue(mockMedia);
    req.user = { _id: 'user1', role: 'viewer' };

    await serveMedia(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Insufficient permissions.' });
  });

  it('streams private media for authorized role (club_member)', async () => {
    const mockMedia = {
      _id: '507f1f77bcf86cd799439011',
      isPublic: false,
      r2Key: 'private.webp',
    };
    Media.findById.mockResolvedValue(mockMedia);
    req.user = { _id: 'user1', role: 'club_member' };

    const mockStream = { pipe: vi.fn() };
    r2Client.send.mockResolvedValue({ Body: mockStream });

    await serveMedia(req, res, next);

    expect(mockStream.pipe).toHaveBeenCalledWith(res);
    expect(next).not.toHaveBeenCalled();
  });
});
