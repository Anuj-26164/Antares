# ANTARES2 — Project Structure

## Overview

Full-stack event media platform built with React (Vite) + Express + MongoDB + Cloudflare R2.

```
ANTARES2/
├── client/                         # React frontend (Vite + Tailwind)
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── public/
│   │   └── antareslogo.svg
│   └── src/
│       ├── App.jsx                 # Root component — routing, hydration gate
│       ├── main.jsx                # Entry point — React DOM render
│       ├── components/
│       │   ├── admin/
│       │   │   ├── AdminLayout.jsx
│       │   │   ├── AdminSidebar.jsx
│       │   │   └── AdminTopBar.jsx
│       │   ├── auth/
│       │   │   └── GoogleAuthButton.jsx
│       │   ├── common/
│       │   │   ├── BackButton.jsx
│       │   │   ├── Badge.jsx
│       │   │   ├── BorderGlow.jsx
│       │   │   ├── BrandLink.jsx
│       │   │   ├── Button.jsx
│       │   │   ├── EmptyState.jsx
│       │   │   ├── GlassCard.jsx
│       │   │   ├── Input.jsx
│       │   │   ├── LightRays.jsx
│       │   │   ├── PillNav.jsx
│       │   │   ├── Skeleton.jsx
│       │   │   └── TextType.jsx
│       │   ├── events/
│       │   │   ├── EventAlbumCard.jsx  # Event card with separate photo/video counters
│       │   │   └── FilterBar.jsx
│       │   ├── gallery/
│       │   │   ├── GalleryGrid.jsx
│       │   │   ├── MediaCard.jsx       # Media card with video thumbnail support
│       │   │   ├── MediaModal.jsx
│       │   │   └── UploadZone.jsx      # Drag-and-drop upload (admin/photographer/club_member)
│       │   ├── landing/
│       │   │   ├── AnnouncementBanner.jsx
│       │   │   ├── CTAFooterBand.jsx
│       │   │   ├── DarkProblemPanel.jsx
│       │   │   ├── FeaturesSection.jsx
│       │   │   ├── Footer.jsx
│       │   │   ├── HeroSection.jsx
│       │   │   ├── Navbar.jsx
│       │   │   ├── StatsSection.jsx
│       │   │   └── StatsTicker.jsx
│       │   └── layout/
│       │       ├── AdminRouteGuard.jsx
│       │       ├── AppNavbar.jsx
│       │       ├── GuestRoute.jsx
│       │       └── ProtectedRoute.jsx
│       ├── pages/
│       │   ├── admin/
│       │   │   ├── AIInsightsPanel.jsx
│       │   │   ├── AnalyticsPanel.jsx
│       │   │   ├── EventManagementPanel.jsx
│       │   │   ├── MediaManagementPanel.jsx
│       │   │   ├── NotificationsPanel.jsx
│       │   │   ├── SettingsPanel.jsx
│       │   │   └── UserManagementPanel.jsx
│       │   ├── EventAlbumPage.jsx      # Event album with upload zone for authorized roles
│       │   ├── EventsPage.jsx
│       │   ├── GalleryPage.jsx         # Unified gallery — all media, infinite scroll, sort
│       │   ├── LandingPage.jsx
│       │   ├── LoginPage.jsx
│       │   ├── ProfilePage.jsx
│       │   └── RegisterPage.jsx
│       ├── store/
│       │   ├── authStore.js        # Zustand — auth, user, hydration
│       │   ├── eventStore.js       # Zustand — events CRUD
│       │   ├── mediaStore.js       # Zustand — gallery media
│       │   └── themeStore.js       # Zustand — dark/light theme
│       ├── styles/
│       │   └── global.css          # Tailwind base + custom tokens
│       └── utils/
│           ├── api.js              # Axios instance + interceptors
│           ├── avatar.js           # getUserAvatar utility
│           └── formatters.js       # Display formatters
└── server/                         # Express backend
    ├── index.js                    # Server entry point
    ├── package.json
    ├── fix-urls.js                 # Utility script
    ├── promote-admin.js            # Utility script
    ├── config/
    │   ├── db.js                   # MongoDB connection
    │   ├── env.js                  # Env validation
    │   ├── passport.js             # Passport strategies
    │   └── r2.js                   # Cloudflare R2 S3 client
    ├── controllers/
    │   ├── adminController.js
    │   ├── authController.js
    │   ├── authController.test.js
    │   ├── eventController.js      # Separate photo/video counts per event
    │   ├── eventController.test.js
    │   ├── mediaController.js      # Upload with video thumbnail, watermarked download
    │   ├── mediaController.test.js
    │   ├── userController.js
    │   └── userController.test.js
    ├── middleware/
    │   ├── authMiddleware.js       # JWT verification
    │   ├── authMiddleware.test.js
    │   ├── errorHandler.js         # Global error handler
    │   ├── errorHandler.test.js
    │   ├── rateLimiter.js          # Rate limiting
    │   ├── roleMiddleware.js       # Role-based access
    │   ├── roleMiddleware.test.js
    │   ├── uploadMiddleware.js     # Multer (media + avatar)
    │   └── uploadMiddleware.test.js
    ├── models/
    │   ├── Comment.js
    │   ├── Event.js
    │   ├── Media.js                # Includes thumbnailUrl/thumbnailR2Key for videos
    │   ├── Notification.js
    │   ├── Settings.js
    │   └── User.js
    ├── routes/
    │   ├── adminRoutes.js
    │   ├── authRoutes.js
    │   ├── authRoutes.test.js
    │   ├── eventRoutes.js
    │   ├── mediaRoutes.js          # Upload + thumbnail endpoint: admin/photographer/club_member
    │   ├── mediaRoutes.test.js
    │   ├── userRoutes.js
    │   └── userRoutes.test.js
    ├── scripts/
    │   ├── migrateCoverMedia.js
    │   └── syncMediaVisibility.js  # Sync media isPublic with parent event visibility
    └── utils/
        ├── imageProcessor.js       # Sharp + FFmpeg — compress, watermark, video thumbnail
        ├── imageProcessor.test.js
        ├── tokenUtils.js           # JWT helpers
        └── tokenUtils.test.js
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS v4, Framer Motion, GSAP |
| State | Zustand (auth, media, events, theme) |
| Routing | React Router DOM v6 |
| HTTP | Axios (with interceptors) |
| Charts | Recharts, Chart.js |
| Backend | Express.js, Node.js |
| Database | MongoDB (Mongoose) |
| Auth | JWT (access + refresh), Passport (Google OAuth) |
| Storage | Cloudflare R2 (S3-compatible) |
| Image Processing | Sharp (compress, watermark, avatar) |
| Video Processing | FFmpeg via fluent-ffmpeg (watermark, thumbnail extraction) |
| File Upload | Multer + multer-s3, react-dropzone |
| Testing | Vitest (server) |

## Key Architecture Decisions

- **Zustand** as single auth source of truth (no Redux, no Context)
- **Hydration gate** in App.jsx blocks rendering until auth state resolves
- **Route guards** (ProtectedRoute, AdminRouteGuard, GuestRoute) handle access control
- **Axios interceptor** handles token refresh transparently
- **R2 storage** for all media + avatar uploads with Sharp preprocessing
- **Cookie-based auth** (httpOnly JWT cookies, not localStorage tokens)
- **Role-based upload** — admin, photographer, and club_member can upload media
- **Video thumbnails** — FFmpeg extracts frame at 1s during upload, stored as WebP in R2; lazy generation via `/api/media/:id/thumbnail` for existing videos (caches to R2 on first request)
- **Dynamic watermarks** — role-based opacity, diagonal tiled text (images via Sharp SVG overlay, videos via FFmpeg PNG overlay with scale2ref)
- **Separate media counters** — event cards show distinct photo and video counts
- **Media visibility inheritance** — media uploaded to private events is automatically marked private; private events only accessible to admin/photographer/club_member
- **User blocking** — admins can block users; blocked users are rejected at login, token refresh, and on every authenticated request
- **Unified gallery** — `/gallery` shows all media across events with infinite scroll and sort options
