/**
 * Shared notification rendering helpers used by AppNavbar and AdminTopBar.
 */

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
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ash shrink-0 mt-0.5">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  );
}

/** Format relative time */
export function relativeTime(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/** Single notification row */
export function NotifItem({ n }) {
  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 border-b border-graphite/30 ${
        !n.isRead ? 'bg-blue-500/5' : ''
      }`}
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
