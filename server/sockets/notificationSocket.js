import { emitToUser } from './index.js';

/**
 * Emits a generic `notification` event to the recipient's user room.
 * Short-circuits if the recipient is the actor (Requirement 3.5).
 *
 * @param {string} recipientId - Target user ID
 * @param {object} notificationDoc - The notification document to emit
 * @param {string} actorId - The user who triggered the action
 * @returns {boolean} true if emitted, false if skipped or throttled
 */
export function notifyUser(recipientId, notificationDoc, actorId) {
  if (String(recipientId) === String(actorId)) return false;
  return emitToUser(recipientId, 'notification', notificationDoc);
}

/**
 * Emits a `photo-liked` event to the media owner's user room.
 * Short-circuits if the owner is the actor (Requirement 3.5).
 *
 * @param {string} ownerId - The media owner's user ID
 * @param {object} payload - { mediaId, count, by }
 * @param {string} actorId - The user who liked the photo
 * @returns {boolean} true if emitted, false if skipped or throttled
 */
export function emitPhotoLikedToOwner(ownerId, payload, actorId) {
  if (String(ownerId) === String(actorId)) return false;
  return emitToUser(ownerId, 'photo-liked', payload);
}

/**
 * Emits a `new-comment` event to a specific user's room.
 * Short-circuits if the recipient is the actor (Requirement 3.5).
 *
 * @param {string} recipientId - Target user ID (media owner or prior commenter)
 * @param {object} commentPayload - CommentSocketPayload
 * @param {string} actorId - The user who posted the comment
 * @returns {boolean} true if emitted, false if skipped or throttled
 */
export function emitNewCommentToUser(recipientId, commentPayload, actorId) {
  if (String(recipientId) === String(actorId)) return false;
  return emitToUser(recipientId, 'new-comment', commentPayload);
}

/**
 * Emits a `user-tagged` event to the tagged user's room.
 * Short-circuits if the tagged user is the actor (Requirement 3.5).
 *
 * @param {string} taggedUserId - The tagged user's ID
 * @param {object} payload - { mediaId, eventId, by }
 * @param {string} actorId - The user who performed the tagging
 * @returns {boolean} true if emitted, false if skipped or throttled
 */
export function emitUserTagged(taggedUserId, payload, actorId) {
  if (String(taggedUserId) === String(actorId)) return false;
  return emitToUser(taggedUserId, 'user-tagged', payload);
}
