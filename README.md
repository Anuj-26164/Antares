# ANTARES

Event media management platform for campus clubs and organizers — built with React, Express, MongoDB, and Cloudflare R2.

---

## Features

### Auth
- Email/password registration and login
- Google OAuth one-click sign-in
- httpOnly JWT cookies with silent token refresh
- Blocked users rejected at login and on every request

### Roles
Four roles with distinct access levels:

| Role | Capabilities |
|---|---|
| `admin` | Full access including admin panel |
| `photographer` | Create events, upload to any event |
| `club_member` | Upload to events where they have an approved grant |
| `viewer` | Browse, like, comment, request upload access |

### Events
- Browse, filter by category/tags, sort by date or name
- Create events with title, description, category, date, tags, cover image, and public/private visibility
- AI-generated event descriptions — generate from metadata or improve an existing draft

### Media & Uploads
- Bulk photo and video uploads per event
- Auto-compression to WebP (images) with originals preserved for downloads
- Video thumbnail extraction at 1 second via FFmpeg
- AI smart tagging — vision LLM picks 3–5 tags from a curated 150+ campus-event vocabulary
- AI auto-captioning — generates a caption for photos uploaded without one
- Public/private visibility synced from the parent event

### Gallery
- Cross-event gallery with infinite scroll
- Sort by newest or most liked
- Full media modal with photo/video display, caption, likes, comments, user tagging, favourites, and download

### Likes, Comments & Favourites
- Like/unlike any media — count shown on cards and in modal
- Favourite media to your personal collection (accessible from profile)
- Comment on any media item
- Tag other users in photos/videos — triggers a real-time notification

### Downloads
- Role-based watermarks applied dynamically (lighter for admin, more visible for viewer)
- Watermark includes club name, event name, downloader name, and date
- Photos as high-quality JPEG, videos watermarked via FFmpeg

### Upload Access Requests
- Viewers can request upload access to a specific event with an optional message
- Admin or event creator can approve, deny, or revoke access
- Approved viewers get the upload zone on the event page

### Real-Time (Socket.IO)
Event room updates (visible to all watchers):
- New media uploaded, gallery refreshed, photo liked, comment posted
- AI tagging and captioning results pushed when ready

User room updates (private, per user):
- Notifications for likes, comments, tags, upload request decisions

### Notifications
- In-app notifications for: uploads, comments, likes, tags, user registrations, upload request activity
- Aggregated — multiple actors collapse into one notification with a count
- Mark individual or all as read, unread badge count
- Real-time delivery, never sent to yourself

### User Profile
- Edit display name and upload avatar (compressed to WebP, 512×512)
- View your favourited media collection

### Admin Panel
Six sections behind the `admin` role guard:

- **Analytics** — media/user stats, upload and registration charts for last 30 days
- **Event Management** — create, edit, delete events and manage cover images
- **Media Management** — browse, update, or delete any media across all events
- **User Management** — change roles, block/unblock accounts
- **Notifications** — view all platform notifications and unread counts
- **Settings** — configure upload size limit, max bulk count, allowed file types, default visibility

---

## Demo Admin Account

A default admin account is pre-seeded for testing:

| Field | Value |
|---|---|
| Email | `test@test.com` |
| Password | `test1234` |
| Role | `admin` |

Log in at `/login` with these credentials, then navigate to `/admin` for the admin dashboard.

To re-create this account on a fresh database:

```bash
node server/scripts/seedAdmin.js
```

---

## Admin Access

The admin dashboard (`/admin`) requires the `admin` role. To promote a registered user:

### 1. Register normally

Go to `/register` and create an account with the email you want to promote.

### 2. Run the promote script

From the project root:

```bash
node server/scripts/promoteAdmin.js your@email.com
```

Or from the `server/` directory:

```bash
node scripts/promoteAdmin.js your@email.com
```

You should see:

```
✅  "your@email.com" has been promoted to admin.
    They can now access /admin after logging in.
```

### 3. Log in and navigate to `/admin`

> The user must be registered before running the script.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS v4, Framer Motion, GSAP |
| State | Zustand |
| Routing | React Router DOM v6 |
| HTTP | Axios with interceptors |
| Backend | Express.js, Node.js |
| Database | MongoDB (Mongoose) |
| Auth | JWT cookies, Passport (Google OAuth) |
| Storage | Cloudflare R2 (S3-compatible) |
| Realtime | Socket.IO |
| Image Processing | Sharp (compress, watermark, avatar) |
| Video Processing | FFmpeg via fluent-ffmpeg |
| AI | Cloudflare Workers AI (Llama 3.3 70B + Llama 3.2 11B Vision) |
| Deployment | Railway (server), Vercel (client) |

---

## Setup

### Prerequisites

- Node.js 18+
- MongoDB cluster (Atlas or local)
- Cloudflare R2 bucket
- Google OAuth credentials
- Cloudflare account ID + Workers AI API token (optional, for AI features)

### 1. Install dependencies

```bash
cd server && npm install
cd ../client && npm install
```

### 2. Configure environment

```bash
cp server/.env.example server/.env
```

Fill in `server/.env` with your MongoDB URI, JWT secrets, Google OAuth credentials, R2 keys, and optionally the Cloudflare AI tokens.

### 3. Run

```bash
# Terminal 1 — API server (http://localhost:5000)
cd server && npm run dev

# Terminal 2 — React client (http://localhost:5173)
cd client && npm run dev
```

---

## Scripts

### Server
| Command | Description |
|---|---|
| `npm run dev` | Start with nodemon |
| `npm start` | Production start |

### Client
| Command | Description |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |

---
