/**
 * Generates a local SVG data URL avatar with initials.
 * No external API calls — works fully offline.
 */
const COLORS = [
  '#1d4ed8', '#2563eb', '#3b82f6', '#60A5FA',
  '#7c3aed', '#8b5cf6', '#6d28d9',
  '#0f766e', '#0d9488', '#14b8a6',
  '#b45309', '#d97706', '#f59e0b',
  '#be123c', '#e11d48', '#f43f5e',
];

function getColorFromSeed(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function getRandomAvatar(seed = '') {
  const initials = getInitials(seed);
  const bg = getColorFromSeed(seed || 'default');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
    <rect width="64" height="64" rx="32" fill="${bg}"/>
    <text x="32" y="32" text-anchor="middle" dominant-baseline="central" font-family="Inter,system-ui,sans-serif" font-size="24" font-weight="600" fill="white">${initials}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

export function getUserAvatar(user) {
  if (user?.avatar && user.avatar.trim().length > 0) return user.avatar;
  return getRandomAvatar(user?.name || user?.email || 'user');
}

/**
 * Fallback avatar (initials SVG) for use in <img onError>.
 */
export function getFallbackAvatar(user) {
  return getRandomAvatar(user?.name || user?.email || 'user');
}
