/**
 * Formats a role string for display.
 * Converts snake_case role identifiers to proper English labels.
 * @param {string} role - The raw role string (e.g., 'club_member')
 * @returns {string} Formatted role label (e.g., 'Club Member')
 */
export function formatRole(role) {
  const roleMap = {
    admin: 'Admin',
    photographer: 'Photographer',
    club_member: 'Club Member',
    viewer: 'Viewer',
  };
  return roleMap[role] || role || 'Unknown';
}

/**
 * Formats a date as a coarse "time ago" string.
 * Examples: 'just now', '5m ago', '3h ago', '2d ago', '3w ago', '4mo ago', '2y ago'.
 * Returns an empty string for falsy / unparseable input.
 *
 * @param {string|number|Date} input - ISO string, epoch ms, or Date instance
 * @returns {string}
 */
export function relativeTime(input) {
  if (!input) return '';
  const ts = input instanceof Date ? input.getTime() : new Date(input).getTime();
  if (Number.isNaN(ts)) return '';

  const diffMs = Date.now() - ts;
  // Future timestamps (clock skew, etc.) — show "just now" rather than a negative value.
  if (diffMs < 0) return 'just now';

  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;

  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;

  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  const years = Math.floor(days / 365);
  return `${years}y ago`;
}
