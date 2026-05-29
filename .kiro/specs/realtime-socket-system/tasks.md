# Implementation Plan: Realtime Socket System

## Overview

Integrate Socket.IO into the ANTARES2 platform to deliver realtime notifications, live media interactions (likes, comments, tags), an activity feed, and user presence tracking. The implementation is additive — it reuses existing JWT cookie auth, runs on the default Socket.IO namespace, and exposes thin emit helpers that controllers call directly after successful database operations.

## Tasks

- [x] 1. Server infrastructure and socket core
  - [x] 1.1 Convert server entry point to use `http.createServer()` and attach Socket.IO
    - Modify `server/index.js` to import `http` and create the HTTP server from the Express app
    - Attach Socket.IO with matching CORS config (`origin: config.CLIENT_URL, credentials: true`) and transports `['websocket', 'polling']`
    - Replace `app.listen()` with `httpServer.listen()` preserving all existing middleware and route order
    - Wrap `initSocketServer` in try/catch so REST continues if socket init fails
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 11.4_

  - [x] 1.2 Create `server/sockets/index.js` with auth middleware, room management, and emit helpers
    - Implement `initSocketServer(httpServer, config)` that configures Socket.IO and registers the auth middleware
    - Auth middleware: parse `accessToken` from `socket.handshake.headers.cookie`, call existing `verifyAccessToken()`, lookup user via `User.findById().select('-password -refreshToken')`, reject if missing/invalid/blocked
    - On connection: attach `socket.user`, join `user:<userId>` room, add to `onlineUsers` Set
    - Listen for `event:subscribe` / `event:unsubscribe` to manage event room membership
    - On disconnect: remove from `onlineUsers` only if no other sockets remain for that user
    - Implement `emitToUser(userId, event, payload)` and `emitToEvent(eventId, event, payload)` with 500ms per-(target, event) throttle
    - Implement `getIO()` and `isUserOnline(userId)` helpers
    - Add periodic cleanup (every 60s) for stale throttle map entries
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 10.1, 10.2, 10.3, 11.1_

  - [ ]* 1.3 Write property test for cookie parsing (Property 1)
    - **Property 1: Cookie parsing extracts `accessToken` correctly**
    - **Validates: Requirements 2.1**

  - [ ]* 1.4 Write property test for auth room joining (Property 2)
    - **Property 2: Successful auth always joins `user:<userId>` and never any other user room**
    - **Validates: Requirements 2.5, 11.1**

  - [ ]* 1.5 Write property test for room-targeted emit isolation (Property 3)
    - **Property 3: Room-targeted emits land only on the matching room**
    - **Validates: Requirements 3.1, 3.4, 4.1, 4.2, 5.1, 10.1**

  - [ ]* 1.6 Write property test for server-side throttle bound (Property 6)
    - **Property 6: Server-side per-(target, event) throttle is bounded**
    - **Validates: Requirements 10.2**

- [x] 2. Notification and media socket services
  - [x] 2.1 Create `server/sockets/notificationSocket.js` with notification emit helpers
    - Implement `notifyUser(recipientId, notificationDoc)` — wraps `emitToUser` with `notification` event
    - Implement `emitPhotoLikedToOwner(ownerId, payload)` — emits `photo-liked` to owner's user room
    - Implement `emitNewCommentToUser(recipientId, commentPayload)` — emits `new-comment` to user room
    - Implement `emitUserTagged(taggedUserId, payload)` — emits `user-tagged` to tagged user's room
    - All helpers short-circuit if `recipientId === actorId`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 9.3_

  - [x] 2.2 Create `server/sockets/mediaSocket.js` with media interaction emit helpers
    - Implement `emitMediaUploaded(eventId, mediaDoc)` — emits `media-uploaded` to event room
    - Implement `emitGalleryUpdated(eventId, summary)` — emits `gallery-updated` to event room
    - Implement `emitPhotoLikedToEvent(eventId, payload)` — emits `photo-liked` to event room
    - Implement `emitNewCommentToEvent(eventId, commentPayload)` — emits `new-comment` to event room
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 2.3 Create `server/sockets/activitySocket.js` with activity feed emit helper
    - Implement `emitActivityUpdate(eventId, activityPayload)` — emits `activity-update` to event room
    - _Requirements: 5.1_

  - [x] 2.4 Create `server/sockets/presenceSocket.js` with minimal presence stub
    - Implement `markOnline(userId)`, `markOffline(userId)`, `isOnline(userId)`, `getOnlineUserIds()`
    - Use a simple `Set<string>` for trackingww
    - _Requirements: 10.3_

  - [ ]* 2.5 Write property test for comment recipient set deduplication (Property 4)
    - **Property 4: Comment recipient set is `dedup({owner} ∪ priorCommenters) \ {actor}`**
    - **Validates: Requirements 3.3, 3.5, 4.4**

  - [ ]* 2.6 Write property test for photo-liked emit conditions (Property 5)
    - **Property 5: `photo-liked` emit conditions and count correctness**
    - **Validates: Requirements 3.2, 3.5, 4.3**

- [x] 3. Notification model extension and controller integration
  - [x] 3.1 Extend the Notification model with new types and `recipient` field
    - Add `'like'`, `'tag'`, `'activity'` to the `type` enum in `server/models/Notification.js`
    - Add `recipient` field as `ObjectId` ref to `User` with `index: true` and `required: false`
    - _Requirements: 9.1, 9.2_

  - [x] 3.2 Integrate socket emits into `mediaController.js` — `uploadMedia` handler
    - After successful media upload loop, call `emitMediaUploaded(eventId, media)` for each uploaded item
    - Call `emitGalleryUpdated(eventId, { addedCount, latestId })` after the batch
    - Call `emitActivityUpdate(eventId, activityPayload)` for the upload activity
    - _Requirements: 4.1, 4.2, 5.1_

  - [x] 3.3 Integrate socket emits into `mediaController.js` — `toggleFavourite` handler
    - After `media.save()`, call `emitPhotoLikedToEvent(eventId, payload)` with updated count
    - If favourited and actor !== owner: create Notification with `type: 'like'` and `recipient: ownerId`, then call `notifyUser` and `emitPhotoLikedToOwner`
    - Call `emitActivityUpdate(eventId, activityPayload)` for the like activity
    - _Requirements: 3.2, 3.5, 4.3, 5.1, 9.2_

  - [x] 3.4 Integrate socket emits into `mediaController.js` — `addComment` handler
    - After comment save, populate comment user data and build `CommentSocketPayload`
    - Call `emitNewCommentToEvent(eventId, payload)` for the event room
    - Compute recipient set: `dedup({owner} ∪ priorCommenters) \ {actor}`
    - For each recipient: create Notification with `type: 'comment'` and `recipient`, call `notifyUser` and `emitNewCommentToUser`
    - Call `emitActivityUpdate(eventId, activityPayload)` for the comment activity
    - _Requirements: 3.3, 3.5, 4.4, 5.1, 9.2_

  - [x] 3.5 Add tagging endpoint `POST /api/media/:id/tag` with socket emits
    - Create route handler that accepts `{ userIds: string[] }`
    - For each tagged user (excluding actor): create Notification with `type: 'tag'` and `recipient`, call `notifyUser` and `emitUserTagged`
    - _Requirements: 3.4, 3.5, 9.2_

- [x] 4. Checkpoint - Ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Frontend socket connection manager
  - [x] 5.1 Install `socket.io-client` dependency in the client package
    - Add `socket.io-client` to `client/package.json` dependencies
    - _Requirements: 6.1_

  - [x] 5.2 Create `client/src/sockets/socket.js` — singleton connection manager
    - Implement `connectSocket()` with `withCredentials: true`, transports `['websocket', 'polling']`, reconnection with exponential backoff (1s base, 30s max, randomization 0.5)
    - Implement `disconnectSocket()` that removes all listeners, clears the handler registry Map, and calls `socket.disconnect()`
    - Implement `getSocket()`, `isConnected()`
    - Implement `on(event, handler)` with fan-out pattern: attach native `socket.on` exactly once per event name, maintain `Map<event, Set<handler>>` registry
    - Implement `off(event, handler)` that removes from the Set without detaching the native listener
    - Implement `subscribeToEvent(eventId)` that emits `event:subscribe` and returns an unsubscribe function that emits `event:unsubscribe`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 10.5, 11.2_

  - [x] 5.3 Create `client/src/utils/debounce.js` — debounce utility for high-frequency events
    - Implement a trailing-edge debounce function with configurable delay (default 300ms)
    - _Requirements: 6.6, 10.4_

  - [ ]* 5.4 Write property test for listener registry (Property 7)
    - **Property 7: Listener registry never double-attaches and `off` removes only the targeted handler**
    - **Validates: Requirements 6.4, 6.5**

  - [ ]* 5.5 Write property test for disconnectSocket cleanup (Property 8)
    - **Property 8: `disconnectSocket()` clears the registry and silences subsequent emits**
    - **Validates: Requirements 6.3**

  - [ ]* 5.6 Write property test for client debounce (Property 9)
    - **Property 9: Client debounce yields one trailing call per window**
    - **Validates: Requirements 6.6, 10.4**

- [x] 6. Frontend stores
  - [x] 6.1 Create `client/src/store/notificationStore.js` — notification state management
    - Implement Zustand store with `list`, `unreadCount` state
    - Implement `addNotification(n)` — prepend to list, increment unreadCount
    - Implement `markRead(id)` — set isRead, decrement unreadCount if was unread
    - Implement `markAllRead()` — mark all read, set unreadCount to 0
    - Implement `fetchInitial()` — GET `/api/notifications` to hydrate on connect
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 6.2 Create `client/src/store/activityStore.js` — activity feed state management
    - Implement Zustand store with `list` state (bounded to 50 items)
    - Implement `addActivity(a)` — prepend and slice to 50
    - _Requirements: 5.2, 5.3_

  - [x] 6.3 Create `client/src/store/mediaInteractionStore.js` — optimistic media interactions
    - Implement Zustand store with `byId: Record<mediaId, { favourited, favouriteCount, comments }>` state
    - Implement `toggleFavourite(mediaId)` with optimistic update and rollback on API failure
    - Implement `addComment(mediaId, text)` with optimistic temp comment and rollback on failure
    - Implement `applyRemoteLike({ mediaId, count, by })` — idempotent set of favouriteCount (debounced 300ms)
    - Implement `applyRemoteComment({ mediaId, comment })` — append only if `_id` not already present
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ]* 6.4 Write property test for notification store invariant (Property 10)
    - **Property 10: Notification store invariant — `unreadCount` equals count of unread items**
    - **Validates: Requirements 7.1, 7.2, 7.3**

  - [ ]* 6.5 Write property test for activity store bound (Property 11)
    - **Property 11: Activity store is bounded to 50 newest-first**
    - **Validates: Requirements 5.2, 5.3**

  - [ ]* 6.6 Write property test for optimistic toggleFavourite rollback (Property 12)
    - **Property 12: Optimistic `toggleFavourite` round-trips state on API rejection**
    - **Validates: Requirements 8.1, 8.2**

  - [ ]* 6.7 Write property test for idempotent remote updates (Property 13)
    - **Property 13: `applyRemoteLike` and `applyRemoteComment` are idempotent**
    - **Validates: Requirements 8.3, 8.4**

- [x] 7. Frontend socket subscription modules
  - [x] 7.1 Create `client/src/sockets/notificationSocket.js` — notification event subscriptions
    - Implement `subscribeToNotifications()` that registers handlers for `notification`, `photo-liked`, `new-comment`, `user-tagged` events
    - Route each event into `useNotificationStore.getState().addNotification(payload)`
    - Return a single unsubscribe function that removes all four handlers
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 7.2_

  - [x] 7.2 Create `client/src/sockets/mediaSocket.js` — media event subscriptions
    - Implement `subscribeToMediaUpdates()` for global media events
    - Implement `subscribeToEventRoom(eventId)` that calls `subscribeToEvent(eventId)` and registers handlers for `media-uploaded`, `gallery-updated`, `photo-liked`, `new-comment`
    - Route `media-uploaded` → `useMediaStore.getState().prependMedia(media)` (debounced 300ms)
    - Route `gallery-updated` → `useMediaStore.getState().markStale()`
    - Route `photo-liked` → `useMediaInteractionStore.getState().applyRemoteLike(payload)`
    - Route `new-comment` → `useMediaInteractionStore.getState().applyRemoteComment(payload)`
    - Return unsubscribe functions for cleanup
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 8.3, 8.4_

  - [x] 7.3 Create `client/src/sockets/activitySocket.js` — activity event subscriptions
    - Implement `subscribeToActivity()` that registers handler for `activity-update`
    - Route into `useActivityStore.getState().addActivity(payload)`
    - Return unsubscribe function
    - _Requirements: 5.1, 5.2_

- [x] 8. Frontend UI integration
  - [x] 8.1 Wire socket connection into `App.jsx` lifecycle
    - Add `useEffect` that calls `connectSocket()` when `isAuthenticated` becomes true
    - Call `disconnectSocket()` on cleanup or when `isAuthenticated` becomes false
    - Subscribe to notifications and activity feed on connect
    - _Requirements: 6.1, 6.3, 10.5, 11.3_

  - [x] 8.2 Add notification bell with unread badge to `AppNavbar`
    - Add notification bell icon to the navbar
    - Display badge with `unreadCount` when greater than zero
    - Animate badge changes using Framer Motion
    - Wire `markAllRead()` action to a "mark all read" button
    - _Requirements: 7.4, 7.5_

  - [x] 8.3 Integrate `subscribeToEventRoom` into `EventAlbumPage`
    - On mount, call `subscribeToEventRoom(eventId)` and capture unsubscribe
    - On unmount, call unsubscribe to leave the event room and remove listeners
    - _Requirements: 4.1, 4.3, 4.4, 6.4_

  - [x] 8.4 Integrate optimistic interactions into `MediaModal` and `GalleryGrid`
    - Replace direct API calls for favourite toggle with `mediaInteractionStore.toggleFavourite()`
    - Replace direct API calls for comments with `mediaInteractionStore.addComment()`
    - Read favourite count and comments from `mediaInteractionStore.byId[mediaId]`
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 8.5 Wire `disconnectSocket()` into `authStore.logout()`
    - Call `disconnectSocket()` before clearing user state in the logout action
    - _Requirements: 6.3, 11.3_

- [x] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties using fast-check
- Unit tests validate specific examples and edge cases
- The implementation language is JavaScript (matching the existing codebase and design document)
- All socket emits are fire-and-forget side effects — REST API remains the source of truth
- If the socket layer fails, the platform degrades gracefully to REST-only operation

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "5.1"] },
    { "id": 1, "tasks": ["1.2", "5.2", "5.3"] },
    { "id": 2, "tasks": ["1.3", "1.4", "1.5", "1.6", "2.1", "2.2", "2.3", "2.4", "3.1", "5.4", "5.5", "5.6"] },
    { "id": 3, "tasks": ["2.5", "2.6", "3.2", "3.3", "3.4", "3.5", "6.1", "6.2", "6.3"] },
    { "id": 4, "tasks": ["6.4", "6.5", "6.6", "6.7", "7.1", "7.2", "7.3"] },
    { "id": 5, "tasks": ["8.1", "8.2", "8.3", "8.4", "8.5"] }
  ]
}
```
