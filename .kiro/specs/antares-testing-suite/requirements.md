# Requirements Document

## Introduction

The ANTARES Testing Suite is a comprehensive automated testing infrastructure for the ANTARES club media management platform. It covers backend API testing (Vitest + Supertest), frontend end-to-end testing (Playwright), smoke tests for critical infrastructure, reusable test helpers, seed data scripts, and CI/CD integration. The suite validates all critical user journeys, API contracts, authorization rules, realtime Socket.IO behavior, and Cloudflare R2 media operations across the full stack.

## Glossary

- **Test_Suite**: The complete collection of automated tests, helpers, seed scripts, and CI configuration for the ANTARES platform.
- **Backend_Tests**: Vitest-based unit and integration tests for the Express/Node.js server, run via `npm test` in the `server/` directory.
- **E2E_Tests**: Playwright-based end-to-end tests for the React frontend, run via `npm run test:e2e` in the `client/` directory.
- **Smoke_Tests**: Lightweight connectivity and health-check tests that verify critical infrastructure is reachable and operational.
- **Test_Helper**: A reusable utility module providing shared setup, teardown, authentication, and assertion logic for use across test files.
- **Seed_Script**: A script that populates the test database with deterministic fixture data (users, events, media) before test runs.
- **Mock_User**: A pre-seeded test user with a defined role (`admin`, `photographer`, or `viewer`) used across test scenarios.
- **API_Client**: The Supertest-wrapped Express app instance used to make HTTP requests in backend integration tests.
- **Socket_Client**: A Socket.IO client instance used in tests to verify realtime event emission and reception.
- **R2_Mock**: A mock or stub of the Cloudflare R2 / AWS S3 SDK used to isolate media storage operations in unit tests.
- **Watermark**: A visual overlay applied to downloaded media files by the `imageProcessor` utility.
- **JWT**: JSON Web Token used for access and refresh token authentication in the ANTARES API.
- **CI**: Continuous Integration pipeline (e.g., GitHub Actions) that runs the Test_Suite on every push or pull request.
- **Test_Report**: A machine-readable and human-readable output (e.g., JUnit XML, HTML) generated after a test run summarizing pass/fail results.

---

## Requirements

### Requirement 1: Backend Test Infrastructure Setup

**User Story:** As a developer, I want a configured Vitest + Supertest test environment for the backend, so that I can run isolated API integration tests without a live database or external services.

#### Acceptance Criteria

1. THE Test_Suite SHALL include a Vitest configuration file (`vitest.config.js`) in the `server/` directory that sets the test environment to `node`, specifies a test file glob pattern, and configures a minimum coverage threshold of 70% for statements, branches, functions, and lines.
2. THE Test_Suite SHALL include a `server/tests/setup.js` global setup file that is referenced in the Vitest config and runs before all test suites.
3. WHEN the global setup runs, THE Test_Suite SHALL connect to an in-memory MongoDB instance (using `mongodb-memory-server`) and disconnect after all tests complete.
4. THE Test_Helper SHALL export a `createApp()` function that returns a fully configured Express application instance suitable for use with Supertest, without starting an HTTP server.
5. THE Test_Helper SHALL export an `authenticateAs(role)` function that seeds a Mock_User with the given role, performs a login request, and returns the authenticated API_Client with valid JWT cookies attached.
6. IF the `mongodb-memory-server` fails to start, THEN THE Test_Suite SHALL throw a descriptive error and abort the test run before any test executes.
7. THE Test_Suite SHALL include a `server/tests/helpers/` directory containing at minimum: `appHelper.js` (Express app factory), `authHelper.js` (authentication utilities), `seedHelper.js` (seed data factory), and `r2MockHelper.js` (R2_Mock factory).
8. FOR ALL backend test files, THE Test_Suite SHALL mock the `../config/env.js` module with deterministic test values so that no real environment variables are required to run tests.

---

### Requirement 2: Seed Data and Mock Users

**User Story:** As a developer, I want deterministic seed data and pre-defined mock users, so that tests have consistent, predictable starting state without manual database setup.

#### Acceptance Criteria

1. THE Seed_Script SHALL create exactly three Mock_Users with roles `admin`, `photographer`, and `viewer`, each with a unique email, hashed password, and known plaintext password stored as a test constant.
2. THE Seed_Script SHALL create at least two seed Events: one with `visibility: 'public'` and one with `visibility: 'private'`, each associated with the `photographer` Mock_User as creator.
3. THE Seed_Script SHALL create at least three seed Media items: at least one `photo` and one `video`, each associated with a seed Event and the `photographer` Mock_User.
4. WHEN `seedHelper.seedAll()` is called, THE Seed_Script SHALL insert all seed data into the connected MongoDB instance and return an object containing the created document IDs keyed by entity type.
5. WHEN `seedHelper.clearAll()` is called, THE Seed_Script SHALL delete all documents from the `users`, `events`, `media`, `comments`, and `notifications` collections.
6. THE Seed_Script SHALL be idempotent: calling `seedAll()` twice without `clearAll()` in between SHALL NOT create duplicate documents; it SHALL return the existing document IDs.
7. FOR ALL seed Media items, THE Seed_Script SHALL set `r2Key` and `url` fields to deterministic test values that do not reference real Cloudflare R2 storage.

---

### Requirement 3: Authentication API Tests

**User Story:** As a developer, I want automated tests for all authentication endpoints, so that registration, login, logout, token refresh, and Google OAuth flows are verified to work correctly and reject invalid inputs.

#### Acceptance Criteria

1. WHEN `POST /api/auth/register` is called with a valid name, email, and password, THE Backend_Tests SHALL assert that the response status is `201` and the response body contains a `user` object with the submitted email and role `viewer`.
2. WHEN `POST /api/auth/register` is called with an email that already exists, THE Backend_Tests SHALL assert that the response status is `409`.
3. WHEN `POST /api/auth/register` is called with a missing required field, THE Backend_Tests SHALL assert that the response status is `400`.
4. WHEN `POST /api/auth/login` is called with valid credentials, THE Backend_Tests SHALL assert that the response status is `200` and that `Set-Cookie` headers include both `accessToken` and `refreshToken` cookies.
5. WHEN `POST /api/auth/login` is called with an incorrect password, THE Backend_Tests SHALL assert that the response status is `401`.
6. WHEN `POST /api/auth/logout` is called with a valid `accessToken` cookie, THE Backend_Tests SHALL assert that the response status is `200` and that the `Set-Cookie` headers clear both auth cookies.
7. WHEN `POST /api/auth/refresh` is called with a valid `refreshToken` cookie, THE Backend_Tests SHALL assert that the response status is `200` and that a new `accessToken` cookie is set.
8. WHEN `POST /api/auth/refresh` is called without a `refreshToken` cookie, THE Backend_Tests SHALL assert that the response status is `401`.
9. FOR ALL authentication endpoints, THE Backend_Tests SHALL verify that a blocked user (`isBlocked: true`) receives a `403` response on protected routes after login.

---

### Requirement 4: Authorization and Role Enforcement Tests

**User Story:** As a developer, I want tests that verify role-based access control, so that unauthorized users cannot access admin or role-restricted endpoints.

#### Acceptance Criteria

1. WHEN an unauthenticated request is made to any route protected by `authMiddleware`, THE Backend_Tests SHALL assert that the response status is `401`.
2. WHEN a `viewer` role user makes a `POST /api/events` request, THE Backend_Tests SHALL assert that the response status is `403`.
3. WHEN a `photographer` role user makes a `POST /api/events` request with valid data, THE Backend_Tests SHALL assert that the response status is `201`.
4. WHEN a `viewer` role user makes a `GET /api/admin/users` request, THE Backend_Tests SHALL assert that the response status is `403`.
5. WHEN an `admin` role user makes a `GET /api/admin/users` request, THE Backend_Tests SHALL assert that the response status is `200` and the response body contains a `users` array.
6. WHEN a `viewer` role user makes a `PATCH /api/media/:id` request (admin-only update), THE Backend_Tests SHALL assert that the response status is `403`.
7. FOR ALL role enforcement tests, THE Backend_Tests SHALL use the `authenticateAs(role)` Test_Helper to obtain role-specific authenticated API_Client instances.

---

### Requirement 5: Event CRUD API Tests

**User Story:** As a developer, I want tests for all event management endpoints, so that creating, reading, updating, and deleting events behaves correctly for each role.

#### Acceptance Criteria

1. WHEN `POST /api/events` is called by a `photographer` with valid event data (name, date, description, visibility), THE Backend_Tests SHALL assert that the response status is `201` and the response body contains the created event with a valid MongoDB `_id`.
2. WHEN `GET /api/events` is called by an authenticated user, THE Backend_Tests SHALL assert that the response status is `200` and the response body contains an array of events.
3. WHEN `GET /api/events/:id` is called with a valid event ID, THE Backend_Tests SHALL assert that the response status is `200` and the response body contains the event matching the requested ID.
4. WHEN `GET /api/events/:id` is called with a non-existent ID, THE Backend_Tests SHALL assert that the response status is `404`.
5. WHEN `PUT /api/events/:id` is called by the event creator with updated fields, THE Backend_Tests SHALL assert that the response status is `200` and the response body reflects the updated values.
6. WHEN `DELETE /api/events/:id` is called by an `admin`, THE Backend_Tests SHALL assert that the response status is `200` and subsequent `GET /api/events/:id` returns `404`.
7. WHEN `GET /api/events/public` is called without authentication, THE Backend_Tests SHALL assert that the response status is `200` and only events with `visibility: 'public'` are returned.
8. WHEN `GET /api/events/public/:id` is called for a private event without authentication, THE Backend_Tests SHALL assert that the response status is `403` or `404`.

---

### Requirement 6: Media Upload and Management API Tests

**User Story:** As a developer, I want tests for media upload, retrieval, update, and deletion, so that the media lifecycle is verified end-to-end with R2 mocked.

#### Acceptance Criteria

1. WHEN `POST /api/media/upload/:eventId` is called by a `photographer` with a valid image file, THE Backend_Tests SHALL assert that the response status is `201` and the response body contains a media object with `type: 'photo'`, a valid `r2Key`, and a `url`.
2. WHEN `POST /api/media/upload/:eventId` is called by a `viewer`, THE Backend_Tests SHALL assert that the response status is `403`.
3. WHEN `GET /api/media` is called without authentication, THE Backend_Tests SHALL assert that the response status is `200` and only media items with `isPublic: true` are returned.
4. WHEN `GET /api/media/:id` is called with a valid media ID, THE Backend_Tests SHALL assert that the response status is `200` and the response body contains the media document.
5. WHEN `DELETE /api/media/:id` is called by the uploader, THE Backend_Tests SHALL assert that the response status is `200` and the R2_Mock `DeleteObjectCommand` was invoked with the correct `r2Key`.
6. WHEN `DELETE /api/media/:id` is called by a user who did not upload the media and is not an `admin`, THE Backend_Tests SHALL assert that the response status is `403`.
7. WHEN `PATCH /api/media/:id` is called by an `admin` with updated metadata, THE Backend_Tests SHALL assert that the response status is `200` and the response body reflects the updated fields.
8. WHEN `GET /api/media/:id/download` is called by an authenticated user, THE Backend_Tests SHALL assert that the response status is `200` and the `Content-Disposition` header indicates a file download, and the Watermark utility was invoked.
9. FOR ALL media upload tests, THE Backend_Tests SHALL use the R2_Mock to intercept `PutObjectCommand` and `DeleteObjectCommand` calls without making real network requests to Cloudflare R2.

---

### Requirement 7: Likes, Comments, Favourites, and Tagging API Tests

**User Story:** As a developer, I want tests for social interaction endpoints, so that likes, comments, favourites, and user tagging work correctly and trigger the expected notifications.

#### Acceptance Criteria

1. WHEN `POST /api/media/:id/favourite` is called by an authenticated user on a media item not yet favourited, THE Backend_Tests SHALL assert that the response status is `200` and the media document's `favouritedBy` array contains the user's ID.
2. WHEN `POST /api/media/:id/favourite` is called again on an already-favourited media item, THE Backend_Tests SHALL assert that the response status is `200` and the media document's `favouritedBy` array no longer contains the user's ID (toggle behavior).
3. WHEN `POST /api/media/:id/comments` is called with a valid comment body, THE Backend_Tests SHALL assert that the response status is `201` and the response body contains the created comment with the correct `text` and `author` fields.
4. WHEN `GET /api/media/:id/comments` is called, THE Backend_Tests SHALL assert that the response status is `200` and the response body contains an array of comments for the specified media item.
5. WHEN `POST /api/media/:id/tag` is called with a valid array of user IDs, THE Backend_Tests SHALL assert that the response status is `200` and the media document's `tags` array contains the tagged user IDs.
6. WHEN `POST /api/media/:id/tag` is called with more than 30 user IDs, THE Backend_Tests SHALL assert that the response status is `400`.
7. FOR ALL social interaction endpoints, THE Backend_Tests SHALL mock the `notificationSocket` module to verify that the appropriate notification emit function is called with the correct arguments.

---

### Requirement 8: Notification API Tests

**User Story:** As a developer, I want tests for the notification endpoints, so that users can list, mark as read, and bulk-clear their notifications correctly.

#### Acceptance Criteria

1. WHEN `GET /api/notifications` is called by an authenticated user, THE Backend_Tests SHALL assert that the response status is `200` and the response body contains only notifications where `recipient` matches the authenticated user's ID.
2. WHEN `PATCH /api/notifications/:id/read` is called with a valid notification ID belonging to the authenticated user, THE Backend_Tests SHALL assert that the response status is `200` and the notification's `isRead` field is `true`.
3. WHEN `PATCH /api/notifications/read-all` is called by an authenticated user, THE Backend_Tests SHALL assert that the response status is `200` and all notifications for that user have `isRead: true`.
4. WHEN `PATCH /api/notifications/:id/read` is called with a notification ID belonging to a different user, THE Backend_Tests SHALL assert that the response status is `403` or `404`.

---

### Requirement 9: Admin API Tests

**User Story:** As a developer, I want tests for all admin endpoints, so that user management, role assignment, blocking, analytics, and settings are verified to work correctly for admin users only.

#### Acceptance Criteria

1. WHEN `GET /api/admin/users` is called by an `admin`, THE Backend_Tests SHALL assert that the response status is `200` and the response body contains a `users` array with all registered users.
2. WHEN `PATCH /api/admin/users/:id/role` is called by an `admin` with a valid role value, THE Backend_Tests SHALL assert that the response status is `200` and the target user's `role` field is updated in the database.
3. WHEN `PATCH /api/admin/users/:id/role` is called with an invalid role value, THE Backend_Tests SHALL assert that the response status is `400`.
4. WHEN `PATCH /api/admin/users/:id/block` is called by an `admin`, THE Backend_Tests SHALL assert that the response status is `200` and the target user's `isBlocked` field is toggled.
5. WHEN `GET /api/admin/analytics` is called by an `admin`, THE Backend_Tests SHALL assert that the response status is `200` and the response body contains numeric fields for total users, total events, and total media.
6. WHEN `GET /api/admin/settings` is called by an `admin`, THE Backend_Tests SHALL assert that the response status is `200` and the response body contains the current platform settings document.
7. WHEN `PUT /api/admin/settings` is called by an `admin` with valid settings data, THE Backend_Tests SHALL assert that the response status is `200` and the settings document is updated.

---

### Requirement 10: User Profile API Tests

**User Story:** As a developer, I want tests for user profile endpoints, so that profile retrieval, updates, avatar upload, favourites listing, and user search are verified.

#### Acceptance Criteria

1. WHEN `GET /api/users/me` is called by an authenticated user, THE Backend_Tests SHALL assert that the response status is `200` and the response body contains the authenticated user's profile without `password` or `refreshToken` fields.
2. WHEN `PUT /api/users/me` is called with a valid `name` field, THE Backend_Tests SHALL assert that the response status is `200` and the response body reflects the updated name.
3. WHEN `POST /api/users/me/avatar` is called with a valid image file, THE Backend_Tests SHALL assert that the response status is `200` and the response body contains an updated `avatar` URL, and the R2_Mock `PutObjectCommand` was invoked.
4. WHEN `GET /api/users/me/favourites` is called by an authenticated user, THE Backend_Tests SHALL assert that the response status is `200` and the response body contains only media items in the user's `favouritedBy` list.
5. WHEN `GET /api/users/search?q=<query>` is called with a search term matching a user's name, THE Backend_Tests SHALL assert that the response status is `200` and the response body contains matching users.
6. WHEN `PUT /api/users/:id/role` is called by an `admin` with a valid role, THE Backend_Tests SHALL assert that the response status is `200` and the target user's role is updated.

---

### Requirement 11: Socket.IO Server Unit Tests

**User Story:** As a developer, I want unit tests for the Socket.IO server module, so that authentication middleware, room management, throttling, and emit helpers are verified in isolation.

#### Acceptance Criteria

1. WHEN the Socket.IO auth middleware receives a socket with a valid `accessToken` cookie, THE Backend_Tests SHALL assert that `socket.user` and `socket.userId` are set to the authenticated user's data.
2. WHEN the Socket.IO auth middleware receives a socket with no `accessToken` cookie, THE Backend_Tests SHALL assert that the `next` callback is called with an `Error` whose message is `'Authentication required'`.
3. WHEN the Socket.IO auth middleware receives a socket for a blocked user, THE Backend_Tests SHALL assert that the `next` callback is called with an `Error` whose message is `'User is blocked'`.
4. WHEN `emitToUser(userId, event, payload)` is called twice within 500ms for the same user and event, THE Backend_Tests SHALL assert that the second call returns `false` (throttled) and the Socket.IO `to().emit()` is called exactly once.
5. WHEN `emitToUser(userId, event, payload)` is called after the 500ms throttle window has elapsed, THE Backend_Tests SHALL assert that the call returns `true` and the event is emitted.
6. WHEN a connected socket emits `event:subscribe` with a valid `eventId`, THE Backend_Tests SHALL assert that the socket joins the room `event:<eventId>`.
7. WHEN a socket disconnects and no other sockets remain for that user, THE Backend_Tests SHALL assert that the user ID is removed from the `onlineUsers` set.
8. THE `parseCookie` utility function SHALL correctly extract a named cookie value from a raw cookie header string for any valid cookie string input.
9. FOR ALL valid cookie header strings, THE Backend_Tests SHALL verify that `parseCookie(header, name)` returns the same value as a reference implementation that uses the standard `cookie` npm package parser (round-trip property).

---

### Requirement 12: Smoke Tests

**User Story:** As a developer, I want smoke tests that verify critical infrastructure connectivity, so that broken environments are detected immediately before the full test suite runs.

#### Acceptance Criteria

1. WHEN the smoke test for MongoDB connectivity runs, THE Smoke_Tests SHALL assert that a connection to the configured MongoDB URI can be established and a `ping` command returns successfully within 5000ms.
2. WHEN the smoke test for Cloudflare R2 connectivity runs, THE Smoke_Tests SHALL assert that a `HeadBucketCommand` to the configured R2 bucket returns a successful response within 5000ms.
3. WHEN the smoke test for JWT authentication runs, THE Smoke_Tests SHALL assert that `generateAccessToken` and `verifyAccessToken` produce a valid round-trip: `verifyAccessToken(generateAccessToken(payload)).userId === payload.userId`.
4. WHEN the smoke test for the API health check runs, THE Smoke_Tests SHALL assert that `GET /api/health` returns status `200` within 2000ms.
5. WHEN the smoke test for Socket.IO server initialization runs, THE Smoke_Tests SHALL assert that `initSocketServer` returns a non-null `Server` instance and `getIO()` returns the same instance.
6. IF any smoke test fails, THEN THE Smoke_Tests SHALL log the failure reason and exit with a non-zero process code, preventing the full test suite from running.

---

### Requirement 13: Frontend E2E Test Infrastructure Setup

**User Story:** As a developer, I want a configured Playwright test environment for the frontend, so that E2E tests can run against a real browser with the full application stack.

#### Acceptance Criteria

1. THE Test_Suite SHALL include a `playwright.config.js` file in the `client/` directory that configures at minimum the Chromium browser, sets `baseURL` to the development server URL, and enables screenshot capture on test failure.
2. THE Test_Suite SHALL include a `client/tests/e2e/` directory containing all Playwright test files organized by feature area.
3. THE Test_Suite SHALL include a `client/tests/e2e/helpers/` directory with at minimum: `authHelper.js` (login/logout page object), `mediaHelper.js` (upload/interact page object), and `socketHelper.js` (Socket.IO connection verification utilities).
4. WHEN `npm run test:e2e` is executed in the `client/` directory, THE E2E_Tests SHALL run all Playwright tests in headless mode and exit with a non-zero code if any test fails.
5. THE Playwright configuration SHALL set a global test timeout of 30000ms per test and a navigation timeout of 10000ms.
6. WHERE the `CI` environment variable is set, THE E2E_Tests SHALL run with `retries: 2` to reduce flakiness in CI environments.

---

### Requirement 14: Authentication E2E Tests

**User Story:** As a developer, I want E2E tests for the registration, login, and logout flows, so that the full authentication user journey is verified in a real browser.

#### Acceptance Criteria

1. WHEN a new user completes the registration form with a valid name, email, and password and submits it, THE E2E_Tests SHALL assert that the browser navigates to the authenticated home page and the user's name is visible in the navigation bar.
2. WHEN a user submits the login form with valid credentials, THE E2E_Tests SHALL assert that the browser navigates away from the login page and the authenticated navigation is displayed.
3. WHEN a user submits the login form with an incorrect password, THE E2E_Tests SHALL assert that an error message is visible on the login page and the browser does not navigate away.
4. WHEN an authenticated user clicks the logout button, THE E2E_Tests SHALL assert that the browser navigates to the landing or login page and the authenticated navigation is no longer visible.
5. WHEN an unauthenticated user navigates directly to a protected route (e.g., `/events`), THE E2E_Tests SHALL assert that the browser redirects to the login page.

---

### Requirement 15: Event Management E2E Tests

**User Story:** As a developer, I want E2E tests for event creation, editing, and deletion, so that the full event management user journey is verified in a real browser.

#### Acceptance Criteria

1. WHEN an authenticated `photographer` user fills in the event creation form and submits it, THE E2E_Tests SHALL assert that the new event appears in the events list with the correct name and date.
2. WHEN an authenticated user opens an existing event and submits the edit form with updated fields, THE E2E_Tests SHALL assert that the event detail page reflects the updated values.
3. WHEN an authenticated `admin` user deletes an event, THE E2E_Tests SHALL assert that the event no longer appears in the events list.
4. WHEN a `viewer` user navigates to the event creation page, THE E2E_Tests SHALL assert that the creation form is not accessible or a permission error is displayed.

---

### Requirement 16: Media Upload and Interaction E2E Tests

**User Story:** As a developer, I want E2E tests for media upload, deletion, likes, comments, tagging, favouriting, and watermarked downloads, so that the full media interaction user journey is verified in a real browser.

#### Acceptance Criteria

1. WHEN an authenticated `photographer` user uploads an image file via the upload zone, THE E2E_Tests SHALL assert that the uploaded image appears in the gallery grid within 10000ms.
2. WHEN an authenticated `photographer` user uploads a video file via the upload zone, THE E2E_Tests SHALL assert that the uploaded video thumbnail appears in the gallery grid within 15000ms.
3. WHEN an authenticated user clicks the delete button on a media item they uploaded, THE E2E_Tests SHALL assert that the media item is removed from the gallery grid.
4. WHEN an authenticated user clicks the like button on a media item, THE E2E_Tests SHALL assert that the like count increments by 1.
5. WHEN an authenticated user submits a comment on a media item, THE E2E_Tests SHALL assert that the comment text appears in the comments list.
6. WHEN an authenticated user tags another user on a media item, THE E2E_Tests SHALL assert that the tagged user's name appears in the media item's tag list.
7. WHEN an authenticated user clicks the favourite button on a media item, THE E2E_Tests SHALL assert that the media item appears in the user's favourites list on the profile page.
8. WHEN an authenticated user clicks the download button on a media item, THE E2E_Tests SHALL assert that a file download is initiated and the downloaded file is not empty.
9. WHEN the gallery page is scrolled to the bottom with more than one page of media available, THE E2E_Tests SHALL assert that additional media items are loaded and appended to the gallery grid (infinite scroll).

---

### Requirement 17: Admin Panel E2E Tests

**User Story:** As a developer, I want E2E tests for the admin panel, so that user role management and blocking are verified through the UI.

#### Acceptance Criteria

1. WHEN an `admin` user navigates to the User Management panel and changes a user's role via the dropdown, THE E2E_Tests SHALL assert that the role change is reflected in the user list after the update.
2. WHEN an `admin` user clicks the block button for a user, THE E2E_Tests SHALL assert that the user's status is shown as blocked in the user list.
3. WHEN a non-admin user attempts to navigate to the admin panel URL directly, THE E2E_Tests SHALL assert that the browser redirects away from the admin panel or displays an access denied message.

---

### Requirement 18: Realtime Notification and Socket.IO E2E Tests

**User Story:** As a developer, I want E2E tests for realtime notifications and Socket.IO reconnection, so that the realtime communication layer is verified in a real browser environment.

#### Acceptance Criteria

1. WHEN user A uploads a media item to an event that user B is subscribed to, THE E2E_Tests SHALL assert that user B receives a realtime notification within 5000ms without refreshing the page.
2. WHEN user A comments on a media item owned by user B, THE E2E_Tests SHALL assert that user B receives a realtime notification within 5000ms.
3. WHEN user A tags user B on a media item, THE E2E_Tests SHALL assert that user B receives a realtime notification within 5000ms.
4. WHEN the Socket.IO connection is interrupted (simulated by going offline) and then restored, THE E2E_Tests SHALL assert that the client reconnects automatically and resumes receiving events within 10000ms.
5. WHEN a user navigates to the profile page, THE E2E_Tests SHALL assert that the notification badge count matches the number of unread notifications returned by `GET /api/notifications`.

---

### Requirement 19: Profile Update and Avatar Upload E2E Tests

**User Story:** As a developer, I want E2E tests for profile updates and avatar uploads, so that the user profile management journey is verified in a real browser.

#### Acceptance Criteria

1. WHEN an authenticated user updates their display name on the profile page and saves, THE E2E_Tests SHALL assert that the updated name is visible in the navigation bar and on the profile page.
2. WHEN an authenticated user uploads a new avatar image on the profile page, THE E2E_Tests SHALL assert that the new avatar image is displayed in the navigation bar and on the profile page within 5000ms.
3. WHEN an authenticated user uploads a file that is not an image as an avatar, THE E2E_Tests SHALL assert that an error message is displayed and the avatar is not changed.

---

### Requirement 20: CI/CD Integration and Test Reporting

**User Story:** As a developer, I want the test suite integrated into a CI/CD pipeline with test reports, so that regressions are caught automatically on every push and results are visible to the team.

#### Acceptance Criteria

1. THE Test_Suite SHALL include a CI configuration file (`.github/workflows/test.yml`) that triggers on `push` and `pull_request` events to the `main` branch.
2. WHEN the CI workflow runs, THE CI SHALL execute `npm test` in the `server/` directory and `npm run test:e2e` in the `client/` directory as separate jobs.
3. WHEN any Backend_Test fails, THE CI SHALL exit with a non-zero code and mark the CI job as failed, blocking merge.
4. WHEN any E2E_Test fails, THE CI SHALL exit with a non-zero code and mark the CI job as failed, blocking merge.
5. WHEN all tests pass, THE Test_Suite SHALL generate a Vitest coverage report in `server/coverage/` in both `text` and `lcov` formats.
6. WHEN all E2E tests pass, THE Test_Suite SHALL generate a Playwright HTML report in `client/playwright-report/` directory.
7. THE CI workflow SHALL upload the Vitest coverage report and Playwright HTML report as CI artifacts, retained for 30 days.
8. THE CI workflow SHALL install dependencies using `npm ci` (not `npm install`) to ensure reproducible builds from lockfiles.
9. WHERE the `mongodb-memory-server` binary is used in CI, THE CI workflow SHALL cache the binary download directory between runs to reduce build time.
