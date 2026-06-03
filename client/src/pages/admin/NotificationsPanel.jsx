import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../../utils/api.js';
import { relativeTime } from '../../utils/formatters.js';

function getTypeIcon(type) {
  switch (type) {
    case 'upload':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      );
    case 'user':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case 'event':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      );
    default:
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      );
  }
}

export default function NotificationsPanel() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/notifications', { params: { limit: 50 } });
      setNotifications(res.data.data.notifications || []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id) => {
    try {
      await api.patch(`/admin/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
    } catch {
      // silently fail
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-graphite border-t-snow rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center justify-between mb-6">
        <p className="text-steel dark:text-ash text-[13px]">{notifications.length} notifications</p>
        <button
          onClick={fetchNotifications}
          className="px-3 py-1.5 rounded-[10px] bg-fog dark:bg-graphite text-ink dark:text-snow text-[12px] font-medium hover:bg-graphite/80 transition-colors"
        >
          Refresh
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {notifications.length === 0 ? (
          <p className="text-steel dark:text-ash text-[14px] text-center py-12">No notifications yet</p>
        ) : (
          notifications.map((n) => (
            <div
              key={n._id}
              onClick={() => !n.isRead && markAsRead(n._id)}
              className={`flex items-start gap-3 px-4 py-3 rounded-[14px] border transition-colors cursor-pointer ${
                n.isRead
                  ? 'border-fog dark:border-graphite/50 bg-ink/30'
                  : 'border-l-2 border-l-ember border-graphite bg-ember/5'
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-graphite flex items-center justify-center text-steel dark:text-ash shrink-0 mt-0.5">
                {getTypeIcon(n.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-ink dark:text-snow text-[13px] font-medium">{n.title}</p>
                <p className="text-steel dark:text-ash text-[12px] mt-0.5 truncate">{n.message}</p>
              </div>
              <span className="text-steel dark:text-ash text-[11px] shrink-0">
                {n.createdAt ? relativeTime(n.createdAt) : ''}
              </span>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
}
