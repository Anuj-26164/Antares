# ANTARES — Project Structure

## Overview

Full-stack event media platform built with React (Vite) + Express + MongoDB + Cloudflare R2.

```
ANTARES/
├── client/                         # React frontend (Vite + Tailwind CSS v4)
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── vercel.json                 # Vercel deployment config
│   ├── public/
│   │   ├── antareslogo.svg
│   │   └── favicon.png
│   └── src/
│       ├── App.jsx                 # Root component — routing, hydration gate
│       ├── main.jsx                # Entry point — React DOM render
│       ├── components/
│       │   ├── admin/
│       │   │   ├── AdminLayout.jsx
│       │   │   └── AdminSidebar.jsx
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
│       │   │   ├── NotifItem.jsx
│       │   │   ├── PageLoader.jsx
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
│       │   │   ├── UploadZone.jsx      # Drag-and-drop upload (admin/photographer/club_member)
│       │   │   └── VideoPlayer.jsx
│       │   ├── landing/
│       │   │   ├── CTAFooterBand.jsx
│       │   │   ├── DarkProblemPanel.jsx
│       │   │   ├── FeaturesSection.jsx
│       │   │   ├── Footer.jsx
│       │   │   ├── HeroSection.jsx
│       │   │   ├── StatsSection.jsx
│       │   │   └── StatsTicker.jsx
│       │   └── layout/
│       │       ├── AdminRouteGuard.jsx
│       │       ├── AppNavbar.jsx
│       │       ├── GuestRoute.jsx
│       │       └── ProtectedRoute.jsx
│       ├── pages/
│       │   ├── admin/
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
│       │   ├── activityStore.js        # Zustand — live activity feed
│       │   ├── authStore.js            # Zustand — auth, user, hydration
│       │   ├── eventStore.js           # Zustand — events CRUD
│       │   ├── mediaInteractionStore.js # Zustand — likes, comments, favourites, tags
│       │   ├── mediaStore.js           # Zustand — gallery media
│       │   ├── notificationStore.js    # Zustand — in-app notifications
│       │   └── themeStore.js           # Zustand — dark/light theme
│       ├── styles/
│       │   └── global.css              # Tailwind base + custom tokens
│       └── utils/
│           ├── api.js                  # Axios instance + interceptors
│           ├── avatar.js               # getUserAvatar utility
│           ├── debounce.js             # Generic debounce utility
│           └── formatters.js           # Display formatters
└── server/                             # Express backend
    ├── index.js                        # Server entry point
    ├── package.json
    ├── nixpacks.toml                   # Railway deployment config
    ├── assets/                         # Font files for watermarking
    │   ├── DejaVuSans-Bold.ttf
    │   ├── DejaVuSans.ttf
    │   ├── Roboto-Bold.woff
    │   └── Roboto-Regular.woff
    ├── config/
    │   ├── db.js                       # MongoDB connection
    │   ├── env.js                      # Env validation
    │   ├── passport.js                 # Passport strategies
    │   └── r2.js                       # Cloudflare R2 S3 client
    ├── controllers/
    │   ├── adminController.js
    │   ├── authController.js
    │   ├── eventController.js          # Separate photo/video counts per event
    │   ├── mediaController.js          # Upload with video thumbnail, watermarked download
    │   ├── notificationController.js
    │   ├── uploadGrantController.js    # Upload access request management
    │   └── userController.js
    ├── middleware/
    │   ├── authMiddleware.js           # JWT verification
    │   ├── errorHandler.js             # Global error handler
    │   ├── rateLimiter.js              # Rate limiting
    │   ├── roleMiddleware.js           # Role-based access
    │   └── uploadMiddleware.js         # Multer (media + avatar)
    ├── models/
    │   ├── Comment.js
    │   ├── Event.js
    │   ├── Media.js                    # Includes thumbnailUrl/thumbnailR2Key for videos
    │   ├── Notification.js
    │   ├── Settings.js
    │   ├── UploadGrant.js              # Upload access grant requests per event
    │   └── User.js
    ├── routes/
    │   ├── adminRoutes.js
    │   ├── authRoutes.js
    │   ├── eventRoutes.js
    │   ├── mediaRoutes.js              # Upload + thumbnail endpoint
    │   ├── notificationRoutes.js
    │   └── userRoutes.js
    ├── scripts/                        # One-off admin utility scripts
    │   ├── migrateCoverMedia.js
    │   ├── promoteAdmin.js
    │   ├── seedAdmin.js
    │   └── syncMediaVisibility.js
    ├── sockets/                        # Socket.IO event handlers
    │   ├── activitySocket.js
    │   ├── index.js
    │   ├── mediaSocket.js
    │   ├── notificationSocket.js
    │   └── presenceSocket.js
    └── utils/
        ├── aiDescription.js            # AI event description generation
        ├── cfAi.js                     # Cloudflare Workers AI client
        ├── imageCaptioner.js           # AI auto-captioning (vision LLM)
        ├── imageProcessor.js           # Sharp + FFmpeg — compress, watermark, thumbnail
        ├── imageTagger.js              # AI smart tagging (vision LLM)
        ├── notificationAggregator.js   # Notification grouping logic
        └── tokenUtils.js              # JWT helpers
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS v4, Framer Motion, GSAP |
| State | Zustand (auth, media, events, notifications, theme) |
| Routing | React Router DOM v6 |
| HTTP | Axios (with interceptors) |
| Charts | Recharts, Chart.js |
| Backend | Express.js, Node.js |
| Database | MongoDB (Mongoose) |
| Auth | JWT (access + refresh cookies), Passport (Google OAuth) |
| Storage | Cloudflare R2 (S3-compatible) |
| Realtime | Socket.IO |
| Image Processing | Sharp (compress, watermark, avatar) |
| Video Processing | FFmpeg via fluent-ffmpeg (watermark, thumbnail extraction) |
| AI | Cloudflare Workers AI (Llama 3.3 70B + Llama 3.2 11B Vision) |
| Deployment | Railway (server), Vercel (client) |

## Key Architecture Decisions

- **Zustand** as single auth source of truth (no Redux, no Context)
- **Hydration gate** in App.jsx blocks rendering until auth state resolves
- **Route guards** (ProtectedRoute, AdminRouteGuard, GuestRoute) handle access control
- **Axios interceptor** handles token refresh transparently
- **R2 storage** for all media + avatar uploads with Sharp preprocessing
- **Cookie-based auth** (httpOnly JWT cookies, not localStorage tokens)
- **Role-based upload** — admin, photographer, and club_member can upload media; club_member requires an approved upload grant per event
- **Video thumbnails** — FFmpeg extracts frame at 1s during upload, stored as WebP in R2; lazy generation via `/api/media/:id/thumbnail` for existing videos (caches to R2 on first request)
- **Dynamic watermarks** — role-based opacity, diagonal tiled text (images via Sharp SVG overlay, videos via FFmpeg PNG overlay with scale2ref)
- **Separate media counters** — event cards show distinct photo and video counts
- **Media visibility inheritance** — media uploaded to private events is automatically marked private; private events only accessible to admin/photographer/club_member
- **User blocking** — admins can block users; blocked users are rejected at login, token refresh, and on every authenticated request
- **Unified gallery** — `/gallery` shows all media across events with infinite scroll and sort options
- **Aggregated notifications** — multiple actors collapse into one notification with a count; delivered in real-time via Socket.IO user rooms
- **AI features** — event description generation (Llama 3.3 70B), auto-captioning and smart tagging (Llama 3.2 11B Vision); all optional and gated on env vars
