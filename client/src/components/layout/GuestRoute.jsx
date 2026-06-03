import { Navigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore.js';
import PageLoader from '../common/PageLoader.jsx';

/**
 * Redirects authenticated users away from guest-only pages (login, register, landing).
 * Authenticated users go to /events instead.
 */
export default function GuestRoute({ children }) {
  const hydrated = useAuthStore((state) => state.hydrated);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!hydrated) {
    return <PageLoader />;
  }

  if (isAuthenticated) {
    return <Navigate to="/events" replace />;
  }

  return children;
}
