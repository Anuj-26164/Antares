import { on } from './socket.js';
import useNotificationStore from '../store/notificationStore.js';

/**
 * Subscribe to personal notification socket events.
 *
 * `notification` — full notification doc emitted to the recipient's user room
 *   (covers like, comment, media_upload, user_registration)
 *
 * `user-tagged` — raw tag payload { mediaId, eventId, by } emitted to the
 *   tagged user's room. We normalise it into a notification shape here so
 *   the store always receives a consistent object.
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

  // Tag payload — normalise into notification shape before storing
  const unsubUserTagged = on('user-tagged', (payload) => {
    const n = {
      // No _id from server — store will generate a tmp id via normalise()
      type:        'tag',
      title:       'You were tagged',
      message:     payload?.by?.name
        ? `${payload.by.name} tagged you in a photo`
        : 'You were tagged in a photo',
      isRead:      false,
      createdAt:   new Date().toISOString(),
      relatedUser: payload?.by ?? null,
      relatedMedia:payload?.mediaId ? { _id: payload.mediaId, eventId: payload?.eventId || null } : null,
      relatedEvent:payload?.eventId ? { _id: payload.eventId } : null,
    };
    useNotificationStore.getState().addNotification(n);
  });

  return () => {
    unsubNotification();
    unsubUserTagged();
  };
}
