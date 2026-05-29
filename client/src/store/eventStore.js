import { create } from 'zustand';
import api from '../utils/api.js';

const useEventStore = create((set) => ({
  events: [],
  currentEvent: null,
  loading: false,
  error: null,

  fetchEvents: async () => {
    set({ loading: true, error: null });
    try {
      const response = await api.get('/events');
      const data = response.data.data;
      const events = Array.isArray(data) ? data : data.events || [];
      set({ events, loading: false });
    } catch (error) {
      set({
        error: error.response?.data?.error || 'Failed to fetch events',
        loading: false,
      });
    }
  },

  fetchEvent: async (id) => {
    set({ loading: true, error: null });
    try {
      const response = await api.get(`/events/${id}`);
      set({ currentEvent: response.data.data, loading: false });
    } catch (error) {
      set({
        error: error.response?.data?.error || 'Failed to fetch event',
        loading: false,
      });
    }
  },

  createEvent: async (data) => {
    set({ loading: true, error: null });
    try {
      const response = await api.post('/events', data);
      set((state) => ({
        events: [...state.events, response.data.data],
        loading: false,
      }));
      return response.data.data;
    } catch (error) {
      set({
        error: error.response?.data?.error || 'Failed to create event',
        loading: false,
      });
      throw error;
    }
  },

  updateEvent: async (id, data) => {
    set({ loading: true, error: null });
    try {
      const response = await api.put(`/events/${id}`, data);
      set((state) => ({
        events: state.events.map((event) =>
          event._id === id ? response.data.data : event
        ),
        currentEvent:
          state.currentEvent?._id === id
            ? response.data.data
            : state.currentEvent,
        loading: false,
      }));
      return response.data.data;
    } catch (error) {
      set({
        error: error.response?.data?.error || 'Failed to update event',
        loading: false,
      });
      throw error;
    }
  },

  deleteEvent: async (id) => {
    set({ loading: true, error: null });
    try {
      await api.delete(`/events/${id}`);
      set((state) => ({
        events: state.events.filter((event) => event._id !== id),
        currentEvent:
          state.currentEvent?._id === id ? null : state.currentEvent,
        loading: false,
      }));
    } catch (error) {
      set({
        error: error.response?.data?.error || 'Failed to delete event',
        loading: false,
      });
      throw error;
    }
  },
}));

export default useEventStore;
