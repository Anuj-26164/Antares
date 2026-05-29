import { io } from 'socket.io-client';

/**
 * Singleton Socket.IO connection manager.
 *
 * Provides a fan-out listener registry so the rest of the app never touches
 * socket.io-client directly. Reconnection cannot duplicate listeners because
 * we attach socket.on(event, fanOut) at most once per event name.
 */

/** @type {import('socket.io-client').Socket | null} */
let socket = null;

/** @type {Map<string, Set<Function>>} */
const handlers = new Map();

/**
 * Resolve the server URL for the socket connection.
 * In development, connect directly to the Express server to avoid
 * Vite's WebSocket proxy limitations. In production, use the same origin.
 */
function getServerUrl() {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // Dev: Vite runs on 5173, Express on 5000 — connect directly
  if (import.meta.env.DEV) {
    return 'http://localhost:5000';
  }
  // Production: client and server share the same origin
  return '';
}

/**
 * Establish the socket connection. No-op if already connected.
 * @returns {import('socket.io-client').Socket | null}
 */
export function connectSocket() {
  if (socket && socket.connected) return socket;

  // If a socket instance exists but is disconnected, reconnect it
  if (socket) {
    socket.connect();
    return socket;
  }

  const url = getServerUrl();

  socket = io(url, {
    withCredentials: true,
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    randomizationFactor: 0.5,
  });

  return socket;
}

/**
 * Disconnect the socket, remove all listeners, and clear the handler registry.
 */
export function disconnectSocket() {
  if (!socket) return;

  // Remove all native listeners we attached via the fan-out pattern
  for (const event of handlers.keys()) {
    socket.off(event);
  }

  // Clear the handler registry
  handlers.clear();

  socket.disconnect();
  socket = null;
}

/**
 * Get the current socket instance (may be null if not connected).
 * @returns {import('socket.io-client').Socket | null}
 */
export function getSocket() {
  return socket;
}

/**
 * Check whether the socket is currently connected.
 * @returns {boolean}
 */
export function isConnected() {
  return socket?.connected ?? false;
}

/**
 * Register a handler for a socket event using the fan-out pattern.
 * The native socket.on is attached at most once per event name.
 *
 * @param {string} event - The event name to listen for.
 * @param {Function} handler - The callback to invoke when the event fires.
 * @returns {() => void} An unsubscribe function that removes this handler.
 */
export function on(event, handler) {
  let set = handlers.get(event);

  if (!set) {
    set = new Set();
    handlers.set(event, set);

    // Attach the fan-out listener exactly once for this event name
    if (socket) {
      socket.on(event, (payload) => {
        const currentSet = handlers.get(event);
        if (currentSet) {
          for (const h of currentSet) {
            h(payload);
          }
        }
      });
    }
  }

  set.add(handler);

  // Return an unsubscribe function
  return () => off(event, handler);
}

/**
 * Remove a specific handler from the fan-out registry.
 * Does NOT detach the native socket listener — the fan-out listener
 * stays attached for the lifetime of the socket to prevent reconnect duplication.
 *
 * @param {string} event - The event name.
 * @param {Function} handler - The handler to remove.
 */
export function off(event, handler) {
  const set = handlers.get(event);
  if (set) {
    set.delete(handler);
  }
}

/**
 * Subscribe to an event room on the server. Emits `event:subscribe` and
 * returns an unsubscribe function that emits `event:unsubscribe`.
 *
 * @param {string} eventId - The event ID to subscribe to.
 * @returns {() => void} Unsubscribe function that leaves the event room.
 */
export function subscribeToEvent(eventId) {
  if (socket) {
    socket.emit('event:subscribe', { eventId });
  }

  return () => {
    if (socket) {
      socket.emit('event:unsubscribe', { eventId });
    }
  };
}
