import { Navigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore.js';

/**
 * Redirects authenticated users away from guest-only pages (login, register, landing).
 * Authenticated users go to /events instead.
 */
export default function GuestRoute({ children }) {
  const hydrated = useAuthStore((state) => state.hydrated);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-obsidian flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-graphite border-t-snow rounded-full animate-spin" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/events" replace />;
  }

  return children;
}
