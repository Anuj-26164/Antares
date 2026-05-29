# Implementation Plan: Dark Mode & Admin Dashboard

## Overview

This plan implements a global dark mode theming system with Zustand persistence and a full admin dashboard with glassmorphism UI, analytics charts, and CRUD management panels. Tasks are ordered to build foundational pieces first (theme store, backend models/routes), then layer in the admin layout and panels, and finally wire everything together.

## Tasks

- [x] 1. Install dependencies and set up project structure
  - [x] 1.1 Install client dependencies (chart.js, react-chartjs-2)
    - Run `npm install chart.js react-chartjs-2` in the `client/` directory
    - Verify packages are added to `client/package.json`
    - _Requirements: 9.2, 9.3_

  - [x] 1.2 Install server dependencies (express-rate-limit)
    - Run `npm install express-rate-limit` in the `server/` directory
    - Verify package is added to `server/package.json`
    - _Requirements: 16.6_

  - [x] 1.3 Create directory structure for admin components and pages
    - Create `client/src/components/admin/` directory
    - Create `client/src/pages/admin/` directory
    - _Requirements: 6.1_

- [x] 2. Implement theme store and ThemeToggle component
  - [x] 2.1 Create the Zustand theme store (`client/src/store/themeStore.js`)
    - Implement `getInitialTheme()` reading localStorage then falling back to `window.matchMedia`
    - Implement `applyThemeToDOM(theme)` that adds/removes "dark" class on `document.documentElement`
    - Implement `toggleTheme` action that flips theme, persists to localStorage, and applies to DOM
    - Call `applyThemeToDOM` on store creation to set initial DOM state
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]* 2.2 Write property test for theme toggle round-trip
    - **Property 1: Theme toggle round-trip**
    - **Validates: Requirements 1.1, 1.4, 1.5**

  - [ ]* 2.3 Write property test for theme initialization priority
    - **Property 2: Theme initialization priority**
    - **Validates: Requirements 1.2, 1.3**

  - [x] 2.4 Create ThemeToggle component (`client/src/components/common/ThemeToggle.jsx`)
    - Import and consume `useThemeStore` for theme state and toggleTheme action
    - Render sun icon when theme is dark, moon icon when theme is light
    - Set `aria-label` to "Switch to dark mode" when light, "Switch to light mode" when dark
    - Style as a round button matching existing Navbar toggle aesthetics
    - _Requirements: 2.3, 2.4, 2.5_

  - [ ]* 2.5 Write property test for theme-dependent attribute rendering
    - **Property 3: Theme-dependent attribute rendering**
    - **Validates: Requirements 2.3, 7.2**

- [x] 3. Refactor Navbar to use theme store
  - [x] 3.1 Refactor Navbar (`client/src/components/landing/Navbar.jsx`) to use themeStore
    - Remove local `darkMode` state and its `useEffect` for DOM manipulation
    - Import `useThemeStore` and read `theme` and `toggleTheme` from the store
    - Replace the inline toggle button with the `ThemeToggle` component
    - Update all `darkMode` references to use `theme === 'dark'` from the store
    - Ensure the Navbar still renders ThemeToggle on all public/authenticated pages
    - _Requirements: 2.1, 2.5_

- [x] 4. Apply dark mode styling to existing pages and components
  - [x] 4.1 Apply dark mode styles to all existing pages
    - Update `LandingPage.jsx`, `LoginPage.jsx`, `RegisterPage.jsx`, `GalleryPage.jsx`, `ProfilePage.jsx`
    - Use Tailwind `dark:` prefix for background colors (obsidian #09090b for pages), text colors (snow #ffffff primary, mist #f4f4f5 secondary), and border colors (graphite #3f3f46)
    - Maintain existing accent colors (ember, orchid-flash) unchanged
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 4.2 Apply dark mode styles to all existing common and gallery components
    - Update `Button.jsx`, `Input.jsx`, `Badge.jsx`, `EmptyState.jsx` with `dark:` variants
    - Update `MediaCard.jsx`, `MediaModal.jsx`, `UploadZone.jsx`, `GalleryGrid.jsx` with `dark:` variants
    - Use ink (#18181b) for card surfaces, graphite (#3f3f46) for borders
    - _Requirements: 3.2, 3.4, 3.7_

- [x] 5. Checkpoint - Theme system verification
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Backend: Create Notification and Settings models
  - [x] 6.1 Create Notification model (`server/models/Notification.js`)
    - Define schema with fields: type (enum: media_upload, user_registration, comment), title (maxlength 200), message (maxlength 500), relatedUser (ObjectId ref User), relatedMedia (ObjectId ref Media), relatedEvent (ObjectId ref Event), isRead (Boolean default false), createdAt (Date default now)
    - Export the model
    - _Requirements: 13.1, 16.3_

  - [x] 6.2 Create Settings model (`server/models/Settings.js`)
    - Define schema with fields: key (String, default 'platform_settings', unique), uploadSizeLimit (Number, min 1, default 50), maxBulkUploadCount (Number, min 1, default 20), allowedImageTypes ([String] with defaults), allowedVideoTypes ([String] with defaults), defaultVisibility (enum: public/private, default 'public'), updatedAt (Date)
    - Export the model
    - _Requirements: 15.1, 15.5, 16.4_

- [x] 7. Backend: Rate limiter middleware and admin controller
  - [x] 7.1 Create rate limiter middleware (`server/middleware/rateLimiter.js`)
    - Import `express-rate-limit`
    - Export a factory function that accepts `{ windowMs, max }` options and returns a rate limiter middleware
    - Default configuration: 100 requests per 60 seconds per user
    - Return 429 status with `{ success: false, error: "Too many requests. Try again later." }`
    - _Requirements: 16.6_

  - [x] 7.2 Create admin controller (`server/controllers/adminController.js`)
    - Implement `getAnalytics`: query total counts from Event, Media, User models + time-series data (uploads/registrations per day for last 30 days)
    - Implement `getUsers`: paginated user list with query params (page, limit, search, role filter)
    - Implement `updateUserRole`: validate role is one of [admin, photographer, club_member, viewer], update user, return updated user
    - Implement `getNotifications`: paginated notification list sorted by createdAt descending
    - Implement `markNotificationRead`: set isRead to true, return updated notification
    - Implement `getUnreadCount`: count notifications where isRead is false
    - Implement `getSettings`: find settings by key 'platform_settings', create default if not exists
    - Implement `updateSettings`: validate input (uploadSizeLimit > 0, at least one image type, at least one video type), update and return settings
    - _Requirements: 16.1, 16.2, 16.3, 16.4_

  - [x] 7.3 Create admin routes (`server/routes/adminRoutes.js`)
    - Import authMiddleware, roleMiddleware, rateLimiter, and adminController
    - Apply middleware chain: authMiddleware → roleMiddleware('admin') → rateLimiter({ windowMs: 60000, max: 100 })
    - Define routes: GET /analytics, GET /users, PATCH /users/:id/role, GET /notifications, PATCH /notifications/:id/read, GET /notifications/unread-count, GET /settings, PUT /settings
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6_

  - [x] 7.4 Mount admin routes in server entry (`server/index.js`)
    - Import adminRoutes
    - Add `app.use('/api/admin', adminRoutes)` before the error handler
    - _Requirements: 16.1_

  - [ ]* 7.5 Write property test for admin endpoint access control
    - **Property 9: Admin endpoint access control**
    - **Validates: Requirements 16.5**

  - [ ]* 7.6 Write property test for settings validation rules
    - **Property 8: Settings validation rules**
    - **Validates: Requirements 15.4**

- [x] 8. Checkpoint - Backend verification
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Frontend: AdminRouteGuard and AdminLayout
  - [x] 9.1 Create AdminRouteGuard component (`client/src/components/layout/AdminRouteGuard.jsx`)
    - Import `useAuthStore` to check authentication and user role
    - If not authenticated, redirect to `/login` using `Navigate`
    - If authenticated but role is not "admin", redirect to `/`
    - If admin, render children (Outlet)
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 9.2 Create AdminSidebar component (`client/src/components/admin/AdminSidebar.jsx`)
    - Manage internal `collapsed` state, default to collapsed below 768px viewport
    - Render nav links for: Analytics Overview, Event Management, Media Management, User & Role Management, Notifications, AI Insights, Settings
    - Each link has an icon and label (label hidden when collapsed)
    - Animate width between 64px (collapsed) and 240px (expanded) using Framer Motion with 0.25s easeInOut
    - Include a collapse/expand toggle button
    - On mobile (<768px), overlay content area when expanded
    - _Requirements: 6.2, 6.3, 6.4, 8.3_

  - [x] 9.3 Create AdminTopBar component (`client/src/components/admin/AdminTopBar.jsx`)
    - Render at 64px height, fixed at top of content area
    - Display current section title (from route or context)
    - Include notifications bell icon with unread count badge
    - Include user avatar and name from authStore
    - Include ThemeToggle component
    - On bell click, show dropdown with 5 most recent notifications and link to full panel
    - _Requirements: 2.2, 6.5, 13.3, 13.4_

  - [x] 9.4 Create AdminLayout component (`client/src/components/admin/AdminLayout.jsx`)
    - Structure: flex container with AdminSidebar + content area (flex-1 with AdminTopBar + scrollable main with Outlet)
    - Use DM Sans as the typeface (import via Google Fonts or local)
    - Default to dark theme for admin dashboard
    - _Requirements: 6.1, 6.6, 6.7_

- [x] 10. Frontend: GlassCard component
  - [x] 10.1 Create GlassCard component (`client/src/components/common/GlassCard.jsx`)
    - Accept props: `children`, `className`, `animate` (boolean, default true)
    - Apply styles: backdrop-filter blur(12px), background rgba(24,24,27,0.6) in dark / rgba(255,255,255,0.6) in light, border 1px solid graphite (dark) / fog (light), border-radius 36px, padding 24px
    - When `animate` is true, use Framer Motion: initial opacity 0 + scale 0.97, animate to opacity 1 + scale 1 over 0.4s
    - Apply whileHover scale 1.01 with 0.2s transition
    - Support staggered entrance via `custom` prop for delay (0.08s per card)
    - _Requirements: 7.1, 7.2, 7.4, 8.2, 8.5_

- [x] 11. Frontend: Admin Dashboard panels
  - [x] 11.1 Create AnalyticsPanel (`client/src/pages/admin/AnalyticsPanel.jsx`)
    - Display 4 metric GlassCards: total events, total media, total users, total storage (formatted MB/GB)
    - Render 2 line charts using react-chartjs-2: media uploads over last 30 days, user registrations over last 30 days
    - Fetch data from `GET /api/admin/analytics`
    - Implement loading state, error state with retry button
    - Animate page entrance with Framer Motion (opacity 0→1, translateY 12→0, 0.3s easeOut)
    - Responsive grid: 1 col (<768px), 2 col (768-1200px), 4 col (≥1200px)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 17.2, 17.3, 17.4, 8.1_

  - [x] 11.2 Create EventManagementPanel (`client/src/pages/admin/EventManagementPanel.jsx`)
    - Render table with columns: title, date, category, creator name, media count, public/private status, actions
    - Implement search input filtering by title or category (real-time, case-insensitive)
    - Implement filter controls: status (public/private), date range, category
    - Create modal for creating new events (title, description, category, date, public/private toggle, cover image URL)
    - Create modal for editing events (pre-filled with event data)
    - Implement delete with confirmation dialog
    - Display colored badges: green for public, steel (#71717a) for private
    - Table supports horizontal scroll on mobile (<768px)
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 17.5_

  - [ ]* 11.3 Write property test for text search filtering correctness
    - **Property 4: Text search filtering correctness**
    - **Validates: Requirements 10.2, 12.2**

  - [x] 11.4 Create MediaManagementPanel (`client/src/pages/admin/MediaManagementPanel.jsx`)
    - Implement switchable grid view (thumbnail cards) and table view (rows with metadata)
    - Implement filter controls: event association, media type (photo/video), date range, visibility
    - Implement multi-select via checkboxes for bulk operations
    - Implement bulk actions: delete, make public, make private with confirmation dialog showing count
    - Display each item with: thumbnail, file type badge, event name, uploader name, upload date, visibility status
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

  - [ ]* 11.5 Write property test for bulk action targeting
    - **Property 5: Bulk action targeting**
    - **Validates: Requirements 11.4**

  - [x] 11.6 Create UserManagementPanel (`client/src/pages/admin/UserManagementPanel.jsx`)
    - Render table with columns: name, email, role, registration date, actions
    - Implement search input filtering by name or email (real-time)
    - Implement inline role dropdown with options: admin, photographer, club_member, viewer
    - On role change, send PATCH request; on failure, revert dropdown and show error notification
    - Implement role filter control
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

  - [x] 11.7 Create NotificationsPanel (`client/src/pages/admin/NotificationsPanel.jsx`)
    - Display chronological list of notifications (newest first) with type, title, message, timestamp
    - Implement mark-as-read on view (click/expand)
    - Prepend new notifications without page refresh (polling or optimistic)
    - Decrement unread count badge when notification is marked read
    - _Requirements: 13.1, 13.2, 13.5_

  - [ ]* 11.8 Write property test for notification chronological ordering
    - **Property 6: Notification chronological ordering**
    - **Validates: Requirements 13.1**

  - [ ]* 11.9 Write property test for read state count invariant
    - **Property 7: Read state count invariant**
    - **Validates: Requirements 13.5**

  - [x] 11.10 Create AIInsightsPanel (`client/src/pages/admin/AIInsightsPanel.jsx`)
    - Render heading "AI Insights" with "coming soon" description
    - Display placeholder GlassCards for: most popular events, trending media, user engagement metrics
    - Show sample static data or empty states in each card
    - Follow same GlassCard styling and animation patterns as other panels
    - _Requirements: 14.1, 14.2, 14.3_

  - [x] 11.11 Create SettingsPanel (`client/src/pages/admin/SettingsPanel.jsx`)
    - Display form fields: default upload size limit (MB), max bulk upload count, allowed image types (multi-select), allowed video types (multi-select), default visibility (public/private toggle)
    - Fetch current settings from `GET /api/admin/settings` on load
    - Validate: uploadSizeLimit > 0, at least one image type selected, at least one video type selected
    - On save, send `PUT /api/admin/settings`; show success confirmation or error notification
    - On failure, retain unsaved form values
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

- [x] 12. Checkpoint - Admin panels verification
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Wire admin routes in App.jsx and finalize
  - [x] 13.1 Wire admin routes in App.jsx
    - Import AdminRouteGuard, AdminLayout, and all admin panel pages
    - Add route group: `/admin` wrapped with AdminRouteGuard → AdminLayout as parent with Outlet
    - Define child routes: index → AnalyticsPanel, events → EventManagementPanel, media → MediaManagementPanel, users → UserManagementPanel, notifications → NotificationsPanel, ai-insights → AIInsightsPanel, settings → SettingsPanel
    - _Requirements: 5.1, 5.4_

  - [x] 13.2 Add responsive admin layout styles and ensure mobile behavior
    - Verify AdminSidebar collapses on mobile (<768px) and overlays when expanded
    - Verify metric cards stack in single column on mobile, 2-col on tablet, 4-col on desktop
    - Verify tables support horizontal scrolling on mobile
    - Verify AdminTopBar remains fixed across all viewport sizes
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6_

- [x] 14. Final checkpoint - Full build verification
  - Run `npm run build` in the client directory to verify no build errors
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The design uses JavaScript (React + Express), so all implementation uses JavaScript/JSX
- Existing Tailwind `@custom-variant dark` in global.css is leveraged as-is — no CSS config changes needed
- Framer Motion is already installed in the client

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1", "6.1", "6.2"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "7.1", "7.2"] },
    { "id": 3, "tasks": ["2.5", "3.1", "7.3"] },
    { "id": 4, "tasks": ["4.1", "4.2", "7.4", "7.5", "7.6"] },
    { "id": 5, "tasks": ["9.1", "10.1"] },
    { "id": 6, "tasks": ["9.2", "9.3"] },
    { "id": 7, "tasks": ["9.4"] },
    { "id": 8, "tasks": ["11.1", "11.2", "11.4", "11.6", "11.7", "11.10", "11.11"] },
    { "id": 9, "tasks": ["11.3", "11.5", "11.8", "11.9"] },
    { "id": 10, "tasks": ["13.1", "13.2"] }
  ]
}
```
