# ANTARES2

Event media management platform with authentication, gallery uploads, real-time notifications, and admin tooling.

## Stack

- **Client:** React + Vite, Zustand, Tailwind, Framer Motion, Playwright (E2E)
- **Server:** Node.js + Express, MongoDB (Mongoose), Socket.IO, Passport (Google OAuth + local), Cloudflare R2 storage, Sharp / fluent-ffmpeg for media processing
- **AI:** Google Gemini (`@google/genai`)

## Project structure

```
client/   # Vite + React app
server/   # Express API, Socket.IO, MongoDB models
.kiro/    # Spec / steering files
```

## Prerequisites

- Node.js 18+
- npm
- A MongoDB cluster (Atlas or local)
- Cloudflare R2 bucket (or S3-compatible store)
- Google OAuth credentials
- Google Gemini API key (optional, for AI features)

## Setup

### 1. Install dependencies

```bash
cd server && npm install
cd ../client && npm install
```

### 2. Configure environment

Copy the example env and fill in real values:

```bash
cp server/.env.example server/.env
```

Edit `server/.env` with your MongoDB URI, JWT secrets, Google OAuth credentials, R2 keys, and Gemini API key.

### 3. Run

In two terminals:

```bash
# Terminal 1 - server (http://localhost:5000)
cd server
npm run dev

# Terminal 2 - client (http://localhost:5173)
cd client
npm run dev
```

## Scripts

### Server

- `npm run dev` — start with nodemon
- `npm start` — production start
- `npm test` — run Vitest suite
- `npm run test:smoke` — smoke tests only
- `npm run test:integration` — integration tests
- `npm run test:coverage` — coverage report

### Client

- `npm run dev` — Vite dev server
- `npm run build` — production build
- `npm run preview` — preview built bundle
- `npm run test:e2e` — Playwright E2E tests

## Notes

- Never commit `server/.env`. It's gitignored, but double-check before pushing.
- Background scripts in `server/scripts/` (e.g. `migrateCoverMedia.js`) are one-off migrations — read before running.
