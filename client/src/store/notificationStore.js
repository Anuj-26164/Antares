import { create } from 'zustand';
import api from '../utils/api.js';

/**
 * Normalise any incoming notification payload into a consistent shape.
 * Handles both full DB documents (from fetchInitial) and socket payloads
 * (from `notification` or `user-tagged` events).
 */
function normalise(raw) {
  if (!raw) return null;

  // Already a well-formed notification doc
  if (raw._id && raw.type && raw.title && raw.message) {
    return {
      _id:         String(raw._id),
      type:        raw.type,
      title:       raw.title,
      message:     raw.message,
      isRead:      raw.isRead ?? false,
      createdAt:   raw.createdAt ?? new Date().toISOString(),
      relatedUser: raw.relatedUser ?? null,
      relatedMedia:raw.relatedMedia ?? null,
      relatedEvent:raw.relatedEvent ?? null,
      recipient:   raw.recipient ?? null,
    };
  }

  // Fallback: build a minimal shape from whatever fields exist
  const type    = raw.type || 'unknown';
  const title   = raw.title  || typeTitles[type]  || 'Notification';
  const message = raw.message || raw.text || raw.content || typeMessages[type] || '';

  return {
    _id:         String(raw._id || `tmp-${Date.now()}-${Math.random()}`),
    type,
    title,
    message,
    isRead:      raw.isRead ?? false,
    createdAt:   raw.createdAt ?? new Date().toISOString(),
    relatedUser: raw.relatedUser ?? raw.by ?? null,
    relatedMedia:raw.relatedMedia ?? (raw.mediaId ? { _id: raw.mediaId } : null),
    relatedEvent:raw.relatedEvent ?? (raw.eventId ? { _id: raw.eventId } : null),
    recipient:   raw.recipient ?? null,
  };
}

const typeTitles = {
  like:           'New like',
  comment:        'New comment',
  tag:            'You were tagged',
  media_upload:   'New upload',
  user_registration: 'New member',
  activity:       'Activity',
};

const typeMessages = {
  like:    'Someone liked your photo',
  comment: 'Someone commented on your photo',
  tag:     'You were tagged in a photo',
};

const useNotificationStore = create((set, get) => ({
  list: [],
  unreadCount: 0,

  /**
   * Prepend a new notification. Deduplicates by _id to prevent
   * socket + fetchInitial double-entries.
   */
  addNotification: (raw) => {
    const n = normalise(raw);
    if (!n) return;

    set((state) => {
      // Deduplicate — skip if already in list
      if (state.list.some((existing) => existing._id === n._id)) return state;
      return {
        list: [n, ...state.list],
        unreadCount: n.isRead ? state.unreadCount : state.unreadCount + 1,
      };
    });
  },

  /**
   * Mark a single notification as read by id.
   */
  markRead: (id) => {
    set((state) => {
      const target = state.list.find((n) => n._id === id);
      if (!target || target.isRead) return state;
      return {
        list: state.list.map((n) =>
          n._id === id ? { ...n, isRead: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      };
    });
  },

  /**
   * Mark all notifications as read and reset unread count to 0.
   */
  markAllRead: () => {
    set((state) => ({
      list: state.list.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    }));
  },

  /**
   * Fetch initial notifications from the API to hydrate on connect.
   * Normalises all items and deduplicates against existing list.
   */
  fetchInitial: async () => {
    try {
      const response = await api.get('/notifications');
      const raw = response.data.data || response.data || [];
      const incoming = Array.isArray(raw) ? raw.map(normalise).filter(Boolean) : [];

      set((state) => {
        // Merge: keep any socket-pushed items not yet in DB, prepend DB list
        const existingIds = new Set(incoming.map((n) => n._id));
        const socketOnly  = state.list.filter((n) => !existingIds.has(n._id));
        const merged      = [...socketOnly, ...incoming];
        const serverUnread = incoming.filter((n) => !n.isRead).length;
        return {
          list: merged,
          unreadCount: Math.max(state.unreadCount, serverUnread),
        };
      });
    } catch {
      // Silently fail — notifications are non-critical
    }
  },
}));

export default useNotificationStore;
