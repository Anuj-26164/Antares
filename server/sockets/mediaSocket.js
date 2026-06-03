import { emitToEvent } from './index.js';

/**
 * Emits a `media-uploaded` event to the event room when new media is uploaded.
 * @param {string} eventId - The event ID whose room should receive the emit
 * @param {object} mediaDoc - The populated media document
 * @returns {boolean} true if emitted, false if throttled or io not initialized
 */
export function emitMediaUploaded(eventId, mediaDoc) {
  return emitToEvent(eventId, 'media-uploaded', mediaDoc);
}

/**
 * Emits a `gallery-updated` event to the event room to signal gallery refresh.
 * @param {string} eventId - The event ID whose room should receive the emit
 * @param {object} summary - Summary object (e.g. { addedCount, latestId })
 * @returns {boolean} true if emitted, false if throttled or io not initialized
 */
export function emitGalleryUpdated(eventId, summary) {
  return emitToEvent(eventId, 'gallery-updated', summary);
}

/**
 * Emits a `photo-liked` event to the event room with updated favourite count.
 * @param {string} eventId - The event ID whose room should receive the emit
 * @param {object} payload - PhotoLikedPayload ({ mediaId, count, by, liked })
 * @returns {boolean} true if emitted, false if throttled or io not initialized
 */
export function emitPhotoLikedToEvent(eventId, payload) {
  return emitToEvent(eventId, 'photo-liked', payload);
}

/**
 * Emits a `new-comment` event to the event room with comment data.
 * @param {string} eventId - The event ID whose room should receive the emit
 * @param {object} commentPayload - CommentSocketPayload ({ _id, mediaId, eventId, text, createdAt, user })
 * @returns {boolean} true if emitted, false if throttled or io not initialized
 */
export function emitNewCommentToEvent(eventId, commentPayload) {
  return emitToEvent(eventId, 'new-comment', commentPayload);
}
/**
 * Emits a `media-tags-updated` event when smart-tagging finishes for a media item.
 * @param {string} eventId  - Event room receiving the emit
 * @param {{ mediaId: string, tags: string[] }} payload
 * @returns {boolean} true if emitted, false if throttled or io not initialized
 */
export function emitMediaTagsUpdated(eventId, payload) {
  return emitToEvent(eventId, 'media-tags-updated', payload);
}
/**
 * Emits a `media-caption-updated` event when AI captioning finishes.
 * @param {string} eventId
 * @param {{ mediaId: string, caption: string }} payload
 * @returns {boolean}
 */
export function emitMediaCaptionUpdated(eventId, payload) {
  return emitToEvent(eventId, 'media-caption-updated', payload);
}
