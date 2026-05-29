import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell } from 'lucide-react';
import useAuthStore from '../../store/authStore.js';
import useNotificationStore from '../../store/notificationStore.js';
import { getUserAvatar } from '../../utils/avatar.js';
import api from '../../utils/api.js';
import { NotifItem } from '../common/NotifItem.jsx';

const pathTitles = {
  '/admin': 'Analytics',
  '/admin/events': 'Event Management',
  '/admin/media': 'Media Management',
  '/admin/users': 'User Management',
  '/admin/notifications': 'Notifications',
  '/admin/ai-insights': 'AI Insights',
  '/admin/settings': 'Settings',
};

export default function AdminTopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  // Use the shared notification store — same source of truth as AppNavbar
  const unreadCount  = useNotificationStore((state) => state.unreadCount);
  const list         = useNotificationStore((state) => state.list);
  const markAllRead  = useNotificationStore((state) => state.markAllRead);

  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const [notifPos, setNotifPos] = useState({ top: 0, right: 0 });
  const notifBtnRef = useRef(null);
  const notifMenuRef = useRef(null);
  const profileRef = useRef(null);
  const profileBtnRef = useRef(null);

  const title = pathTitles[location.pathname] || 'Admin';

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifBtnRef.current?.contains(e.target) || notifMenuRef.current?.contains(e.target)) return;
      setShowNotifications(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleBellClick = () => {
    const opening = !showNotifications;
    if (opening && notifBtnRef.current) {
      const rect = notifBtnRef.current.getBoundingClientRect();
      setNotifPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    }
    setShowNotifications(opening);
    if (opening && unreadCount > 0) {
      markAllRead();
      api.patch('/notifications/read-all').catch(() => {});
    }
  };

  // Show the 5 most recent notifications from the store
  const recentNotifications = list.slice(0, 5);

  return (
    <header className="h-16 flex items-center justify-between px-6 bg-snow/80 dark:bg-ink/80 backdrop-blur-sm border-b border-fog dark:border-graphite shrink-0">
      {/* Left: Section title */}
      <h2 className="text-[18px] font-semibold text-ink dark:text-snow">{title}</h2>

      {/* Right: Notifications, user, theme toggle */}
      <div className="flex items-center gap-4">
        {/* Notifications bell */}
        <div className="relative">
          <button
            ref={notifBtnRef}
            onClick={handleBellClick}
            className="relative w-9 h-9 rounded-full flex items-center justify-center text-ash hover:text-snow transition-colors"
            aria-label="Notifications"
          >
            <Bell size={20} />
            <AnimatePresence>
              {unreadCount > 0 && (
                <motion.span
                  key="badge"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                  className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 pointer-events-none"
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>

        {/* Notifications dropdown — portal to escape header stacking context */}
        {showNotifications && createPortal(
          <div
            ref={notifMenuRef}
            className="fixed w-[320px] bg-ink border border-graphite rounded-[14px] shadow-2xl overflow-hidden"
            style={{ top: notifPos.top, right: notifPos.right, zIndex: 99999 }}
          >
            <div className="px-4 py-3 border-b border-graphite/50">
              <p className="text-snow text-[14px] font-medium">Notifications</p>
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {recentNotifications.length === 0 ? (
                <p className="px-4 py-6 text-ash text-[13px] text-center">No notifications</p>
              ) : (
                recentNotifications.map((n) => (
                  <NotifItem key={n._id} n={n} />
                ))
              )}
            </div>
          </div>,
          document.body
        )}

        {/* User avatar with dropdown */}
        <div ref={profileRef}>
          <button
            ref={profileBtnRef}
            onClick={() => {
              if (!showProfileMenu && profileBtnRef.current) {
                const rect = profileBtnRef.current.getBoundingClientRect();
                setMenuPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
              }
              setShowProfileMenu(!showProfileMenu);
            }}
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 rounded-full bg-graphite flex items-center justify-center overflow-hidden border-2 border-transparent hover:border-brand/50 transition-all">
              <img src={getUserAvatar(user)} alt={user?.name || 'User'} className="w-full h-full object-cover" />
            </div>
            <span className="text-snow text-[13px] font-medium hidden sm:inline">
              {user?.name || 'Admin'}
            </span>
          </button>
        </div>

        {/* Profile dropdown — rendered via portal to escape stacking contexts */}
        {showProfileMenu && createPortal(
          <div
            ref={profileRef}
            className="fixed w-[200px] bg-ink border border-graphite rounded-[16px] shadow-2xl overflow-hidden"
            style={{ top: menuPos.top, right: menuPos.right, zIndex: 99999 }}
          >
            {/* User info */}
            <div className="px-4 py-3 border-b border-graphite/50">
              <p className="text-snow text-[13px] font-semibold truncate">{user?.name || 'Admin'}</p>
              <p className="text-ash text-[11px] truncate">{user?.email || ''}</p>
            </div>

            {/* Menu items */}
            <div className="py-1.5">
              <button
                onClick={() => { setShowProfileMenu(false); navigate('/profile'); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-ash hover:text-snow hover:bg-white/5 transition-colors text-left"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                Profile
              </button>
              <button
                onClick={() => { setShowProfileMenu(false); navigate('/admin/settings'); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-ash hover:text-snow hover:bg-white/5 transition-colors text-left"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68 1.65 1.65 0 0 0 9 3.17V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
                Settings
              </button>
            </div>

            {/* Logout */}
            <div className="border-t border-graphite/50 py-1.5">
              <button
                onClick={async () => { setShowProfileMenu(false); await logout(); navigate('/'); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-red-400 hover:text-red-300 hover:bg-red-500/5 transition-colors text-left"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Log Out
              </button>
            </div>
          </div>,
          document.body
        )}
      </div>
    </header>
  );
}
