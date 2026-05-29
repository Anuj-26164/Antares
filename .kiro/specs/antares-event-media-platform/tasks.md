# Implementation Plan: Antares Event Media Platform

## Overview

Phase 1 full-stack build of the Antares event media platform. The implementation follows a backend-first approach: project scaffolding → config/utilities → models → middleware → controllers/routes → frontend foundation → state/API layer → components → pages → routing. Each task builds on the previous, ending with a fully wired application.

## Tasks

- [x] 1. Project scaffolding and environment setup
  - [x] 1.1 Initialise server package and install backend dependencies
    - Create `/server/package.json` with `"type": "module"` and scripts (`start`, `dev`)
    - Install: `express`, `mongoose`, `dotenv`, `bcrypt`, `jsonwebtoken`, `cookie-parser`, `cors`, `passport`, `passport-google-oauth20`, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `multer`, `multer-s3`, `sharp`, `express-validator`
    - Install dev: `nodemon`
    - _Requirements: 14.1, 15.4, 15.5_
  - [x] 1.2 Initialise client package and install frontend dependencies
    - Create `/client` with Vite React scaffold (`npm create vite@latest client -- --template react`)
    - Install: `react-router-dom`, `framer-motion`, `zustand`, `axios`, `react-dropzone`
    - Install Tailwind CSS v4 (`@tailwindcss/vite` plugin)
    - _Requirements: 15.1, 15.2, 15.3, 15.6, 15.7_
  - [x] 1.3 Create root `.gitignore` and `.env.example`
    - Add `.env`, `node_modules/`, `dist/` to `.gitignore` at repo root
    - Create `/server/.env.example` listing all required variables: `PORT`, `MONGO_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, `CLIENT_URL`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` — all with empty or placeholder values, no real secrets
    - _Requirements: 14.3, 14.4_

- [x] 2. Backend configuration modules
  - [x] 2.1 Implement environment variable validation (`server/config/env.js`)
    - Read all 13 required env vars listed in Requirement 14.1
    - If any are missing, log each missing name and call `process.exit(1)` before any DB or service connection
    - Export validated config object for use by other modules
    - _Requirements: 14.1, 14.2_
  - [x] 2.2 Implement MongoDB connection (`server/config/db.js`)
    - Import `MONGO_URI` from `env.js`
    - Connect with Mongoose; log success or fatal error
    - Export `connectDB` function
    - _Requirements: 15.5_
  - [x] 2.3 Implement Cloudflare R2 S3 client (`server/config/r2.js`)
    - Create `S3Client` using `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`
    - Export the configured client and `R2_BUCKET_NAME`
    - _Requirements: 9.1, 9.9_
  - [x] 2.4 Implement Google OAuth Passport strategy (`server/config/passport.js`)
    - Configure `passport-google-oauth20` strategy with `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`
    - In verify callback: find or create user by `googleId` or matching email; store `googleId` on existing email-based accounts; reject unverified emails with an error
    - Serialize/deserialize user by `_id`
    - _Requirements: 5.1, 5.2, 5.4, 5.5_

- [x] 3. JWT utilities (`server/utils/tokenUtils.js`)
  - Implement `generateAccessToken(userId)` — signs with `JWT_SECRET`, 15-minute expiry
  - Implement `generateRefreshToken(userId)` — signs with `JWT_REFRESH_SECRET`, 7-day expiry
  - Implement `verifyAccessToken(token)` and `verifyRefreshToken(token)` — return `{ userId }` or throw
  - Implement `setAuthCookies(res, accessToken, refreshToken)` — sets httpOnly, sameSite, secure cookies
  - Implement `clearAuthCookies(res)` — clears both cookies
  - _Requirements: 4.2, 4.4, 4.5, 4.6_

- [x] 4. MongoDB models
  - [x] 4.1 Implement User model (`server/models/User.js`)
    - Define schema exactly as specified: `name`, `email` (unique, regex validated), `password`, `googleId`, `role` (enum, default `viewer`), `avatar`, `refreshToken`, `createdAt`
    - _Requirements: 7.1_
  - [x] 4.2 Implement Event model (`server/models/Event.js`)
    - Define schema: `title`, `description`, `category`, `date`, `createdBy` (ref User), `isPublic`, `coverImage`, `tags` (max 20), `createdAt`
    - _Requirements: 7.2_
  - [x] 4.3 Implement Media model (`server/models/Media.js`)
    - Define schema: `eventId` (ref Event), `uploadedBy` (ref User), `url`, `r2Key`, `type` (enum photo/video), `tags` (max 30), `likes`, `comments` (ref Comment array), `favouritedBy` (ref User array), `isPublic`, `createdAt`
    - _Requirements: 7.3_
  - [x] 4.4 Implement Comment model (`server/models/Comment.js`)
    - Define schema: `mediaId` (ref Media), `userId` (ref User), `text` (min 1, max 1000), `createdAt`
    - _Requirements: 7.4_

- [x] 5. Middleware layer
  - [x] 5.1 Implement auth middleware (`server/middleware/authMiddleware.js`)
    - Extract JWT from `accessToken` httpOnly cookie
    - Verify with `verifyAccessToken`; attach `req.user` (fetched from DB); call `next()`
    - On missing/invalid token return `{ success: false, error: "Authentication required" }` with 401
    - _Requirements: 6.2, 13.5, 13.6_
  - [x] 5.2 Implement role middleware (`server/middleware/roleMiddleware.js`)
    - Export factory `roleMiddleware(...allowedRoles)` returning Express middleware
    - Check `req.user.role` against `allowedRoles`; if not included return 403 `{ success: false, error: "Insufficient permissions" }`
    - _Requirements: 6.3, 6.4, 6.5, 6.6, 6.7, 13.5_
  - [x] 5.3 Implement upload middleware (`server/middleware/uploadMiddleware.js`)
    - Configure `multer-s3` storage using the R2 S3 client; set bucket, key (uuid + original extension), content-type
    - Apply file filter: accept JPEG, PNG, WebP, GIF, MP4, MOV, WebM only; reject others with 400
    - Apply size limits: 25 MB for images, 500 MB for videos
    - Export `uploadSingle` and `uploadBulk` (max 50 files) multer instances
    - _Requirements: 9.1, 9.2, 9.6, 9.7_
  - [x] 5.4 Implement global error handler (`server/middleware/errorHandler.js`)
    - Four-argument Express error handler
    - Map known error types to status codes; default to 500
    - Always return `{ success: false, error: message }` JSON
    - _Requirements: 13.5_

- [x] 6. Image processing utility (`server/utils/imageProcessor.js`)
  - Implement `compressImage(inputBuffer)` — resize to max 2048px on longest side, convert to WebP using Sharp; return Buffer
  - Implement `applyWatermark(inputBuffer, { userName, date })` — composite a semi-transparent text watermark onto the image using Sharp; return Buffer
  - _Requirements: 9.3, 10.3_

- [x] 7. Auth controller and routes
  - [x] 7.1 Implement auth controller (`server/controllers/authController.js`)
    - `register`: validate email format and password length (8–128); hash with bcrypt saltRounds 12; create User; return 201 `{ success: true, data: user }`; return 409 on duplicate email; return 400 on validation failure
    - `login`: find user by email; compare password with bcrypt; issue tokens via `tokenUtils`; set cookies; return 200 `{ success: true, data: user }`; return 401 on mismatch (generic message)
    - `logout`: clear cookies; nullify `refreshToken` on User document; return 200
    - `refresh`: read refresh cookie; verify with `verifyRefreshToken`; find user; issue new access token; return 200; return 401 on invalid/expired token
    - `googleCallback`: called after Passport success; issue tokens; set cookies; redirect to `CLIENT_URL`; on failure redirect to login with error query param
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 5.2, 5.3_
  - [x] 7.2 Implement auth routes (`server/routes/authRoutes.js`)
    - `POST /api/auth/register` → `register`
    - `POST /api/auth/login` → `login`
    - `POST /api/auth/logout` → `authMiddleware`, `logout`
    - `POST /api/auth/refresh` → `refresh`
    - `GET /api/auth/google` → `passport.authenticate('google', { scope: ['profile','email'] })`
    - `GET /api/auth/google/callback` → `passport.authenticate(...)`, `googleCallback`
    - _Requirements: 13.1_
  - [ ]* 7.3 Write unit tests for auth controller
    - Test register: valid input creates user and returns 201; duplicate email returns 409; short password returns 400
    - Test login: correct credentials return tokens; wrong password returns 401 with generic message
    - Test refresh: valid refresh cookie issues new access token; expired token returns 401
    - _Requirements: 4.1, 4.2, 4.3, 4.7, 4.8_

- [x] 8. Event controller and routes
  - [x] 8.1 Implement event controller (`server/controllers/eventController.js`)
    - `createEvent`: validate required fields; set `createdBy` to `req.user._id`; save; return 201 `{ success: true, data: event }`; return 400 on validation failure
    - `listEvents`: return public events + private events where `createdBy === req.user._id` or user is admin; paginate (default 20, max 100); return 200
    - `getEvent`: find by id; apply same visibility logic; return 200 or 404
    - `updateEvent`: verify requester is admin or creator; update mutable fields only; return 200 or 403/404
    - `deleteEvent`: verify requester is admin or creator; delete event, all associated Media, all associated Comments, all R2 objects; return 200 or 403/404
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 7.6_
  - [x] 8.2 Implement event routes (`server/routes/eventRoutes.js`)
    - Apply `authMiddleware` to all routes
    - `POST /api/events` → `roleMiddleware('admin','photographer')`, `createEvent`
    - `GET /api/events` → `listEvents`
    - `GET /api/events/:id` → `getEvent`
    - `PUT /api/events/:id` → `updateEvent`
    - `DELETE /api/events/:id` → `deleteEvent`
    - _Requirements: 13.2, 13.6_
  - [ ]* 8.3 Write unit tests for event controller
    - Test createEvent: valid payload returns 201; missing title returns 400; non-admin/photographer returns 403
    - Test deleteEvent: cascades to media and comments; non-creator returns 403; missing id returns 404
    - _Requirements: 8.1, 8.4, 8.5, 8.7_

- [x] 9. Media controller and routes
  - [x] 9.1 Implement media upload logic (`server/controllers/mediaController.js` — upload handlers)
    - `uploadMedia`: after multer-s3 streams files to R2, run `compressImage` for image types; create Media records with `url`, `r2Key`, `type`, `eventId`, `uploadedBy`; handle partial failures (process valid files, collect rejected ones); return 201 with `{ success: true, data: { uploaded, rejected } }`
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8_
  - [x] 9.2 Implement media retrieval and access logic (mediaController.js — read handlers)
    - `listMedia`: paginate (default 20); support `sortBy` (uploadDate, eventDate, likes) and `sortOrder`; support `eventId` filter; return public media + private media for authorized roles; return 200
    - `getMedia`: find by id; for private media check role (admin/photographer/club_member); return signed URL via `@aws-sdk/s3-request-presigner` (15-min expiry) for private; return public URL for public; return 404 if not found; return 403 for viewer on private
    - `downloadMedia`: generate signed URL with 15-min expiry; apply `applyWatermark` with `req.user.name` and current date; return signed URL; return 503 if R2 unavailable
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_
  - [x] 9.3 Implement media interaction logic (mediaController.js — interaction handlers)
    - `toggleFavourite`: add/remove `req.user._id` from `media.favouritedBy`; return updated favourite state; require club_member+; return 404 if media not found
    - `addComment`: validate text (1–1000 chars); create Comment; push to `media.comments`; return 201; return 400 on invalid text; return 404 if media not found
    - `listComments`: return comments for media item; return 200
    - `deleteMedia`: verify requester is admin or uploader; delete Comment records; delete R2 object (return 500 if R2 fails, retain record); delete Media record; return 200
    - _Requirements: 12.1, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 7.7_
  - [x] 9.4 Implement media routes (`server/routes/mediaRoutes.js`)
    - Apply `authMiddleware` to all routes
    - `POST /api/media/upload/:eventId` → `roleMiddleware('admin','photographer')`, `uploadBulk`, `uploadMedia`
    - `GET /api/media` → `listMedia`
    - `GET /api/media/:id` → `getMedia`
    - `GET /api/media/:id/download` → `roleMiddleware('admin','photographer','club_member')`, `downloadMedia`
    - `DELETE /api/media/:id` → `deleteMedia`
    - `POST /api/media/:id/favourite` → `roleMiddleware('admin','photographer','club_member')`, `toggleFavourite`
    - `POST /api/media/:id/comments` → `roleMiddleware('admin','photographer','club_member')`, `addComment`
    - `GET /api/media/:id/comments` → `listComments`
    - _Requirements: 13.3, 13.6_
  - [ ]* 9.5 Write unit tests for media controller
    - Test toggleFavourite: adds userId on first call, removes on second; viewer returns 403; missing media returns 404
    - Test addComment: valid text creates comment; empty text returns 400; text > 1000 chars returns 400
    - Test deleteMedia: R2 failure returns 500 and retains record; admin can delete any media
    - _Requirements: 12.1, 12.3, 12.6, 12.7, 12.8_

- [x] 10. User controller and routes
  - [x] 10.1 Implement user controller (`server/controllers/userController.js`)
    - `getMe`: return `req.user` profile (exclude `password`, `refreshToken`); return 200
    - `updateMe`: allow updating `name`, `avatar`; save; return 200
    - `getMyFavourites`: find Media where `favouritedBy` contains `req.user._id`; sort reverse-chronological; paginate max 20; return 200
    - `changeRole`: admin only; validate target role is one of the four valid roles; update user; return 200
    - _Requirements: 6.8, 12.2_
  - [x] 10.2 Implement user routes (`server/routes/userRoutes.js`)
    - Apply `authMiddleware` to all routes
    - `GET /api/users/me` → `getMe`
    - `PUT /api/users/me` → `updateMe`
    - `GET /api/users/me/favourites` → `getMyFavourites`
    - `PUT /api/users/:id/role` → `roleMiddleware('admin')`, `changeRole`
    - _Requirements: 13.4, 13.6_

- [x] 11. Express app entry point (`server/index.js`)
  - Call `validateEnv()` first; then `connectDB()`; initialize Passport; mount CORS (origin `CLIENT_URL`, credentials true), `cookieParser`, JSON body parser
  - Mount routes: `/api/auth`, `/api/events`, `/api/media`, `/api/users`
  - Mount `errorHandler` last
  - Listen on `PORT`
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 14.1, 14.2_

- [x] 12. Backend checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Frontend foundation
  - [x] 13.1 Configure Vite and Tailwind v4 (`client/vite.config.js`, `client/tailwind.config.js`)
    - Add `@tailwindcss/vite` plugin to Vite config
    - Confirm Tailwind v4 setup with `@import "tailwindcss"` in global CSS
    - _Requirements: 15.3_
  - [x] 13.2 Create global CSS with design system tokens (`client/src/styles/global.css`)
    - Add `@import "tailwindcss"` at top
    - Define `@theme {}` block with all color tokens: `--color-obsidian: #09090b`, `--color-ink: #18181b`, `--color-graphite: #3f3f46`, `--color-steel: #71717a`, `--color-ash: #a1a1aa`, `--color-fog: #ececee`, `--color-mist: #f4f4f5`, `--color-snow: #ffffff`, `--color-ember: #ff5a00`, `--color-orchid: #fe45e2`
    - Define border-radius tokens: `--radius-hero: 48px`, `--radius-card: 36px`, `--radius-card-compact: 28px`, `--radius-pill: 36px`, `--radius-btn: 16px`, `--radius-badge: 12px`, `--radius-input: 14px`
    - Import DM Sans from Google Fonts; apply as base font-family with sans-serif fallback
    - _Requirements: 2.1, 2.2, 2.3_

- [x] 14. API utility and Zustand stores
  - [x] 14.1 Implement Axios instance with interceptors (`client/src/utils/api.js`)
    - Create Axios instance with `baseURL` pointing to server, `withCredentials: true`
    - Add response interceptor: on 401, call `/api/auth/refresh`; retry original request once; on second 401 redirect to `/login`
    - _Requirements: 4.4, 4.5_
  - [x] 14.2 Implement auth Zustand store (`client/src/store/authStore.js`)
    - State: `user`, `isAuthenticated`
    - Actions: `login(credentials)`, `register(data)`, `logout()`, `refreshToken()`, `googleLogin()` (redirects to `/api/auth/google`)
    - Each action calls the corresponding API endpoint via `api.js`; updates state on success
    - _Requirements: 15.6_
  - [x] 14.3 Implement media Zustand store (`client/src/store/mediaStore.js`)
    - State: `items`, `hasMore`, `page`, `sortBy`, `sortOrder`, `eventFilter`
    - Actions: `fetchMedia()` (reset + load page 1), `loadMore()` (append next page), `setSort(sortBy, sortOrder)`, `setEventFilter(eventId)`, `toggleFavourite(mediaId)`, `addComment(mediaId, text)`
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 15.6_
  - [x] 14.4 Implement event Zustand store (`client/src/store/eventStore.js`)
    - State: `events`, `currentEvent`
    - Actions: `fetchEvents()`, `createEvent(data)`, `updateEvent(id, data)`, `deleteEvent(id)`
    - _Requirements: 15.6_

- [x] 15. Common UI components
  - [x] 15.1 Implement `Button` component (`client/src/components/common/Button.jsx`)
    - Props: `variant` (filled/outline), `size`, `disabled`, `onClick`, `children`
    - Filled: background `#09090b` or `#222222`; hover state; disabled at 0.5 opacity preserving background
    - Scale to 1.02 on hover via `transform` with 0.2s ease transition (Framer Motion `whileHover`)
    - Pill variant uses `--radius-pill`; rect variant uses `--radius-btn`
    - _Requirements: 2.3, 2.4, 2.5, 3.7_
  - [x] 15.2 Implement `Input` component (`client/src/components/common/Input.jsx`)
    - Props: `type`, `placeholder`, `value`, `onChange`, `maxLength`, `error`
    - Apply `--radius-input` (14px) border-radius
    - Render inline error message when `error` prop is set
    - _Requirements: 2.3_
  - [x] 15.3 Implement `Badge` component (`client/src/components/common/Badge.jsx`)
    - Props: `label`, `color`
    - Apply `--radius-badge` (12px) border-radius
    - _Requirements: 2.3_
  - [x] 15.4 Implement `EmptyState` component (`client/src/components/common/EmptyState.jsx`)
    - Props: `message`, `action` (optional button config)
    - Render centered message and optional retry/action button
    - _Requirements: 11.5_

- [x] 16. Landing page components
  - [x] 16.1 Implement `AnnouncementBanner` (`client/src/components/landing/AnnouncementBanner.jsx`)
    - Full-width bar, `#222222` background, `48px` border-radius
    - _Requirements: 1.1_
  - [x] 16.2 Implement `Navbar` (`client/src/components/landing/Navbar.jsx`)
    - Sticky, 56px height, backdrop-filter blur
    - Animate backdrop-filter from `blur(0)` to `blur(12px)` when scroll > 50px over 0.3s (Framer Motion `animate`)
    - Wordmark, nav links, Sign In and Sign Up buttons using `Button` component
    - _Requirements: 1.2, 3.5_
  - [x] 16.3 Implement `HeroSection` (`client/src/components/landing/HeroSection.jsx`)
    - 2-column layout; 56–64px display headline
    - Cycling accent word: rotate every 2.5s using `AnimatePresence` with 0.4s opacity crossfade
    - Email CTA `Input` (maxLength 254); on submit navigate to `/register?email=...`
    - Framer Motion fade-up entrance: opacity 0→1, translateY 24px→0, 0.6s easeOut; staggerChildren 0.15s
    - _Requirements: 1.3, 1.10, 2.5, 3.1, 3.2, 3.3_
  - [x] 16.4 Implement `StatsTicker` (`client/src/components/landing/StatsTicker.jsx`)
    - CSS `@keyframes` translateX, linear, 25s infinite loop
    - _Requirements: 1.4, 2.7, 3.7_
  - [x] 16.5 Implement `FeaturesSection` (`client/src/components/landing/FeaturesSection.jsx`)
    - 3-column grid; minimum 6 feature cards; Snow (#ffffff) cards with 36px border-radius
    - Scroll-reveal via Framer Motion + IntersectionObserver at 0.2 threshold: opacity 0→1, translateY 20px→0, 0.08s stagger per card
    - _Requirements: 1.5, 3.4_
  - [x] 16.6 Implement `DarkProblemPanel` (`client/src/components/landing/DarkProblemPanel.jsx`)
    - Obsidian (#09090b) background, 36px border-radius
    - Slide-in rows: translateX -20px→0, opacity 0→1, staggered 0.1s per row on scroll intersection
    - _Requirements: 1.6, 3.6_
  - [x] 16.7 Implement `StatsSection` (`client/src/components/landing/StatsSection.jsx`)
    - Numerals at 40–56px font-size; Steel (#71717a) labels
    - _Requirements: 1.7_
  - [x] 16.8 Implement `CTAFooterBand` (`client/src/components/landing/CTAFooterBand.jsx`)
    - Obsidian (#09090b) panel; pill-shaped button with 36px border-radius using `Button` component
    - _Requirements: 1.8_

- [x] 17. Landing page assembly (`client/src/pages/LandingPage.jsx`)
  - Import and render all 8 landing components in order: AnnouncementBanner, Navbar, HeroSection, StatsTicker, FeaturesSection, DarkProblemPanel, StatsSection, CTAFooterBand
  - Wrap in a 1200px max-width centered container with 80px vertical section gaps (48px on mobile)
  - _Requirements: 1.9, 1.11, 2.6, 2.7_

- [x] 18. Auth pages
  - [x] 18.1 Implement `LoginPage` (`client/src/pages/LoginPage.jsx`)
    - Form with email `Input` and password `Input`; submit calls `authStore.login()`
    - Render `GoogleAuthButton` that calls `authStore.googleLogin()`
    - Show validation errors inline; on success navigate to `/gallery`
    - _Requirements: 4.2, 5.1_
  - [x] 18.2 Implement `RegisterPage` (`client/src/pages/RegisterPage.jsx`)
    - Form with name, email (pre-fill from `?email=` query param), password `Input` fields
    - Submit calls `authStore.register()`; show inline errors
    - Render `GoogleAuthButton`
    - On success navigate to `/gallery`
    - _Requirements: 4.1, 4.3, 5.1, 1.10_
  - [x] 18.3 Implement `GoogleAuthButton` (`client/src/components/auth/GoogleAuthButton.jsx`)
    - Button that triggers `authStore.googleLogin()` (redirects to `/api/auth/google`)
    - _Requirements: 5.1_

- [x] 19. Gallery components
  - [x] 19.1 Implement `MediaCard` (`client/src/components/gallery/MediaCard.jsx`)
    - Props: `media`, `onFavourite`, `onClick`
    - Display thumbnail, type badge, like count, favourite toggle button
    - 36px border-radius card; hover scale 1.02 via Framer Motion `whileHover`
    - _Requirements: 11.1, 12.1_
  - [x] 19.2 Implement `GalleryGrid` (`client/src/components/gallery/GalleryGrid.jsx`)
    - Responsive grid layout; render list of `MediaCard` components
    - Render `EmptyState` when no items
    - Render error message with retry button on fetch failure
    - _Requirements: 11.1, 11.5, 11.7_
  - [x] 19.3 Implement `UploadZone` (`client/src/components/gallery/UploadZone.jsx`)
    - Use `react-dropzone`; show file preview thumbnails (max 120px width)
    - Only render for admin/photographer roles (check `authStore.user.role`)
    - On drop call media upload API via `api.js`
    - _Requirements: 11.6_
  - [x] 19.4 Implement `MediaModal` (`client/src/components/gallery/MediaModal.jsx`)
    - Full-screen overlay showing selected media, comments list, add-comment form, download button
    - Download button calls download endpoint and triggers browser download
    - Framer Motion opacity/scale entrance animation
    - _Requirements: 10.3, 12.3_

- [x] 20. Gallery page (`client/src/pages/GalleryPage.jsx`)
  - On mount call `mediaStore.fetchMedia()`
  - Render sort controls (uploadDate desc default, eventDate asc/desc, likes desc) that call `mediaStore.setSort()`
  - Render event filter dropdown that calls `mediaStore.setEventFilter()`
  - Render `GalleryGrid` with `mediaStore.items`
  - Implement infinite scroll: attach scroll listener or IntersectionObserver on sentinel element; call `mediaStore.loadMore()` when sentinel is visible and `mediaStore.hasMore` is true
  - Render `UploadZone` for admin/photographer
  - Open `MediaModal` on card click
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_

- [x] 21. Profile page (`client/src/pages/ProfilePage.jsx`)
  - Fetch current user via `authStore.user`; display name, avatar, role badge
  - Fetch favourited media via `GET /api/users/me/favourites`; render in reverse-chronological paginated grid (max 20 per page)
  - Allow editing name and avatar via `PUT /api/users/me`
  - _Requirements: 12.2_

- [x] 22. App routing and page transitions (`client/src/App.jsx`, `client/src/main.jsx`)
  - [x] 22.1 Implement `ProtectedRoute` (`client/src/components/layout/ProtectedRoute.jsx`)
    - Check `authStore.isAuthenticated`; redirect to `/login` if false
    - _Requirements: 6.2_
  - [x] 22.2 Wire React Router and AnimatePresence in `App.jsx`
    - Define routes: `/` → `LandingPage`, `/login` → `LoginPage`, `/register` → `RegisterPage`, `/gallery` → `ProtectedRoute` → `GalleryPage`, `/profile` → `ProtectedRoute` → `ProfilePage`
    - Wrap `<Routes>` in Framer Motion `<AnimatePresence mode="wait">`
    - Each page component wraps its root element in `<motion.div>` with opacity 0→1, translateY 10px→0, 0.3s transition
    - _Requirements: 3.8_
  - [x] 22.3 Bootstrap app in `main.jsx`
    - Import `global.css`; render `<App />` into `#root`
    - _Requirements: 2.1, 2.2_

- [x] 23. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP build
- Each task references specific requirements for full traceability
- The design has no Correctness Properties section, so property-based tests are not applicable; unit tests cover critical business logic
- All animations are constrained to `transform`, `opacity`, and `filter` properties per Requirement 2.5
- No TypeScript files (.ts/.tsx) should be created anywhere in the project per Requirement 15.1
- Tailwind v4 `@theme {}` tokens must be used for all design tokens; no CSS-in-JS or CSS modules per Requirement 15.3
- Zustand is the only permitted shared state manager; `useState`/`useReducer` are fine for local component state per Requirement 15.6

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4"] },
    { "id": 3, "tasks": ["3", "4.1", "4.2", "4.3", "4.4"] },
    { "id": 4, "tasks": ["5.1", "5.2", "5.3", "5.4", "6"] },
    { "id": 5, "tasks": ["7.1", "8.1", "9.1"] },
    { "id": 6, "tasks": ["7.2", "7.3", "8.2", "8.3", "9.2", "9.3"] },
    { "id": 7, "tasks": ["9.4", "9.5", "10.1"] },
    { "id": 8, "tasks": ["10.2", "11"] },
    { "id": 9, "tasks": ["13.1"] },
    { "id": 10, "tasks": ["13.2"] },
    { "id": 11, "tasks": ["14.1"] },
    { "id": 12, "tasks": ["14.2", "14.3", "14.4"] },
    { "id": 13, "tasks": ["15.1", "15.2", "15.3", "15.4"] },
    { "id": 14, "tasks": ["16.1", "16.2", "16.3", "16.4", "16.5", "16.6", "16.7", "16.8"] },
    { "id": 15, "tasks": ["17", "18.3"] },
    { "id": 16, "tasks": ["18.1", "18.2", "19.1", "19.2", "19.3", "19.4"] },
    { "id": 17, "tasks": ["20", "21"] },
    { "id": 18, "tasks": ["22.1"] },
    { "id": 19, "tasks": ["22.2", "22.3"] }
  ]
}
```
