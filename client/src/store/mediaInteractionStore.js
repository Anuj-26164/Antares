import { create } from 'zustand';
import api from '../utils/api.js';
import { debounce } from '../utils/debounce.js';
import useAuthStore from './authStore.js';

/**
 * Debounced internal updater for applyRemoteLike.
 * Keyed by mediaId — each mediaId gets its own debounced setter.
 */
const debouncedLikeSetters = new Map();

function getDebouncedLikeSetter(mediaId, set, get) {
  if (!debouncedLikeSetters.has(mediaId)) {
    const fn = debounce(({ count, by, liked }) => {
      const current = get().byId[mediaId];
      // Only update `favourited` if we know the actor is the current user;
      // otherwise leave it as-is (or undefined so components fall back to media props).
      const actorId = by?._id ? String(by._id) : null;
      const currentUserId = useAuthStore.getState().user?._id
        ? String(useAuthStore.getState().user._id)
        : null;
      const isSelf = actorId && currentUserId && actorId === currentUserId;

      if (!current) {
        set({
          byId: {
            ...get().byId,
            [mediaId]: {
              // `undefined` signals "unknown — use media prop fallback"
              favourited: isSelf ? !!liked : undefined,
              favouriteCount: count,
              comments: [],
            },
          },
        });
      } else {
        set({
          byId: {
            ...get().byId,
            [mediaId]: {
              ...current,
              favouriteCount: count,
              ...(isSelf ? { favourited: !!liked } : {}),
            },
          },
        });
      }
    }, 300);
    debouncedLikeSetters.set(mediaId, fn);
  }
  return debouncedLikeSetters.get(mediaId);
}

const useMediaInteractionStore = create((set, get) => ({
  byId: {},

  /**
   * Optimistically toggles favourite for a media item.
   * Rolls back on API failure.
   * Validates: Requirements 8.1, 8.2
   */
  toggleFavourite: async (mediaId, seed = {}) => {
    const prev = get().byId[mediaId] ?? {
      favourited: seed.favourited ?? false,
      favouriteCount: seed.favouriteCount ?? 0,
      comments: [],
    };

    // Optimistic update
    const next = {
      ...prev,
      favourited: !prev.favourited,
      favouriteCount: prev.favouriteCount + (prev.favourited ? -1 : 1),
    };
    set({ byId: { ...get().byId, [mediaId]: next } });

    try {
      const res = await api.post(`/media/${mediaId}/favourite`);
      const payload = res.data?.data ?? res.data ?? {};
      const serverCount = payload.favouriteCount ?? next.favouriteCount;
      const serverFavourited = typeof payload.favourited === 'boolean'
        ? payload.favourited
        : next.favourited;
      // Reconcile with server truth
      set({
        byId: {
          ...get().byId,
          [mediaId]: {
            ...get().byId[mediaId],
            favourited: serverFavourited,
            favouriteCount: serverCount,
          },
        },
      });
    } catch (err) {
      // Rollback
      set({ byId: { ...get().byId, [mediaId]: prev } });
      throw err;
    }
  },

  /**
   * Optimistically adds a comment to a media item.
   * Rolls back on API failure.
   * Validates: Requirements 8.1, 8.2
   */
  addComment: async (mediaId, text) => {
    const user = useAuthStore.getState().user;
    const tempId = `tmp:${Date.now()}`;
    const prev = get().byId[mediaId] ?? {
      favourited: false,
      favouriteCount: 0,
      comments: [],
    };

    const optimisticComment = {
      _id: tempId,
      text,
      user: user ? { _id: user._id, name: user.name, avatar: user.avatar ?? null } : null,
      createdAt: new Date().toISOString(),
      pending: true,
    };

    // Optimistic update — append temp comment
    set({
      byId: {
        ...get().byId,
        [mediaId]: { ...prev, comments: [...prev.comments, optimisticComment] },
      },
    });

    try {
      const res = await api.post(`/media/${mediaId}/comments`, { text });
      const serverComment = res.data.data ?? res.data;
      // Replace temp comment with real server response
      const real = {
        ...serverComment,
        user: optimisticComment.user,
        pending: false,
      };
      set((state) => ({
        byId: {
          ...state.byId,
          [mediaId]: {
            ...state.byId[mediaId],
            comments: state.byId[mediaId].comments.map((c) =>
              c._id === tempId ? real : c
            ),
          },
        },
      }));
      return real;
    } catch (err) {
      // Rollback
      set({ byId: { ...get().byId, [mediaId]: prev } });
      throw err;
    }
  },

  /**
   * Idempotent set of favouriteCount from a remote socket event.
   * Debounced at 300ms per mediaId to avoid rapid re-renders.
   * Only updates the actor's own `favourited` state — for other users,
   * leaves `favourited` untouched so it falls back to media props.
   * Validates: Requirements 8.3
   */
  applyRemoteLike: ({ mediaId, count, by, liked }) => {
    const setter = getDebouncedLikeSetter(mediaId, set, get);
    setter({ count, by, liked });
  },

  /**
   * Appends a remote comment only if its _id is not already present (idempotent).
   * Validates: Requirements 8.4
   */
  applyRemoteComment: ({ mediaId, comment }) => {
    if (!comment || !mediaId) return;

    const current = get().byId[mediaId] ?? {
      favourited: false,
      favouriteCount: 0,
      comments: [],
    };

    // Idempotent — skip if comment already exists
    if (current.comments.some((c) => c && c._id === comment._id)) {
      return;
    }

    // Normalise field names — server may send userId or user
    const normalised = {
      ...comment,
      user: comment.user ?? (comment.userId ? { _id: comment.userId._id ?? comment.userId, name: comment.userId.name ?? 'User', avatar: comment.userId.avatar ?? null } : null),
      pending: false,
    };

    set({
      byId: {
        ...get().byId,
        [mediaId]: {
          ...current,
          comments: [...current.comments, normalised],
        },
      },
    });
  },
}));

export default useMediaInteractionStore;
