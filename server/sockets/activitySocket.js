import { emitToEvent } from './index.js';

/**
 * Emits an activity-update event to the specified event room.
 * Used to broadcast significant actions (uploads, comments, likes)
 * to all users subscribed to an event's activity feed.
 *
 * @param {string} eventId - The event ID whose room should receive the update
 * @param {object} activityPayload - The activity data to broadcast
 * @returns {boolean} true if emitted, false if throttled or io not initialized
 */
export function emitActivityUpdate(eventId, activityPayload) {
  return emitToEvent(eventId, 'activity-update', activityPayload);
}
