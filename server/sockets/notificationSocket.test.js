import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./index.js', () => ({
  emitToUser: vi.fn(() => true),
}));

const { emitToUser } = await import('./index.js');
const {
  notifyUser,
  emitPhotoLikedToOwner,
  emitNewCommentToUser,
  emitUserTagged,
} = await import('./notificationSocket.js');

describe('notificationSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('notifyUser', () => {
    it('should emit notification event to the recipient', () => {
      const doc = { _id: 'n1', type: 'like', message: 'Someone liked your photo' };
      const result = notifyUser('user-1', doc, 'user-2');

      expect(result).toBe(true);
      expect(emitToUser).toHaveBeenCalledWith('user-1', 'notification', doc);
    });

    it('should short-circuit when recipientId equals actorId', () => {
      const doc = { _id: 'n1', type: 'like' };
      const result = notifyUser('user-1', doc, 'user-1');

      expect(result).toBe(false);
      expect(emitToUser).not.toHaveBeenCalled();
    });

    it('should handle ObjectId-like string comparison', () => {
      const id = '507f1f77bcf86cd799439011';
      const doc = { _id: 'n1' };
      const result = notifyUser(id, doc, id);

      expect(result).toBe(false);
      expect(emitToUser).not.toHaveBeenCalled();
    });
  });

  describe('emitPhotoLikedToOwner', () => {
    it('should emit photo-liked event to the owner', () => {
      const payload = { mediaId: 'm1', count: 5, by: { _id: 'actor1', name: 'Actor' } };
      const result = emitPhotoLikedToOwner('owner-1', payload, 'actor1');

      expect(result).toBe(true);
      expect(emitToUser).toHaveBeenCalledWith('owner-1', 'photo-liked', payload);
    });

    it('should short-circuit when ownerId equals actorId', () => {
      const payload = { mediaId: 'm1', count: 5, by: { _id: 'user-1', name: 'User' } };
      const result = emitPhotoLikedToOwner('user-1', payload, 'user-1');

      expect(result).toBe(false);
      expect(emitToUser).not.toHaveBeenCalled();
    });
  });

  describe('emitNewCommentToUser', () => {
    it('should emit new-comment event to the recipient', () => {
      const payload = { _id: 'c1', mediaId: 'm1', text: 'Nice!', user: { _id: 'actor1', name: 'Actor' } };
      const result = emitNewCommentToUser('recipient-1', payload, 'actor1');

      expect(result).toBe(true);
      expect(emitToUser).toHaveBeenCalledWith('recipient-1', 'new-comment', payload);
    });

    it('should short-circuit when recipientId equals actorId', () => {
      const payload = { _id: 'c1', mediaId: 'm1', text: 'Nice!' };
      const result = emitNewCommentToUser('user-1', payload, 'user-1');

      expect(result).toBe(false);
      expect(emitToUser).not.toHaveBeenCalled();
    });
  });

  describe('emitUserTagged', () => {
    it('should emit user-tagged event to the tagged user', () => {
      const payload = { mediaId: 'm1', eventId: 'e1', by: { _id: 'actor1', name: 'Actor' } };
      const result = emitUserTagged('tagged-1', payload, 'actor1');

      expect(result).toBe(true);
      expect(emitToUser).toHaveBeenCalledWith('tagged-1', 'user-tagged', payload);
    });

    it('should short-circuit when taggedUserId equals actorId', () => {
      const payload = { mediaId: 'm1', eventId: 'e1', by: { _id: 'user-1', name: 'User' } };
      const result = emitUserTagged('user-1', payload, 'user-1');

      expect(result).toBe(false);
      expect(emitToUser).not.toHaveBeenCalled();
    });
  });
});
