import { create } from 'zustand';
import api from '../utils/api.js';
import { disconnectSocket } from '../sockets/socket.js';

const STORAGE_KEY = 'antares_user';

/**
 * Read cached user from localStorage for instant hydration.
 */
function getCachedUser() {
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) return JSON.parse(cached);
  } catch {
    // ignore
  }
  return null;
}

function cacheUser(user) {
  try {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

const cachedUser = getCachedUser();

const useAuthStore = create((set, get) => ({
  user: cachedUser,
  isAuthenticated: !!cachedUser,
  hydrated: false, // true once initAuth completes (success or failure)

  /**
   * Called once on app mount to validate session with the server.
   * Sets hydrated=true when done regardless of outcome.
   */
  initAuth: async () => {
    try {
      const response = await api.get('/users/me', { timeout: 10000 });
      const user = response.data.data;
      cacheUser(user);
      set({ user, isAuthenticated: true, hydrated: true });
    } catch {
      // Session invalid or server unreachable — clear cache
      cacheUser(null);
      set({ user: null, isAuthenticated: false, hydrated: true });
    }
  },

  login: async (credentials) => {
    const response = await api.post('/auth/login', credentials);
    const user = response.data.data;
    cacheUser(user);
    set({ user, isAuthenticated: true });
    return user;
  },

  register: async (data) => {
    const response = await api.post('/auth/register', data);
    const user = response.data.data;
    cacheUser(user);
    set({ user, isAuthenticated: true });
    return user;
  },

  logout: async () => {
    disconnectSocket();
    try {
      await api.post('/auth/logout');
    } catch {
      // Even if logout API fails, clear local state
    }
    cacheUser(null);
    set({ user: null, isAuthenticated: false });
  },

  refreshToken: async () => {
    const response = await api.post('/auth/refresh');
    return response.data;
  },

  googleLogin: () => {
    const apiBase = import.meta.env.VITE_API_URL || '';
    window.location.href = `${apiBase}/api/auth/google`;
  },

  fetchUser: async () => {
    const response = await api.get('/users/me');
    const user = response.data.data;
    cacheUser(user);
    set({ user, isAuthenticated: true });
    return user;
  },
}));

export default useAuthStore;
