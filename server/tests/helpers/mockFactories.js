/**
 * Reusable mock factories for test data.
 */
import { vi } from 'vitest';

export const MOCK_IDS = {
  admin:        '507f1f77bcf86cd799439001',
  photographer: '507f1f77bcf86cd799439002',
  viewer:       '507f1f77bcf86cd799439003',
  event:        '507f1f77bcf86cd799439010',
  media:        '507f1f77bcf86cd799439020',
  comment:      '507f1f77bcf86cd799439030',
  notification: '507f1f77bcf86cd799439040',
};

export function makeUser(overrides = {}) {
  return {
    _id: MOCK_IDS.viewer,
    name: 'Test User',
    email: 'test@example.com',
    role: 'viewer',
    avatar: null,
    isBlocked: false,
    refreshToken: null,
    createdAt: new Date('2024-01-01'),
    save: vi.fn().mockResolvedValue(undefined),
    toObject: function () { return { ...this }; },
    ...overrides,
  };
}

export function makeAdmin(overrides = {}) {
  return makeUser({
    _id: MOCK_IDS.admin,
    name: 'Admin User',
    email: 'admin@example.com',
    role: 'admin',
    ...overrides,
  });
}

export function makePhotographer(overrides = {}) {
  return makeUser({
    _id: MOCK_IDS.photographer,
    name: 'Photographer User',
    email: 'photo@example.com',
    role: 'photographer',
    ...overrides,
  });
}

export function makeEvent(overrides = {}) {
  return {
    _id: MOCK_IDS.event,
    title: 'Test Event',
    description: 'A test event',
    category: 'Workshop',
    date: new Date('2025-06-01'),
    createdBy: MOCK_IDS.admin,
    isPublic: true,
    tags: ['test'],
    createdAt: new Date('2024-01-01'),
    save: vi.fn().mockResolvedValue(undefined),
    toObject: function () { return { ...this }; },
    ...overrides,
  };
}

export function makeMedia(overrides = {}) {
  return {
    _id: MOCK_IDS.media,
    eventId: MOCK_IDS.event,
    uploadedBy: MOCK_IDS.photographer,
    url: 'https://cdn.example.com/photo.webp',
    r2Key: 'events/photo.webp',
    type: 'photo',
    isPublic: true,
    favouritedBy: [],
    comments: [],
    createdAt: new Date('2024-01-01'),
    save: vi.fn().mockResolvedValue(undefined),
    toObject: function () { return { ...this }; },
    ...overrides,
  };
}

export function makeComment(overrides = {}) {
  return {
    _id: MOCK_IDS.comment,
    mediaId: MOCK_IDS.media,
    userId: MOCK_IDS.viewer,
    text: 'Great photo!',
    createdAt: new Date('2024-01-01'),
    populate: vi.fn().mockImplementation(function () { return Promise.resolve(this); }),
    ...overrides,
  };
}

export function makeNotification(overrides = {}) {
  return {
    _id: MOCK_IDS.notification,
    type: 'like',
    recipient: MOCK_IDS.viewer,
    relatedUser: MOCK_IDS.photographer,
    relatedMedia: MOCK_IDS.media,
    title: 'New like',
    message: 'Someone liked your photo',
    isRead: false,
    createdAt: new Date('2024-01-01'),
    ...overrides,
  };
}

/** Create a mock Express req/res/next triple */
export function mockReqRes(reqOverrides = {}) {
  const req = {
    body: {},
    params: {},
    query: {},
    cookies: {},
    user: null,
    files: [],
    file: null,
    ...reqOverrides,
  };
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    redirect: vi.fn().mockReturnThis(),
    pipe: vi.fn(),
  };
  const next = vi.fn();
  return { req, res, next };
}

/** Generate a valid JWT-like cookie string for tests */
export function makeCookieHeader(token) {
  return `accessToken=${token}`;
}
