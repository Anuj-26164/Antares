import { describe, it, expect, beforeEach } from 'vitest';
import { markOnline, markOffline, isOnline, getOnlineUserIds } from './presenceSocket.js';

describe('presenceSocket', () => {
  beforeEach(() => {
    // Clear all online users between tests
    for (const id of getOnlineUserIds()) {
      markOffline(id);
    }
  });

  describe('markOnline', () => {
    it('should mark a user as online', () => {
      markOnline('user1');
      expect(isOnline('user1')).toBe(true);
    });

    it('should handle duplicate markOnline calls idempotently', () => {
      markOnline('user1');
      markOnline('user1');
      expect(getOnlineUserIds().filter(id => id === 'user1')).toHaveLength(1);
    });

    it('should ignore null/undefined/empty userId', () => {
      markOnline(null);
      markOnline(undefined);
      markOnline('');
      expect(getOnlineUserIds()).toHaveLength(0);
    });

    it('should coerce non-string userId to string', () => {
      markOnline(123);
      expect(isOnline('123')).toBe(true);
    });
  });

  describe('markOffline', () => {
    it('should mark a user as offline', () => {
      markOnline('user1');
      markOffline('user1');
      expect(isOnline('user1')).toBe(false);
    });

    it('should be a no-op for users not currently online', () => {
      markOffline('nonexistent');
      expect(getOnlineUserIds()).toHaveLength(0);
    });

    it('should ignore null/undefined/empty userId', () => {
      markOnline('user1');
      markOffline(null);
      markOffline(undefined);
      markOffline('');
      expect(isOnline('user1')).toBe(true);
    });
  });

  describe('isOnline', () => {
    it('should return false for users not online', () => {
      expect(isOnline('user1')).toBe(false);
    });

    it('should return true for online users', () => {
      markOnline('user1');
      expect(isOnline('user1')).toBe(true);
    });

    it('should return false for null/undefined/empty userId', () => {
      expect(isOnline(null)).toBe(false);
      expect(isOnline(undefined)).toBe(false);
      expect(isOnline('')).toBe(false);
    });
  });

  describe('getOnlineUserIds', () => {
    it('should return an empty array when no users are online', () => {
      expect(getOnlineUserIds()).toEqual([]);
    });

    it('should return all online user IDs', () => {
      markOnline('user1');
      markOnline('user2');
      markOnline('user3');
      const ids = getOnlineUserIds();
      expect(ids).toHaveLength(3);
      expect(ids).toContain('user1');
      expect(ids).toContain('user2');
      expect(ids).toContain('user3');
    });

    it('should return a new array (not a reference to internal state)', () => {
      markOnline('user1');
      const ids1 = getOnlineUserIds();
      const ids2 = getOnlineUserIds();
      expect(ids1).not.toBe(ids2);
      expect(ids1).toEqual(ids2);
    });
  });
});
