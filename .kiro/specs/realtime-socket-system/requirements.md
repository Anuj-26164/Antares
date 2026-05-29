# Requirements Document

## Introduction

Integrate a scalable Socket.IO realtime communication system into the existing ANTARES2 event media platform. The system provides instant push notifications, live media interaction updates (likes, comments, tags), activity feeds, and user presence — all without breaking the current authentication, routing, media pipeline, or storage integrations.

## Glossary

- **Socket_Server**: The Socket.IO server instance attached to the existing Express HTTP server
- **Socket_Client**: The Socket.IO client module running in the React frontend
- **Notification_Service**: The backend service responsible for creating, storing, and emitting notification events to targeted user rooms
- **Media_Interaction_Service**: The backend service responsible for emitting realtime updates when media is liked, commented on, or tagged
- **Activity_Service**: The backend service responsible for broadcasting activity feed updates
- **Presence_Service**: The backend service responsible for tracking online/offline user status
- **User_Room**: A Socket.IO room named `user:<userId>` that isolates events to a specific authenticated user
- **Event_Room**: A Socket.IO room named `event:<eventId>` for broadcasting updates to event subscribers
- **Connection_Manager**: The frontend module that manages socket lifecycle (connect, reconnect, disconnect, cleanup)
- **Notification_Store**: A Zustand store managing realtime notification state, unread counts, and mark-as-read actions
- **Activity_Store**: A Zustand store managing the activity feed state
- **Media_Interaction_Store**: A Zustand store managing realtime likes/comments state with optimistic updates

## Requirements

### Requirement 1: Server Infrastructure Setup

**User Story:** As a developer, I want the Express server converted to use `http.createServer()` with Socket.IO attached, so that realtime WebSocket connections can coexist with the existing REST API.

#### Acceptance Criteria

1. WHEN the server starts, THE Socket_Server SHALL attach to the HTTP server instance created from the existing Express app
2. THE Socket_Server SHALL use the same CORS origin and credentials configuration as the existing Express CORS middleware
3. WHEN the server starts, THE Socket_Server SHALL accept WebSocket and HTTP long-polling transports
4. WHEN the server starts, THE existing REST API routes SHALL continue to function without modification

### Requirement 2: Socket Authentication

**User Story:** As a developer, I want socket connections authenticated using the existing JWT cookie mechanism, so that only verified non-blocked users can establish realtime connections.

#### Acceptance Criteria

1. WHEN a socket connection handshake occurs, THE Socket_Server SHALL parse the `accessToken` cookie from the handshake headers
2. WHEN a valid JWT is extracted, THE Socket_Server SHALL verify it using the existing `verifyAccessToken()` function
3. IF the JWT is missing or invalid, THEN THE Socket_Server SHALL reject the connection with an authentication error
4. IF the authenticated user has `isBlocked` set to true, THEN THE Socket_Server SHALL reject the connection with a blocked-user error
5. WHEN authentication succeeds, THE Socket_Server SHALL attach the user object to `socket.user` and join the socket into the `user:<userId>` room

### Requirement 3: Realtime Notification Delivery

**User Story:** As a user, I want to receive instant notifications when someone likes my media, comments on my media, or tags me, so that I get immediate social feedback.

#### Acceptance Criteria

1. WHEN a notification is created in any backend controller, THE Notification_Service SHALL emit a `notification` event to the recipient's User_Room
2. WHEN a user favourites media, THE Notification_Service SHALL emit a `photo-liked` event to the media owner's User_Room
3. WHEN a comment is posted on media, THE Notification_Service SHALL emit a `new-comment` event to the media owner's User_Room and to all previous commenters' User_Rooms
4. WHEN a user is tagged in media, THE Notification_Service SHALL emit a `user-tagged` event to the tagged user's User_Room
5. THE Notification_Service SHALL NOT emit events back to the user who triggered the action

### Requirement 4: Realtime Media Updates

**User Story:** As a user, I want to see likes, comments, and new uploads appear in realtime without refreshing the page, so that the platform feels alive and interactive.

#### Acceptance Criteria

1. WHEN media is uploaded to an event, THE Media_Interaction_Service SHALL emit a `media-uploaded` event to the Event_Room for that event
2. WHEN media is uploaded, THE Media_Interaction_Service SHALL emit a `gallery-updated` event to signal gallery refresh
3. WHEN a favourite is toggled on media, THE Media_Interaction_Service SHALL emit a `photo-liked` event containing the updated favourite count to the Event_Room
4. WHEN a comment is posted on media, THE Media_Interaction_Service SHALL emit a `new-comment` event containing the comment data to the Event_Room

### Requirement 5: Activity Feed Updates

**User Story:** As a user, I want to see a live activity feed of recent platform actions, so that I stay informed about what is happening across events.

#### Acceptance Criteria

1. WHEN a significant action occurs (media upload, comment, like), THE Activity_Service SHALL emit an `activity-update` event to relevant Event_Rooms
2. THE Activity_Store SHALL maintain a bounded list of recent activities (maximum 50 items)
3. WHEN a new activity arrives and the list is at capacity, THE Activity_Store SHALL remove the oldest activity

### Requirement 6: Frontend Socket Connection Management

**User Story:** As a developer, I want a robust frontend socket connection manager that handles authentication, reconnection, and cleanup, so that the realtime system is reliable and leak-free.

#### Acceptance Criteria

1. WHEN a user is authenticated, THE Connection_Manager SHALL establish a socket connection with `withCredentials: true`
2. WHEN a connection is lost, THE Connection_Manager SHALL attempt reconnection with exponential backoff (starting at 1 second, maximum 30 seconds)
3. WHEN a user logs out, THE Connection_Manager SHALL disconnect the socket and remove all event listeners
4. WHEN a component unmounts, THE Connection_Manager SHALL clean up any listeners registered by that component
5. WHEN a reconnection occurs, THE Connection_Manager SHALL prevent duplicate event listeners by removing existing listeners before re-registering
6. THE Connection_Manager SHALL debounce rapid-fire incoming events (maximum one UI update per 300ms for the same event type)

### Requirement 7: Notification Store and UI

**User Story:** As a user, I want a notification bell in the navigation bar showing my unread count, so that I can see at a glance when new interactions have occurred.

#### Acceptance Criteria

1. THE Notification_Store SHALL maintain a list of notifications and an unread count
2. WHEN a `notification` event is received via socket, THE Notification_Store SHALL prepend the notification and increment the unread count
3. WHEN the user marks notifications as read, THE Notification_Store SHALL update the read status and decrement the unread count
4. THE AppNavbar SHALL display a notification bell icon with a badge showing the unread count when greater than zero
5. WHEN the unread count changes, THE notification badge SHALL animate using Framer Motion

### Requirement 8: Media Interaction Store with Optimistic Updates

**User Story:** As a user, I want likes and comments to appear instantly when I interact with media, with the UI updating optimistically before server confirmation.

#### Acceptance Criteria

1. WHEN a user toggles a favourite, THE Media_Interaction_Store SHALL optimistically update the UI state before the API response
2. IF the API call fails after an optimistic update, THEN THE Media_Interaction_Store SHALL revert the state to the previous value
3. WHEN a `photo-liked` socket event is received for media currently displayed, THE Media_Interaction_Store SHALL update the favourite count in the UI
4. WHEN a `new-comment` socket event is received for media currently displayed, THE Media_Interaction_Store SHALL append the comment to the displayed comments list

### Requirement 9: Notification Model Extension

**User Story:** As a developer, I want the Notification model extended with new types and a recipient field, so that notifications can be targeted to specific users.

#### Acceptance Criteria

1. THE Notification model SHALL support additional types: 'like', 'tag', 'activity' in addition to existing types
2. THE Notification model SHALL include a `recipient` field referencing a User document
3. WHEN querying notifications for a user, THE Notification_Service SHALL filter by the `recipient` field

### Requirement 10: Performance and Reliability

**User Story:** As a developer, I want the realtime system to be performant and not degrade the existing user experience, so that the platform remains fast and stable.

#### Acceptance Criteria

1. THE Socket_Server SHALL use rooms for targeted delivery and SHALL NOT broadcast events globally
2. THE Socket_Server SHALL debounce rapid-fire events from the same user (maximum one emit per event type per 500ms per user)
3. WHEN a socket disconnects, THE Socket_Server SHALL automatically remove the socket from all rooms
4. THE Connection_Manager SHALL prevent re-render loops by batching socket-driven state updates
5. THE Socket_Client SHALL NOT interfere with existing Zustand auth flow, React Router routing, media upload pipeline, or infinite scroll gallery

### Requirement 11: Integration Safety

**User Story:** As a developer, I want the socket system to integrate without breaking any existing functionality, so that the platform remains stable during and after the integration.

#### Acceptance Criteria

1. THE Socket_Server SHALL reuse the existing `verifyAccessToken()` and User model lookup logic without duplicating authentication code
2. THE Socket_Client SHALL use the same cookie-based credentials as the existing Axios API instance
3. WHEN socket features are added to existing components, THE existing component behavior SHALL remain unchanged when the socket is disconnected
4. THE server entry point modification SHALL preserve all existing middleware, routes, and error handling in their current order
