import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../models/Notification.js', () => ({
  default: {
    findOne: vi.fn(),
    create: vi.fn(),
  },
}));

import Notification from '../models/Notification.js';
import {
  upsertAggregatedNotification,
  buildAggregatedMessage,
  ACTOR_CAP,
  MERGE_WINDOW_MS,
} from './notificationAggregator.js';

describe('buildAggregatedMessage', () => {
  it('uses single-actor template for one actor', () => {
    expect(buildAggregatedMessage('like', [{ name: 'Alice' }], 1))
      .toBe('Alice liked your photo');
  });

  it('uses two-actor template when count is exactly 2', () => {
    expect(buildAggregatedMessage('comment', [{ name: 'Alice' }, { name: 'Bob' }], 2))
      .toBe('Alice and Bob commented on your photo');
  });

  it('uses N-others template for 3+ actors', () => {
    expect(buildAggregatedMessage('tag', [
      { name: 'Alice' }, { name: 'Bob' }, { name: 'Carol' },
    ], 4)).toBe('Alice and 3 others tagged you in a photo');
  });

  it('falls back to "Someone" when actor name is missing', () => {
    expect(buildAggregatedMessage('like', [{}], 1)).toBe('Someone liked your photo');
  });

  it('returns empty string for unknown type', () => {
    expect(buildAggregatedMessage('mystery', [{ name: 'Alice' }], 1)).toBe('');
  });
});

describe('upsertAggregatedNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a fresh notification when no mergeable row exists', async () => {
    Notification.findOne.mockReturnValue({ sort: vi.fn().mockResolvedValue(null) });
    Notification.create.mockResolvedValue({ _id: 'new1' });

    const result = await upsertAggregatedNotification({
      type: 'like',
      recipient: 'recipient1',
      actor: { _id: 'actor1', name: 'Alice' },
      relatedMedia: 'media1',
    });

    expect(Notification.create).toHaveBeenCalledTimes(1);
    const arg = Notification.create.mock.calls[0][0];
    expect(arg).toMatchObject({
      type: 'like',
      recipient: 'recipient1',
      relatedUser: 'actor1',
      relatedMedia: 'media1',
      title: 'New like',
      message: 'Alice liked your photo',
      actorCount: 1,
    });
    expect(arg.actors).toHaveLength(1);
    expect(arg.actors[0]).toMatchObject({ user: 'actor1', name: 'Alice' });
    expect(result._id).toBe('new1');
  });

  it('merges into existing unread row, dedup by actor', async () => {
    const existing = {
      _id: 'existing1',
      type: 'like',
      relatedUser: 'oldActor',
      createdAt: new Date(),
      actors: [{ user: 'oldActor', name: 'Bob', at: new Date() }],
      actorCount: 1,
      save: vi.fn().mockResolvedValue(undefined),
    };
    Notification.findOne.mockReturnValue({ sort: vi.fn().mockResolvedValue(existing) });

    const result = await upsertAggregatedNotification({
      type: 'like',
      recipient: 'recipient1',
      actor: { _id: 'actor2', name: 'Alice' },
      relatedMedia: 'media1',
    });

    expect(Notification.create).not.toHaveBeenCalled();
    expect(existing.save).toHaveBeenCalled();
    expect(existing.actorCount).toBe(2);
    expect(existing.actors).toHaveLength(2);
    // Newest first
    expect(String(existing.actors[0].user)).toBe('actor2');
    expect(existing.message).toBe('Alice and Bob liked your photo');
    expect(result).toBe(existing);
  });

  it('does not increment actorCount when same actor re-acts', async () => {
    const existing = {
      _id: 'existing1',
      type: 'like',
      relatedUser: 'actor1',
      createdAt: new Date(),
      actors: [{ user: 'actor1', name: 'Alice', at: new Date(Date.now() - 1000) }],
      actorCount: 1,
      save: vi.fn().mockResolvedValue(undefined),
    };
    Notification.findOne.mockReturnValue({ sort: vi.fn().mockResolvedValue(existing) });

    await upsertAggregatedNotification({
      type: 'like',
      recipient: 'recipient1',
      actor: { _id: 'actor1', name: 'Alice' },
      relatedMedia: 'media1',
    });

    expect(existing.actorCount).toBe(1);
    expect(existing.actors).toHaveLength(1);
    expect(existing.message).toBe('Alice liked your photo');
  });

  it('caps actors array at ACTOR_CAP while still bumping actorCount', async () => {
    const seedActors = Array.from({ length: ACTOR_CAP }, (_, i) => ({
      user: `actor${i}`,
      name: `User${i}`,
      at: new Date(Date.now() - i * 1000),
    }));
    const existing = {
      _id: 'existing1',
      type: 'like',
      relatedUser: 'actor0',
      createdAt: new Date(),
      actors: seedActors,
      actorCount: ACTOR_CAP,
      save: vi.fn().mockResolvedValue(undefined),
    };
    Notification.findOne.mockReturnValue({ sort: vi.fn().mockResolvedValue(existing) });

    await upsertAggregatedNotification({
      type: 'like',
      recipient: 'recipient1',
      actor: { _id: 'newActor', name: 'NewUser' },
      relatedMedia: 'media1',
    });

    expect(existing.actors).toHaveLength(ACTOR_CAP);
    expect(String(existing.actors[0].user)).toBe('newActor');
    expect(existing.actorCount).toBe(ACTOR_CAP + 1);
    expect(existing.message).toBe(`NewUser and ${ACTOR_CAP} others liked your photo`);
  });

  it('passes a 24h cutoff to the findOne query', async () => {
    Notification.findOne.mockReturnValue({ sort: vi.fn().mockResolvedValue(null) });
    Notification.create.mockResolvedValue({ _id: 'x' });

    const before = Date.now();
    await upsertAggregatedNotification({
      type: 'comment',
      recipient: 'r1',
      actor: { _id: 'a1', name: 'A' },
      relatedMedia: 'm1',
    });
    const after = Date.now();

    const query = Notification.findOne.mock.calls[0][0];
    expect(query.type).toBe('comment');
    expect(query.recipient).toBe('r1');
    expect(query.relatedMedia).toBe('m1');
    expect(query.isRead).toBe(false);
    expect(query.lastActorAt.$gte).toBeInstanceOf(Date);
    const cutoffMs = query.lastActorAt.$gte.getTime();
    expect(cutoffMs).toBeGreaterThanOrEqual(before - MERGE_WINDOW_MS - 5);
    expect(cutoffMs).toBeLessThanOrEqual(after - MERGE_WINDOW_MS + 5);
  });

  it('backfills legacy rows missing the actors array', async () => {
    const existing = {
      _id: 'legacy1',
      type: 'like',
      relatedUser: 'oldActor',
      createdAt: new Date(Date.now() - 60_000),
      // No actors field — pre-aggregation row
      save: vi.fn().mockResolvedValue(undefined),
    };
    Notification.findOne.mockReturnValue({ sort: vi.fn().mockResolvedValue(existing) });

    await upsertAggregatedNotification({
      type: 'like',
      recipient: 'r1',
      actor: { _id: 'newActor', name: 'NewUser' },
      relatedMedia: 'm1',
    });

    expect(existing.actors.length).toBe(2);
    expect(existing.actorCount).toBe(2);
    expect(existing.message).toContain('NewUser');
  });

  it('throws on unsupported type', async () => {
    await expect(upsertAggregatedNotification({
      type: 'mystery',
      recipient: 'r1',
      actor: { _id: 'a1', name: 'A' },
    })).rejects.toThrow(/unsupported type/);
  });

  it('throws when actor is missing', async () => {
    await expect(upsertAggregatedNotification({
      type: 'like',
      recipient: 'r1',
      actor: null,
    })).rejects.toThrow(/recipient and actor/);
  });
});
