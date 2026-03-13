# GFL Timer

A Clash of Clans companion web app for the **GFL (Gaming Family League)** community. It provides clan lookup, war tracking, and an admin dashboard fed by Google Sheets, with optional PWA support.

---

## Tech Stack

| Layer    | Stack |
| -------- | ----- |
| Frontend | React 18, Vite, React Router, SASS, Socket.IO client, PWA (Vite plugin) |
| Backend  | Node.js, Express, MongoDB, Socket.IO, Helmet, CORS |
| External | Clash of Clans API (clashofclans.js), Google Sheets (CSV export) |

---

## Features

### Public (all visitors)

- **Home** – Hero, clan search by tag (navigate to clan details).
- **Auth** – Register, Login, JWT-based sessions. Roles: `user`, `admin`, `root`.

### Admin-only (Clans & Dashboard)

- **Clans page** (`/clans`) – Visible only to admins and root. Not shown to regular users or guests.
  - **GFL Clans** – List of GFL family clans (from sheet), with current war status and “Not in war (since …)” when applicable.
  - **Following Clans** – List of “following” clans (from a second sheet). Same list/detail behaviour.
  - Compact cards: badge, name, tag, war status; no “Visit In-Game” link.
- **Clan details** (`/clans/:clanTag`) – Full clan info, current war, war log (admin-only access when Clans are restricted).

### Admin Dashboard (`/dashboard`)

- **GFL Clans** – List GFL clans (active / ex-GFL), force sync from Google Sheet.
- **Following Clans** – List following clans, force sync from sheet.
- **Track Clans** – Checkboxes (persisted in DB):
  - Track all GFL clans
  - Track vary clans (GFL with non-zero vary)
  - Track following clans  
  Used by the war-status check to decide which clans to check each day.
- **Sync Time** – Set the daily “war status check” start (date + time). Stored in DB. Check window is 1 hour: **start** = syncTime + minVary − 5 mins, **end** = syncTime + 60 mins + maxVary (vary values in DB are in minutes). Clans are checked continuously every minute in that window. After the window ends, sync time advances to the same time next day.
- **Users** (root only) – List users, change role, delete user.

### Data & background jobs

- **Sheet sync** – GFL clans and following clans are synced from two Google Sheets:
  - Runs ~10s after startup, then every hour.
  - Admins can force sync from the Dashboard (GFL and Following tabs).
- **War status check** – Daily 1-hour sync window based on Sync Time and “Track Clans”:
  - **Window start**: syncTime + minVary − 5 mins. **Window end**: syncTime + 60 mins + maxVary (vary in minutes).
  - The job runs every minute; clans are checked continuously in the window. Each clan is due when `now >= syncTime + clan.vary` (vary in minutes; following clans use `vary = 0`).
  - When a clan is `notInWar`, the backend records the timestamp and stops checking that clan until the next day.
- **War state** – “Not in war (since …)” is stored per clan and shown on the Clans page and in the Dashboard.

### Access control

- **Clans** – Link and routes (`/clans`, `/clans/:clanTag`) are visible and accessible only to admins and root. Others are redirected (e.g. home or login).
- **Dashboard** – Protected; requires admin (or root). Normal users see nothing (no link, route returns null).

---

## Project structure

```
timer/
├── backend/
│   ├── index.js              # Express app, Socket.IO, DB connect, sheet sync & war-check schedulers
│   ├── routes/
│   │   ├── admin.js          # GFL/following CRUD, sync, settings (sync time, track clans), users (root)
│   │   ├── auth.js           # Register, login, profile, root-only user management
│   │   ├── clans.js          # Public clan APIs (by tag, gfl-family, following-family, war, warlog)
│   │   └── gflClans.js       # Legacy/alternate GFL routes if used
│   ├── services/
│   │   ├── clanManagementService.js   # GFL & following clans DB, sheet upserts, getActiveGFLClansWithVary, getActiveFollowingClanTags
│   │   ├── warStatusCheckService.js   # getClansToCheckWithVary, runWarStatusCheckTick (by track settings + vary)
│   │   ├── warStateService.js        # recordNotInWarObserved, get state for clan
│   │   ├── settingsService.js        # getSyncAt, getSyncTime, setSyncTime, advanceSyncAtToNextDay, getTrackSettings, setTrackSettings
│   │   ├── gflSheetSyncService.js     # Sync GFL sheet → DB
│   │   ├── followingSheetSyncService.js # Sync following sheet → DB
│   │   ├── clashOfClansService.js     # CoC API (clan, current war, etc.)
│   │   ├── databaseService.js         # MongoDB connect, indexes, find/insert/update/upsert/delete
│   │   ├── authService.js             # Register, login, JWT, root user init
│   │   └── cacheService.js            # In-memory cache
│   └── .env                  # See "Environment variables" below
├── frontend/
│   ├── src/
│   │   ├── App.jsx           # Routes: Home, Clans (protected), ClanDetails (protected), Login, Register, Dashboard (protected)
│   │   ├── pages/            # Home, Clans, ClanDetails, Login, Register, Dashboard
│   │   ├── components/       # ClanCard, SectionTitle, ProtectedRoute, InstallPWA, clan-details/*, etc.
│   │   ├── contexts/         # AuthContext (isAdmin, isRoot, isAuthenticated, user)
│   │   ├── layouts/          # MainLayout, Header, Footer (Clans link only for admin/root)
│   │   ├── services/         # api.js (fetch clan, gfl-family, following-family, auth, admin APIs)
│   │   └── styles/
│   └── vite.config.js
└── README.md
```

---

## Environment variables

### Backend (`.env` in `backend/`)

| Variable | Description |
| -------- | ----------- |
| `PORT` | Server port (e.g. `3001`). |
| `NODE_ENV` | `development` or `production`. |
| `FRONTEND_URL` | Allowed CORS origins, comma-separated (e.g. `http://localhost:5175`). |
| `MONGODB_URI` | MongoDB connection string. |
| `MONGODB_DB_NAME` | Database name (e.g. `gfltimer`). |
| `JWT_SECRET` | Secret for signing JWTs. |
| `JWT_EXPIRES_IN` | Token lifetime (e.g. `7d`). |
| `ROOT_USERNAME`, `ROOT_EMAIL`, `ROOT_PASSWORD` | Root user created on first run. |
| `COC_EMAIL`, `COC_PASSWORD` | Clash of Clans API credentials. |
| `GFL_SHEET_CSV_URL` | Public CSV URL for GFL clans sheet. |
| `FOLLOWING_SHEET_CSV_URL` | Public CSV URL for following clans sheet. |

### Frontend

- Set `VITE_API_URL` (e.g. in `.env`) to the backend base URL (e.g. `http://localhost:3001/api`).

---

## Running the app

### Backend

```bash
cd backend
npm install
# Create backend/.env with the variables above
npm run dev   # or npm start
```

Server runs on `PORT`. Health: `GET /api/health`.

### Frontend

```bash
cd frontend
npm install
# Ensure VITE_API_URL points to your backend (e.g. http://localhost:3001/api)
npm run dev
```

Open the URL shown by Vite (e.g. `http://localhost:5175`). Use root or an admin account to access Dashboard and Clans.

---

## API overview

| Area | Examples |
| ---- | -------- |
| Health | `GET /api/health` |
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` |
| Clans (public) | `GET /api/clans/:tag`, `GET /api/clans/gfl-family`, `GET /api/clans/following-family`, war/warlog |
| Admin | `GET/POST /api/admin/gfl-clans`, `GET/POST /api/admin/following-clans`, sync endpoints, `GET/PUT /api/admin/settings/sync-time`, `GET/PUT /api/admin/settings/track-clans`, users (root) |

All admin and auth-protected routes use JWT in `Authorization: Bearer <token>`.

---

## Sheet format (reference)

- **GFL sheet** – Columns used for tag, name, status, vary (war check time offset in **minutes**, e.g. -4, 4, 0).
- **Following sheet** – Columns D (tag), E (name), G (status); no vary (all checked at sync time).

---

## License

MIT (or as specified in the repo).
