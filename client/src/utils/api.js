import axios from 'axios';

const BASE_URL = `${import.meta.env.VITE_API_URL || ''}/api`;

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

let isRefreshing = false;
let failedQueue = [];

function processQueue(error) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve();
    }
  });
  failedQueue = [];
}

// Endpoints that should NOT trigger a token refresh on 401
const SKIP_REFRESH_ENDPOINTS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/session', '/users/me'];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const requestUrl = originalRequest?.url || '';

    // Skip refresh logic for auth/init endpoints — let the 401 pass through directly
    const shouldSkipRefresh = SKIP_REFRESH_ENDPOINTS.some((ep) => requestUrl.includes(ep));

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !shouldSkipRefresh
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => api(originalRequest));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Use absolute backend URL — not a relative path — to avoid hitting the frontend
        await axios.post(`${BASE_URL}/auth/refresh`, null, { withCredentials: true });
        processQueue(null);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);
        // Clear persisted auth state and let the app re-hydrate as unauthenticated
        localStorage.removeItem('antares_user');
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
