import { Navigate, Outlet } from 'react-router-dom';
import useAuthStore from '../../store/authStore.js';

/**
 * Blocks rendering until hydration completes, then redirects
 * unauthenticated users to /login.
 */
export default function ProtectedRoute({ children }) {
  const hydrated = useAuthStore((state) => state.hydrated);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  // Wait for auth state to be determined
  if (!hydrated) {
    return (
      <div className="min-h-screen bg-mist dark:bg-obsidian flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-fog dark:border-graphite border-t-ink dark:border-t-snow rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children || <Outlet />;
}
