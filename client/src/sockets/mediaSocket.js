import { on, off, subscribeToEvent } from './socket.js';
import useMediaStore from '../store/mediaStore.js';
import useMediaInteractionStore from '../store/mediaInteractionStore.js';
import { debounce } from '../utils/debounce.js';

/**
 * Debounced handler for media-uploaded events.
 * Prepends new media to the store at most once per 300ms window.
 */
const debouncedPrependMedia = debounce((media) => {
  useMediaStore.getState().prependMedia(media);
}, 300);

/**
 * Subscribe to global media update events (media-uploaded, gallery-updated).
 * These fire on the user's socket regardless of event room membership.
 *
 * @returns {() => void} Unsubscribe function that removes all handlers.
 * Validates: Requirements 4.1, 4.2
 */
export function subscribeToMediaUpdates() {
  const handleMediaUploaded = (media) => {
    debouncedPrependMedia(media);
  };

  const handleGalleryUpdated = () => {
    useMediaStore.getState().markStale();
  };

  const handleMediaTagsUpdated = ({ mediaId, tags }) => {
    useMediaStore.getState().applyMediaTags(mediaId, tags);
  };

  const handleMediaCaptionUpdated = ({ mediaId, caption }) => {
    useMediaStore.getState().applyMediaCaption(mediaId, caption);
  };

  const unsubMediaUploaded = on('media-uploaded', handleMediaUploaded);
  const unsubGalleryUpdated = on('gallery-updated', handleGalleryUpdated);
  const unsubMediaTagsUpdated = on('media-tags-updated', handleMediaTagsUpdated);
  const unsubMediaCaptionUpdated = on('media-caption-updated', handleMediaCaptionUpdated);

  return () => {
    unsubMediaUploaded();
    unsubGalleryUpdated();
    unsubMediaTagsUpdated();
    unsubMediaCaptionUpdated();
    debouncedPrependMedia.cancel();
  };
}

/**
 * Subscribe to a specific event room for live media interactions.
 * Joins the event room on the server and registers handlers for
 * media-uploaded, gallery-updated, photo-liked, and new-comment events.
 *
 * @param {string} eventId - The event ID to subscribe to.
 * @returns {() => void} Unsubscribe function that leaves the room and removes all handlers.
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 8.3, 8.4
 */
export function subscribeToEventRoom(eventId) {
  // Join the event room on the server
  const unsubscribeFromRoom = subscribeToEvent(eventId);

  const handleMediaUploaded = (media) => {
    debouncedPrependMedia(media);
  };

  const handleGalleryUpdated = () => {
    useMediaStore.getState().markStale();
  };

  const handlePhotoLiked = (payload) => {
    useMediaInteractionStore.getState().applyRemoteLike(payload);
  };

  const handleNewComment = (payload) => {
    useMediaInteractionStore.getState().applyRemoteComment(payload);
  };

  const handleMediaTagsUpdated = ({ mediaId, tags }) => {
    useMediaStore.getState().applyMediaTags(mediaId, tags);
  };

  const handleMediaCaptionUpdated = ({ mediaId, caption }) => {
    useMediaStore.getState().applyMediaCaption(mediaId, caption);
  };

  const unsubMediaUploaded = on('media-uploaded', handleMediaUploaded);
  const unsubGalleryUpdated = on('gallery-updated', handleGalleryUpdated);
  const unsubPhotoLiked = on('photo-liked', handlePhotoLiked);
  const unsubNewComment = on('new-comment', handleNewComment);
  const unsubMediaTagsUpdated = on('media-tags-updated', handleMediaTagsUpdated);
  const unsubMediaCaptionUpdated = on('media-caption-updated', handleMediaCaptionUpdated);

  return () => {
    unsubMediaUploaded();
    unsubGalleryUpdated();
    unsubPhotoLiked();
    unsubNewComment();
    unsubMediaTagsUpdated();
    unsubMediaCaptionUpdated();
    debouncedPrependMedia.cancel();
    unsubscribeFromRoom();
  };
}
