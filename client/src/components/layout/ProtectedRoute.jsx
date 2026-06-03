import { Navigate, Outlet } from 'react-router-dom';
import useAuthStore from '../../store/authStore.js';
import PageLoader from '../common/PageLoader.jsx';

/**
 * Blocks rendering until hydration completes, then redirects
 * unauthenticated users to /login.
 */
export default function ProtectedRoute({ children }) {
  const hydrated = useAuthStore((state) => state.hydrated);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  // Wait for auth state to be determined
  if (!hydrated) {
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children || <Outlet />;
}
