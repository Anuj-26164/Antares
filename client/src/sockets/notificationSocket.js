import { on } from './socket.js';
import useNotificationStore from '../store/notificationStore.js';

/**
 * Subscribe to personal notification socket events.
 *
 * `notification` — full notification doc emitted to the recipient's user room.
 *   Covers all persisted types: like, comment, media_upload, user_registration,
 *   and tag. This is the single source of truth for the bell + list.
 *
 * Note: the server also emits `user-tagged` with `{ mediaId, eventId, by }`
 * for live UI hooks (e.g. media-room overlays). It is intentionally NOT
 * handled here — doing so would double-count tag notifications because the
 * persisted `notification` event already covers tags.
 *
 * `photo-liked` and `new-comment` are event-room broadcasts for live UI
 * updates — they must NOT be routed here (would increment badge for everyone).
 *
 * @returns {() => void} Unsubscribe function.
 */
export function subscribeToNotifications() {
  // Full notification doc — server emits this to recipient's user room only
  const unsubNotification = on('notification', (payload) => {
    useNotificationStore.getState().addNotification(payload);
  });

  return () => {
    unsubNotification();
  };
}
