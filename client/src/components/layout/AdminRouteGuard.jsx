import { Navigate, Outlet } from 'react-router-dom';
import useAuthStore from '../../store/authStore.js';
import PageLoader from '../common/PageLoader.jsx';

/**
 * Blocks rendering until hydration completes, then redirects
 * non-admin users appropriately.
 */
export default function AdminRouteGuard({ children }) {
  const hydrated = useAuthStore((state) => state.hydrated);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);

  // Wait for auth state to be determined
  if (!hydrated) {
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return children || <Outlet />;
}
