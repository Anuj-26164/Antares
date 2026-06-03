import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import useAuthStore from './store/authStore.js';
import { connectSocket, disconnectSocket } from './sockets/socket.js';
import { subscribeToNotifications } from './sockets/notificationSocket.js';
import { subscribeToActivity } from './sockets/activitySocket.js';
import useNotificationStore from './store/notificationStore.js';
import AppNavbar from './components/layout/AppNavbar.jsx';
import LandingPage from './pages/LandingPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import GalleryPage from './pages/GalleryPage.jsx';
import EventsPage from './pages/EventsPage.jsx';
import EventAlbumPage from './pages/EventAlbumPage.jsx';
import ProtectedRoute from './components/layout/ProtectedRoute.jsx';
import GuestRoute from './components/layout/GuestRoute.jsx';
import AdminRouteGuard from './components/layout/AdminRouteGuard.jsx';
import AdminLayout from './components/admin/AdminLayout.jsx';
import AnalyticsPanel from './pages/admin/AnalyticsPanel.jsx';
import EventManagementPanel from './pages/admin/EventManagementPanel.jsx';
import MediaManagementPanel from './pages/admin/MediaManagementPanel.jsx';
import UserManagementPanel from './pages/admin/UserManagementPanel.jsx';
import NotificationsPanel from './pages/admin/NotificationsPanel.jsx';
import SettingsPanel from './pages/admin/SettingsPanel.jsx';
import api from './utils/api.js';

const pageTransition = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.3, ease: 'easeOut' },
};

function AnimatedPage({ children }) {
  return (
    <motion.div
      initial={pageTransition.initial}
      animate={pageTransition.animate}
      exit={pageTransition.exit}
      transition={pageTransition.transition}
    >
      {children}
    </motion.div>
  );
}

// PillNav now appears on every page, including admin routes, so the
// top-level navigation stays consistent.

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const initAuth = useAuthStore((state) => state.initAuth);
  const hydrated = useAuthStore((state) => state.hydrated);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  // Handle Google OAuth redirect — ?token= param is passed back from the backend.
  // Exchange it for proper httpOnly cookies via POST /auth/session, then clean the URL.
  // If no token present, fall through to normal initAuth.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (token) {
      // Remove token from URL immediately so it's not visible or bookmarkable
      params.delete('token');
      const cleanSearch = params.toString();
      navigate(location.pathname + (cleanSearch ? `?${cleanSearch}` : ''), { replace: true });

      api.post('/auth/session', { token })
        .then((res) => {
          const user = res.data.data;
          useAuthStore.setState({ user, isAuthenticated: true, hydrated: true });
          try { localStorage.setItem('antares_user', JSON.stringify(user)); } catch { /* ignore */ }
        })
        .catch(() => {
          initAuth();
        });
    } else {
      initAuth();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Socket lifecycle — connect when authenticated, disconnect on logout/cleanup
  useEffect(() => {
    if (!isAuthenticated) return;

    connectSocket();
    const unsubNotifications = subscribeToNotifications();
    const unsubActivity = subscribeToActivity();
    useNotificationStore.getState().fetchInitial();

    return () => {
      unsubNotifications();
      unsubActivity();
      disconnectSocket();
    };
  }, [isAuthenticated]);

  // Block ALL rendering until hydration completes
  if (!hydrated) {
    return (
      <div className="min-h-screen bg-obsidian flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <img src="/antareslogo.svg" alt="Antares" className="h-10 w-10 animate-pulse" />
          <div className="w-6 h-6 border-2 border-graphite border-t-snow rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans bg-obsidian">
      {/* PillNav — fixed positioned, floats above all content on every route */}
      <AppNavbar />

      {/* Top padding to clear the fixed navbar (~86px) */}
      <div className="pt-[86px]">
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route
              path="/"
              element={
                <GuestRoute>
                  <AnimatedPage>
                    <LandingPage />
                  </AnimatedPage>
                </GuestRoute>
              }
            />
            <Route
              path="/login"
              element={
                <GuestRoute>
                  <AnimatedPage>
                    <LoginPage />
                  </AnimatedPage>
                </GuestRoute>
              }
            />
            <Route
              path="/register"
              element={
                <GuestRoute>
                  <AnimatedPage>
                    <RegisterPage />
                  </AnimatedPage>
                </GuestRoute>
              }
            />
            <Route
              path="/signup"
              element={
                <GuestRoute>
                  <AnimatedPage>
                    <RegisterPage />
                  </AnimatedPage>
                </GuestRoute>
              }
            />
            <Route
              path="/events"
              element={
                <AnimatedPage>
                  <EventsPage />
                </AnimatedPage>
              }
            />
            <Route
              path="/events/:id"
              element={
                <AnimatedPage>
                  <EventAlbumPage />
                </AnimatedPage>
              }
            />
            <Route
              path="/gallery"
              element={
                <ProtectedRoute>
                  <AnimatedPage>
                    <GalleryPage />
                  </AnimatedPage>
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <AnimatedPage>
                    <ProfilePage />
                  </AnimatedPage>
                </ProtectedRoute>
              }
            />

            {/* Admin routes — has its own layout/sidebar, no PillNav */}
            <Route
              path="/admin"
              element={
                <AdminRouteGuard>
                  <AdminLayout />
                </AdminRouteGuard>
              }
            >
              <Route index element={<AnalyticsPanel />} />
              <Route path="events" element={<EventManagementPanel />} />
              <Route path="media" element={<MediaManagementPanel />} />
              <Route path="users" element={<UserManagementPanel />} />
              <Route path="notifications" element={<NotificationsPanel />} />
              <Route path="settings" element={<SettingsPanel />} />
            </Route>
          </Routes>
        </AnimatePresence>
      </div>
    </div>
  );
}
