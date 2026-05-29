import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
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
const SKIP_REFRESH_ENDPOINTS = ['/auth/login', '/auth/register', '/auth/refresh', '/users/me'];

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
        await axios.post('/api/auth/refresh', null, { withCredentials: true });
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
