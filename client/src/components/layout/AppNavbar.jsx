import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell } from 'lucide-react';
import useAuthStore from '../../store/authStore.js';
import useNotificationStore from '../../store/notificationStore.js';
import api from '../../utils/api.js';
import { getUserAvatar, getFallbackAvatar } from '../../utils/avatar.js';
import PillNav from '../common/PillNav.jsx';
import { NotifItem, getNotifLink } from '../common/NotifItem.jsx';

const BRAND_DARK = '#120F17';
const BRAND_BLUE = '#60A5FA';

export default function AppNavbar() {
  const user            = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const logout          = useAuthStore((state) => state.logout);
  const unreadCount     = useNotificationStore((state) => state.unreadCount);
  const list            = useNotificationStore((state) => state.list);
  const markAllRead     = useNotificationStore((state) => state.markAllRead);
  const location        = useLocation();
  const navigate        = useNavigate();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const avatarBtnRef = useRef(null);
  const menuRef = useRef(null);
  const notifBtnRef = useRef(null);
  const notifMenuRef = useRef(null);

  // Close on route change
  useEffect(() => {
    setDropdownOpen(false);
    setNotifOpen(false);
  }, [location.pathname]);

  // Close on outside click
  const handleClickOutside = useCallback((e) => {
    if (
      avatarBtnRef.current?.contains(e.target) ||
      menuRef.current?.contains(e.target)
    ) return;
    setDropdownOpen(false);
  }, []);

  useEffect(() => {
    if (dropdownOpen) {
      // Use setTimeout to avoid the same click event closing it
      const timer = setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
      }, 0);
      return () => {
        clearTimeout(timer);
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [dropdownOpen, handleClickOutside]);

  // Close notification popover on outside click
  const handleNotifClickOutside = useCallback((e) => {
    if (
      notifBtnRef.current?.contains(e.target) ||
      notifMenuRef.current?.contains(e.target)
    ) return;
    setNotifOpen(false);
  }, []);

  useEffect(() => {
    if (notifOpen) {
      const timer = setTimeout(() => {
        document.addEventListener('click', handleNotifClickOutside);
      }, 0);
      return () => {
        clearTimeout(timer);
        document.removeEventListener('click', handleNotifClickOutside);
      };
    }
  }, [notifOpen, handleNotifClickOutside]);

  const items = useMemo(() => {
    if (isAuthenticated) {
      const base = [
        { label: 'Events', href: '/events' },
        { label: 'Gallery', href: '/gallery' },
      ];
      if (user?.role === 'admin') {
        base.push({ label: 'Admin', href: '/admin' });
      }
      return base;
    }
    return [
      { label: 'Home',    href: '/' },
      { label: 'Events',  href: '/events' },
      { label: 'Sign In', href: '/login' },
      { label: 'Sign Up', href: '/register' },
    ];
  }, [isAuthenticated, user?.role]);

  const handleSignOut = async () => {
    setDropdownOpen(false);
    await logout();
    navigate('/');
  };

  const toggleDropdown = () => {
    setDropdownOpen(prev => !prev);
  };

  const toggleNotifPopover = () => {
    setNotifOpen(prev => {
      const opening = !prev;
      // Auto-clear badge when the popover opens
      if (opening && unreadCount > 0) {
        markAllRead();
        // Persist to server — await to ensure DB is updated before any refetch
        api.patch('/notifications/read-all').catch(() => {});
      }
      return opening;
    });
  };

  const handleMarkAllRead = () => {
    markAllRead();
    api.patch('/notifications/read-all').catch(() => {});
    setNotifOpen(false);
  };

  // Avatar button as rightSlot
  const rightSlot = isAuthenticated ? (
    <div className="flex items-center gap-3">
      {/* Notification Bell */}
      <button
        ref={notifBtnRef}
        onClick={toggleNotifPopover}
        className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors duration-200 cursor-pointer"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell size={20} className="text-white/70 hover:text-white transition-colors" />
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

      {/* Avatar */}
      <button
        ref={avatarBtnRef}
        onClick={toggleDropdown}
        className="w-9 h-9 rounded-full overflow-hidden border-2 border-transparent hover:border-brand/50 transition-all duration-200 cursor-pointer"
      >
        <img
          src={getUserAvatar(user)}
          alt={user?.name || 'Profile'}
          className="w-full h-full object-cover"
          onError={(e) => {
            const fallback = getFallbackAvatar(user);
            if (e.currentTarget.src !== fallback) {
              e.currentTarget.src = fallback;
            }
          }}
        />
      </button>
    </div>
  ) : null;

  return (
    <>
      <PillNav
        logo="/antareslogo.svg"
        logoAlt="Antares"
        brandName="ANTARES"
        items={items}
        activeHref={location.pathname}
        baseColor={BRAND_DARK}
        pillColor={BRAND_BLUE}
        pillTextColor={BRAND_DARK}
        hoveredPillTextColor={BRAND_DARK}
        initialLoadAnimation={true}
        rightSlot={rightSlot}
      />

      {/* Profile dropdown — rendered outside PillNav as a fixed overlay */}
      {dropdownOpen && isAuthenticated && (
        <div
          ref={menuRef}
          className="fixed w-[200px] rounded-[16px] overflow-hidden"
          style={{
            top: '86px',
            right: '16px',
            zIndex: 99999,
            background: '#18181b',
            border: '1px solid rgba(96,165,250,0.15)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
          }}
        >
          <div className="px-4 py-3 border-b border-graphite/50">
            <p className="text-snow text-[13px] font-semibold truncate">{user?.name || 'User'}</p>
            <p className="text-ash text-[11px] truncate">{user?.email || ''}</p>
          </div>

          <div className="py-1.5">
            <button
              onClick={() => { setDropdownOpen(false); navigate('/profile'); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-ash hover:text-snow hover:bg-white/5 transition-colors text-left"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              Profile
            </button>
            <button
              onClick={() => { setDropdownOpen(false); navigate('/profile'); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-ash hover:text-snow hover:bg-white/5 transition-colors text-left"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68 1.65 1.65 0 0 0 9 3.17V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              Settings
            </button>
          </div>

          <div className="border-t border-graphite/50 py-1.5">
            <button
              onClick={handleSignOut}
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
        </div>
      )}

      {/* Notification popover */}
      {notifOpen && isAuthenticated && (
        <div
          ref={notifMenuRef}
          className="fixed w-[320px] rounded-[16px] overflow-hidden"
          style={{
            top: '86px',
            right: '60px',
            zIndex: 99999,
            background: '#18181b',
            border: '1px solid rgba(96,165,250,0.15)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
          }}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-graphite/50 flex items-center justify-between">
            <p className="text-snow text-[13px] font-semibold">Notifications</p>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[360px] overflow-y-auto">
            {list.length === 0 ? (
              <p className="px-4 py-8 text-ash text-[13px] text-center">All caught up!</p>
            ) : (
              list.slice(0, 10).map((n) => {
                const link = getNotifLink(n);
                return (
                  <NotifItem
                    key={n._id}
                    n={n}
                    onClick={link ? () => {
                      // Mark as read locally + on server
                      if (!n.isRead) {
                        useNotificationStore.getState().markRead(n._id);
                        api.patch(`/notifications/${n._id}/read`).catch(() => {});
                      }
                      setNotifOpen(false);
                      navigate(link);
                    } : undefined}
                  />
                );
              })
            )}
          </div>
        </div>
      )}
    </>
  );
}
