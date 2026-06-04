import { Server } from 'socket.io';
import { verifyAccessToken } from '../utils/tokenUtils.js';
import User from '../models/User.js';

let io = null;

/** @type {Set<string>} */
const onlineUsers = new Set();

/**
 * Throttle map: key = `${target}|${event}`, value = last emit timestamp.
 * @type {Map<string, number>}
 */
const lastEmit = new Map();

const THROTTLE_MS = 500;
const CLEANUP_INTERVAL_MS = 60_000;
const STALE_THRESHOLD_MS = THROTTLE_MS * 10;

let cleanupTimer = null;

/**
 * Parses a cookie header string and extracts the value for the given cookie name.
 * @param {string} cookieHeader - Raw cookie header string
 * @param {string} name - Cookie name to extract
 * @returns {string|null} Cookie value or null if not found
 */
function parseCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';');
  for (const cookie of cookies) {
    const [key, ...valueParts] = cookie.trim().split('=');
    if (key.trim() === name) {
      return valueParts.join('=').trim();
    }
  }
  return null;
}

/**
 * Checks if a throttle key should be throttled.
 * @param {string} key - Throttle key
 * @returns {boolean} true if throttled (should NOT emit), false if allowed
 */
function isThrottled(key) {
  const now = Date.now();
  const last = lastEmit.get(key) ?? 0;
  if (now - last < THROTTLE_MS) return true;
  lastEmit.set(key, now);
  return false;
}

/**
 * Periodic cleanup of stale throttle map entries.
 */
function cleanupThrottleMap() {
  const now = Date.now();
  for (const [key, timestamp] of lastEmit) {
    if (now - timestamp > STALE_THRESHOLD_MS) {
      lastEmit.delete(key);
    }
  }
}

/**
 * Initializes the Socket.IO server with auth middleware, room management,
 * and emit helpers.
 *
 * @param {import('http').Server} httpServer - The HTTP server instance
 * @param {object} config - Validated environment config
 * @returns {Server} The Socket.IO server instance
 */
export function initSocketServer(httpServer, config) {
  const allowedOrigins = [
    'http://localhost:5173',
    'https://antaresevents.netlify.app',
    'https://antaresevents.vercel.app',
    ...(config.CLIENT_URL ? [config.CLIENT_URL] : []),
  ];

  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  // Auth middleware: parse cookie, verify JWT, lookup user
  io.use(async (socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie;
      const token = parseCookie(cookieHeader, 'accessToken');

      if (!token) {
        return next(new Error('Authentication required'));
      }

      let decoded;
      try {
        decoded = verifyAccessToken(token);
      } catch (err) {
        return next(new Error('Authentication required'));
      }

      const user = await User.findById(decoded.userId).select('-password -refreshToken');

      if (!user) {
        return next(new Error('Authentication required'));
      }

      if (user.isBlocked) {
        return next(new Error('User is blocked'));
      }

      socket.user = user;
      socket.userId = String(user._id);
      next();
    } catch (err) {
      next(new Error('Authentication required'));
    }
  });

  // Connection handler
  io.on('connection', (socket) => {
    // Join user's personal room
    socket.join(`user:${socket.userId}`);

    // Track online presence
    onlineUsers.add(socket.userId);

    // Event room subscription
    socket.on('event:subscribe', (data) => {
      if (data && data.eventId) {
        socket.join(`event:${data.eventId}`);
      }
    });

    // Event room unsubscription
    socket.on('event:unsubscribe', (data) => {
      if (data && data.eventId) {
        socket.leave(`event:${data.eventId}`);
      }
    });

    // Disconnect handler
    socket.on('disconnect', () => {
      // Only remove from onlineUsers if no other sockets remain for this user
      const userRoom = io.sockets.adapter.rooms.get(`user:${socket.userId}`);
      if (!userRoom || userRoom.size === 0) {
        onlineUsers.delete(socket.userId);
      }
    });
  });

  // Start periodic cleanup of stale throttle map entries
  cleanupTimer = setInterval(cleanupThrottleMap, CLEANUP_INTERVAL_MS);
  // Allow the process to exit even if the timer is still running
  if (cleanupTimer.unref) {
    cleanupTimer.unref();
  }

  console.log('Socket.IO server initialized');
  return io;
}

/**
 * Returns the Socket.IO server instance.
 * @returns {Server|null}
 */
export function getIO() {
  return io;
}

/**
 * Checks if a user is currently online (has at least one active socket).
 * @param {string} userId - The user ID to check
 * @returns {boolean}
 */
export function isUserOnline(userId) {
  return onlineUsers.has(String(userId));
}

/**
 * Emits an event to a specific user's room with per-(target, event) throttle.
 * @param {string} userId - Target user ID
 * @param {string} event - Event name
 * @param {*} payload - Event payload
 * @returns {boolean} true if emitted, false if throttled or io not initialized
 */
export function emitToUser(userId, event, payload) {
  if (!io) return false;
  const key = `u:${String(userId)}|${event}`;
  if (isThrottled(key)) return false;
  io.to(`user:${String(userId)}`).emit(event, payload);
  return true;
}

/**
 * Emits an event to an event room with per-(target, event) throttle.
 * @param {string} eventId - Target event ID
 * @param {string} event - Event name
 * @param {*} payload - Event payload
 * @returns {boolean} true if emitted, false if throttled or io not initialized
 */
export function emitToEvent(eventId, event, payload) {
  if (!io) return false;
  const key = `e:${String(eventId)}|${event}`;
  if (isThrottled(key)) return false;
  io.to(`event:${String(eventId)}`).emit(event, payload);
  return true;
}
