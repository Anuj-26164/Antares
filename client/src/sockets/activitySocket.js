import { on } from './socket.js';
import useActivityStore from '../store/activityStore.js';

/**
 * Subscribe to realtime activity feed updates.
 * Routes incoming `activity-update` events into the activity store.
 *
 * @returns {() => void} Unsubscribe function that removes the handler.
 */
export function subscribeToActivity() {
  return on('activity-update', (payload) => {
    useActivityStore.getState().addActivity(payload);
  });
}
