import { create } from 'zustand';
import api from '../utils/api.js';

const useMediaStore = create((set, get) => ({
  items: [],
  hasMore: true,
  page: 1,
  sortBy: 'uploadDate',
  sortOrder: 'desc',
  eventFilter: null,
  loading: false,
  error: null,
  stale: false,

  fetchMedia: async () => {
    set({ loading: true, error: null, stale: false });
    try {
      const { sortBy, sortOrder, eventFilter } = get();
      const params = { page: 1, sortBy, sortOrder };
      if (eventFilter) {
        params.eventId = eventFilter;
      }
      const response = await api.get('/media', { params });
      const data = response.data.data;
      const items = Array.isArray(data) ? data : data.items || [];
      const hasMore = Array.isArray(data) ? items.length >= 20 : (data.hasMore ?? items.length >= 20);
      set({ items, hasMore, page: 1, loading: false });
    } catch (error) {
      set({ error: error.response?.data?.error || 'Failed to fetch media', loading: false });
    }
  },

  loadMore: async () => {
    const { hasMore, loading, page, sortBy, sortOrder, eventFilter } = get();
    if (!hasMore || loading) return;
    set({ loading: true, error: null });
    try {
      const nextPage = page + 1;
      const params = { page: nextPage, sortBy, sortOrder };
      if (eventFilter) {
        params.eventId = eventFilter;
      }
      const response = await api.get('/media', { params });
      const data = response.data.data;
      const newItems = Array.isArray(data) ? data : data.items || [];
      const hasMoreResult = Array.isArray(data) ? newItems.length >= 20 : (data.hasMore ?? newItems.length >= 20);
      set((state) => ({
        items: [...state.items, ...newItems],
        hasMore: hasMoreResult,
        page: nextPage,
        loading: false,
      }));
    } catch (error) {
      set({ error: error.response?.data?.error || 'Failed to load more media', loading: false });
    }
  },

  setSort: (sortBy, sortOrder) => {
    set({ sortBy, sortOrder, items: [], hasMore: true, page: 1 });
    get().fetchMedia();
  },

  setEventFilter: (eventId) => {
    set({ eventFilter: eventId || null, items: [], hasMore: true, page: 1 });
    get().fetchMedia();
  },

  toggleFavourite: async (mediaId) => {
    try {
      const response = await api.post(`/media/${mediaId}/favourite`);
      const updatedMedia = response.data.data;
      set((state) => ({
        items: state.items.map((item) =>
          item._id === mediaId
            ? { ...item, isFavourited: updatedMedia.favourited, favouriteCount: updatedMedia.favouriteCount }
            : item
        ),
      }));
    } catch (error) {
      set({ error: error.response?.data?.error || 'Failed to toggle favourite' });
    }
  },

  addComment: async (mediaId, text) => {
    try {
      const response = await api.post(`/media/${mediaId}/comments`, { text });
      const newComment = response.data.data;
      set((state) => ({
        items: state.items.map((item) =>
          item._id === mediaId
            ? { ...item, comments: [...(item.comments || []), newComment] }
            : item
        ),
      }));
      return newComment;
    } catch (error) {
      set({ error: error.response?.data?.error || 'Failed to add comment' });
      throw error;
    }
  },

  /**
   * Prepend a new media item to the top of the list (used by realtime socket events).
   * Skips if the item already exists (idempotent by _id).
   */
  prependMedia: (media) => {
    set((state) => {
      if (state.items.some((item) => item._id === media._id)) {
        return state;
      }
      return { items: [media, ...state.items] };
    });
  },

  /**
   * Mark the gallery as stale so the next render/interaction triggers a refetch.
   * Sets a `stale` flag that consuming components can check.
   */
  markStale: () => {
    set({ stale: true });
  },

  /**
   * Apply server-pushed smart tags to a media item already in the list.
   * No-op if the item isn't loaded yet (the next fetch will pick up the tags).
   */
  applyMediaTags: (mediaId, tags) => {
    if (!mediaId || !Array.isArray(tags)) return;
    set((state) => ({
      items: state.items.map((item) =>
        item._id === mediaId ? { ...item, tags } : item
      ),
    }));
  },

  /**
   * Apply a server-pushed AI caption to a media item already in the list.
   * No-op if the item isn't loaded yet.
   */
  applyMediaCaption: (mediaId, caption) => {
    if (!mediaId || typeof caption !== 'string') return;
    set((state) => ({
      items: state.items.map((item) =>
        item._id === mediaId ? { ...item, caption } : item
      ),
    }));
  },
}));

export default useMediaStore;
