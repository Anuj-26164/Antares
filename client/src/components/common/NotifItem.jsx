/**
 * Shared notification rendering helpers used by AppNavbar.
 */

import { relativeTime } from '../../utils/formatters.js';

// Re-export so existing imports of `relativeTime` from this module keep working.
export { relativeTime };

/**
 * Determine the navigation path for a notification based on its type
 * and related data.
 *
 * - like / comment / tag / media_upload → event album with media highlighted
 *       (/events/:eventId?media=:mediaId)
 * - upload_request         → event album page (admin can manage from there)
 * - upload_request_decided → event album page (user can now upload)
 * - user_registration      → admin users panel
 * - activity               → event album page (if event data available)
 * - unknown                → null (no navigation)
 */
export function getNotifLink(n) {
  const mediaTypes = ['like', 'comment', 'tag', 'media_upload'];

  if (mediaTypes.includes(n.type)) {
    // relatedMedia may be populated (object with _id + eventId) or just an ID string
    const media = n.relatedMedia;
    const mediaId = media ? (typeof media === 'object' ? media._id : media) : null;

    if (media) {
      const eventId = typeof media === 'object' ? media.eventId : null;
      if (eventId) {
        return mediaId
          ? `/events/${eventId}?media=${mediaId}`
          : `/events/${eventId}`;
      }
    }
    // Fallback: if relatedEvent exists, navigate there
    const eventId = typeof n.relatedEvent === 'object' ? n.relatedEvent?._id : n.relatedEvent;
    if (eventId) {
      return mediaId
        ? `/events/${eventId}?media=${mediaId}`
        : `/events/${eventId}`;
    }
    // Last resort: gallery page
    return '/gallery';
  }

  // Upload request → take admin/creator to the event album
  if (n.type === 'upload_request') {
    const eventId = typeof n.relatedEvent === 'object' ? n.relatedEvent?._id : n.relatedEvent;
    if (eventId) return `/events/${eventId}`;
    return '/events';
  }

  // Upload decision → take requester to the event so they can upload
  if (n.type === 'upload_request_decided') {
    const eventId = typeof n.relatedEvent === 'object' ? n.relatedEvent?._id : n.relatedEvent;
    if (eventId) return `/events/${eventId}`;
    return '/events';
  }

  if (n.type === 'user_registration') {
    return '/admin/users';
  }

  // Activity — navigate to the related event if available
  if (n.type === 'activity') {
    const eventId = typeof n.relatedEvent === 'object' ? n.relatedEvent?._id : n.relatedEvent;
    if (eventId) return `/events/${eventId}`;
  }

  return null;
}
/** Icon per notification type */
export function NotifIcon({ type }) {
  if (type === 'like') return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-red-400 shrink-0 mt-0.5">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  );
  if (type === 'comment') return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400 shrink-0 mt-0.5">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  );
  if (type === 'tag') return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-yellow-400 shrink-0 mt-0.5">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
      <line x1="7" y1="7" x2="7.01" y2="7"/>
    </svg>
  );
  if (type === 'media_upload') return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-400 shrink-0 mt-0.5">
      <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
    </svg>
  );
  if (type === 'upload_request') return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-400 shrink-0 mt-0.5">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  );
  if (type === 'upload_request_decided') return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-teal-400 shrink-0 mt-0.5">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>
    </svg>
  );
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ash shrink-0 mt-0.5">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  );
}

/** Single notification row */
export function NotifItem({ n, onClick }) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      className={`flex items-start gap-3 px-4 py-3 border-b border-graphite/30 transition-colors ${
        !n.isRead ? 'bg-blue-500/5' : ''
      } ${onClick ? 'cursor-pointer hover:bg-white/5' : ''}`}
    >
      <NotifIcon type={n.type} />
      <div className="flex-1 min-w-0">
        <p className="text-snow text-[12px] font-semibold leading-tight truncate">
          {n.title || 'Notification'}
        </p>
        <p className="text-ash text-[12px] mt-0.5 leading-snug line-clamp-2">
          {n.message || ''}
        </p>
        <p className="text-steel text-[11px] mt-1">{relativeTime(n.createdAt)}</p>
      </div>
      {!n.isRead && (
        <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0 mt-1" />
      )}
    </div>
  );
}
