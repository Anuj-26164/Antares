/**
 * Minimal presence tracking stub.
 * Uses an in-memory Set to track online user IDs.
 * Validates: Requirement 10.3 (cleanup on disconnect)
 */

/** @type {Set<string>} */
const onlineUsers = new Set();

/**
 * Marks a user as online.
 * Called from sockets/index.js on successful connection.
 * @param {string} userId - The user ID to mark online
 */
export function markOnline(userId) {
  if (!userId) return;
  onlineUsers.add(String(userId));
}

/**
 * Marks a user as offline.
 * Called from sockets/index.js on disconnect only when no other sockets remain.
 * @param {string} userId - The user ID to mark offline
 */
export function markOffline(userId) {
  if (!userId) return;
  onlineUsers.delete(String(userId));
}

/**
 * Checks if a user is currently online.
 * @param {string} userId - The user ID to check
 * @returns {boolean} true if the user has at least one active socket
 */
export function isOnline(userId) {
  if (!userId) return false;
  return onlineUsers.has(String(userId));
}

/**
 * Returns all currently online user IDs.
 * Useful for admin/debug purposes.
 * @returns {string[]} Array of online user ID strings
 */
export function getOnlineUserIds() {
  return [...onlineUsers];
}
