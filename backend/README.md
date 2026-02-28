# Trinity Backend Server

Version 2.1.0 - Enhanced with Optimized CWL Endpoints, Backend Calculations & Performance Improvements

## 🚀 Features

### Core Functionality
- ✅ Clash of Clans API integration via `clashofclans.js`
- ✅ Clan details, war data, war log
- ✅ Multi-clan batch fetching with optimization
- ✅ Database-backed clan and CWL management
- ✅ CWL clan filtering with TH-based eligibility
- ✅ Simplified CWL endpoints for optimal performance
- ✅ Backend-calculated CWL leaderboard and member statistics
- ✅ Automatic API re-authentication on session expiration
- ✅ User authentication and authorization (JWT-based)
- ✅ Admin dashboard API endpoints

### Performance
- ✅ In-memory caching (10-60 min TTL depending on data type)
- ✅ MongoDB persistent caching (data survives server restarts)
- ✅ Cache hit rate tracking and statistics
- ✅ Intelligent batching (5 concurrent requests max)
- ✅ Request logging with duration tracking
- ✅ Optimized badge fetching (reuses data from wars)
- ✅ Sequential API calls with delays to prevent rate limiting
- ✅ Server-side calculation of complex statistics (moved from frontend)

### Security
- ✅ Environment variables for all configuration (no hardcoded values)
- ✅ CORS restricted to specific origins
- ✅ Security headers via Helmet.js
- ✅ Error handling with no stack traces in production
- ✅ Structured logging
- ✅ Request size limits

## 🛠️ Installation

### Prerequisites
- Node.js 16+
- npm
- Clash of Clans developer credentials
- MongoDB (optional but recommended)

### Setup

1. **Install dependencies**
```bash
cd Trinity_Backend
npm install
```

2. **Create `.env` file**

**Required variables:**
```env
# Server Configuration (Required)
PORT=3001
FRONTEND_URL=http://localhost:5173,https://your-production-domain.com

# Clash of Clans API (Required)
COC_EMAIL=your-coc-email
COC_PASSWORD=your-coc-password

# Authentication (Required)
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d
ROOT_EMAIL=admin@trinitycoc.fun
ROOT_USERNAME=root
ROOT_PASSWORD=ChangeMe123!
```

**Optional variables:**
```env
# Database (Optional - app works without it)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/
MONGODB_DB_NAME=trinity
```

**Important:** All critical configuration must be provided via environment variables - no hardcoded defaults.

3. **Start the server**

Development:
```bash
npm run dev
```

Production:
```bash
npm start
```

## 📁 Project Structure

```
Trinity_Backend/
├── index.js                    # Main server with WebSocket
├── package.json
├── .env                        # Environment variables (not in git)
├── routes/
│   ├── clans.js               # Clan endpoints
│   ├── cwl.js                 # CWL endpoints
│   ├── stats.js               # Statistics endpoints
│   ├── images.js              # Image proxy endpoints
│   ├── cache.js               # Cache management endpoints
│   ├── auth.js                # Authentication endpoints
│   ├── admin.js               # Admin dashboard endpoints
│   ├── trinityClans.js        # Trinity clans endpoints
│   ├── cwlClans.js            # CWL clans endpoints
│   └── baseLayouts.js         # Base layouts endpoints
├── services/
│   ├── clashOfClansService.js # CoC API client (with caching)
│   ├── cwlService.js          # CWL filtering logic
│   ├── statsService.js        # Statistics aggregation
│   ├── cacheService.js        # Cache management (memory + DB)
│   ├── databaseService.js     # MongoDB database service
│   ├── authService.js         # Authentication service
│   └── clanManagementService.js # Clan management service
├── middleware/
│   └── auth.js                # Authentication middleware
└── utils/
    └── logger.js              # Logging utility
```

## 🔧 Configuration

### Environment Variables

**Required:**
- `PORT` - Server port (no default, must be set)
- `FRONTEND_URL` - Comma-separated list of allowed CORS origins (no default, must be set)
- `COC_EMAIL` - Clash of Clans API email
- `COC_PASSWORD` - Clash of Clans API password
- `JWT_SECRET` - Secret key for JWT tokens
- `ROOT_EMAIL` - Root admin email
- `ROOT_USERNAME` - Root username (default: "root")
- `ROOT_PASSWORD` - Root admin password

**Optional:**
- `MONGODB_URI` - MongoDB connection string (app runs without DB if not set)
- `MONGODB_DB_NAME` - MongoDB database name (required if MONGODB_URI is set)
- `JWT_EXPIRES_IN` - JWT expiration time (default: 7d)
- `NODE_ENV` - Environment mode (development/production)

### Cache TTL Settings

Defined in `services/cacheService.js`:

```javascript
export const CACHE_TTL = {
  CLAN_BASIC: 600,        // 10 minutes
  CLAN_WAR: 300,          // 5 minutes
  CLAN_WAR_LOG: 1800,     // 30 minutes
  CLAN_RAIDS: 3600,       // 1 hour
  STATS: 600,             // 10 minutes
  CWL_FILTERED: 600,      // 10 minutes
}
```

## 📊 API Endpoints

### CWL Endpoints

The CWL API has been simplified into focused endpoints for optimal performance:

1. **`GET /api/cwl/:clanTag/current`** - Basic CWL group data
   - Returns: state, season, clans, rounds with warTags
   - Use for: Initial page load, quick status checks
   - Cache: 10 minutes
   - Single API call to Clash of Clans API

2. **`GET /api/cwl/war/:warTag`** - Individual war details
   - Returns: Full war details with members and attacks
   - Use for: Viewing specific war details
   - Cache: 5 minutes
   - Includes mirror attack detection

3. **`GET /api/cwl/:clanTag/all`** - Complete CWL data (recommended for full details)
   - Returns: All rounds, leaderboard, member summary, round stats
   - Use for: Full CWL details page
   - Cache: 1 minute (more expensive operation)
   - Includes:
     - All war details for all rounds (filtered to requesting clan's wars only)
     - Pre-calculated leaderboard with promotion/demotion indicators and medal info
     - Member summary statistics (aggregated across all rounds with mirror bonus rule compliance)
     - Round-by-round statistics (stars, destruction, attacks)
   - Saves data to database (`cwlGroups`, `cwlWars` collections) for historical tracking
   - Most comprehensive endpoint - includes all calculations performed on backend

4. **`GET /api/cwl/clans/:clanTag/status`** - CWL status check
   - Returns: Current CWL state (inWar, preparation, notInWar, ended)
   - Use for: Quick status checks

### Public Endpoints

| Endpoint | Method | Description | Cache |
|----------|--------|-------------|-------|
| `/api/health` | GET | Server health & cache stats | - |
| `/api/clans/:tag` | GET | Get clan details | 10m |
| `/api/clans/multiple` | POST | Batch fetch clans | 10m |
| `/api/clans/:tag/war` | GET | Current war | 5m |
| `/api/clans/:tag/warlog` | GET | War history | 30m |
| `/api/cwl/clans` | GET | Filtered CWL clans | 10m |
| `/api/cwl/clans/:clanTag/status` | GET | Check CWL status for clan | 10m |
| `/api/cwl/:clanTag/current` | GET | Get current CWL group (basic data with warTags) | 10m |
| `/api/cwl/war/:warTag` | GET | Get individual CWL war details | 5m |
| `/api/cwl/:clanTag/all` | GET | Get all CWL rounds with full details (leaderboard, member summary) | 1m |
| `/api/stats/clans/:tag` | GET | Clan statistics | 10m |
| `/api/stats/family` | GET | Family-wide stats | 10m |
| `/api/images/badge/:tag/:size` | GET | Clan badge proxy | 10m |
| `/api/base-layouts` | GET | Public base layouts | - |

### Authentication Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/register` | POST | Register new user |
| `/api/auth/login` | POST | Login and get JWT token |
| `/api/auth/me` | GET | Get current user (requires auth) |
| `/api/auth/change-password` | POST | Change password (requires auth) |

### Admin Endpoints (Require Authentication)

| Endpoint | Method | Description | Access Level |
|----------|--------|-------------|--------------|
| `/api/admin/trinity-clans` | GET | List Trinity clans | Admin (read), Root (write) |
| `/api/admin/trinity-clans` | POST | Create Trinity clan | Root only |
| `/api/admin/trinity-clans/:tag` | PUT | Update Trinity clan | Root only |
| `/api/admin/trinity-clans/:tag` | DELETE | Delete Trinity clan | Root only |
| `/api/admin/cwl-clans` | GET | List CWL clans | Admin (read), Root (write) |
| `/api/admin/cwl-clans` | POST | Create CWL clan | Root only |
| `/api/admin/cwl-clans/:tag` | PUT | Update CWL clan | Root only |
| `/api/admin/cwl-clans/:tag` | DELETE | Delete CWL clan | Root only |
| `/api/admin/base-layouts` | GET | List base layouts | Admin |
| `/api/admin/base-layouts` | POST | Create base layout | Admin |
| `/api/admin/base-layouts/:level` | PUT | Update base layout | Admin |
| `/api/admin/base-layouts/:level` | DELETE | Delete base layout | Admin |
| `/api/auth/users` | GET | List all users | Root only |
| `/api/auth/users/:identifier` | PUT | Update user role | Root only |
| `/api/auth/users/:identifier` | DELETE | Delete user | Root only |

### Cache Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/cache/stats` | GET | Cache statistics |
| `/api/cache/flush` | DELETE | Clear all cache |

## 🔐 Authentication

### User Roles

- **root**: Full access to all features (hardcoded, cannot be deleted)
- **admin**: Can view clans and manage base layouts, cannot modify clans
- **user**: Basic user role (default for new registrations)

### Register New User

```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123",
  "username": "username"
}
```

### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123"
}
```

Response includes JWT token:
```json
{
  "message": "Login successful",
  "user": {
    "email": "user@example.com",
    "username": "username",
    "role": "user"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Using Authentication

Include token in Authorization header:
```http
GET /api/auth/me
Authorization: Bearer <token>
```

### Middleware

```javascript
import { authenticate, requireAdmin, requireRoot } from './middleware/auth.js'

// Require authentication
router.get('/protected', authenticate, handler)

// Require admin or root
router.get('/admin', authenticate, requireAdmin, handler)

// Require root only
router.get('/root', authenticate, requireRoot, handler)
```

## 🗄️ Database

### MongoDB Setup

The application uses MongoDB for persistent storage (optional - app works without it).

1. **Install MongoDB** or use MongoDB Atlas (cloud recommended)

2. **Configure in `.env`**
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/
MONGODB_DB_NAME=trinity
```

3. **Collections**
- `users` - User accounts
- `trinityClans` - Trinity clan data
- `cwlClans` - CWL clan data
- `baseLayouts` - Farming base layouts
- `clans` - Cached clan details
- `wars` - Cached war data
- `warLogs` - Cached war history
- `cwlGroups` - CWL group data with leaderboard and league states
- `cwlWars` - Individual CWL war details

### Database Features

- Automatic index creation
- Graceful fallback if database unavailable
- Persistent caching across server restarts
- User management and authentication

## 🔌 WebSocket

### Server-side (Already configured)

```javascript
// In index.js
io.on('connection', (socket) => {
  socket.on('subscribe:clan', (clanTag) => {
    socket.join(`clan:${clanTag}`)
  })
})
```

### Client-side Example

```javascript
import { io } from 'socket.io-client'

const socket = io('http://localhost:3001')

socket.on('connect', () => {
  console.log('Connected')
  socket.emit('subscribe:clan', '#2PP')
})
```

## 📈 Performance Metrics

### Benchmarks

| Metric | Before v2.0 | After v2.1 | Improvement |
|--------|-------------|------------|-------------|
| Initial Load | 3-5s | 1-2s | **60% faster** |
| CWL Page | 5-8s | 1-2s | **75% faster** |
| API Calls/Page | 10-20 | 1-3 | **85% reduction** |
| Cache Hit Rate | 0% | 70-90% | **New feature** |
| Client Bundle Size | Baseline | -200 lines | **Reduced** |
| CWL Calculations | Client-side | Server-side | **Faster rendering** |
| Member Summary Calc | ~200 lines (client) | Backend API | **Moved to backend** |

### Cache Statistics

Monitor cache performance:
```bash
curl http://localhost:3001/api/cache/stats
```

Response:
```json
{
  "stats": {
    "keys": 45,
    "hits": 1250,
    "misses": 180,
    "hitRate": "87.41%"
  }
}
```

## 🧪 Testing

### Health Check
```bash
curl http://localhost:3001/api/health
```

### Test Clan Fetch
```bash
curl http://localhost:3001/api/clans/2PP
```

### Test CWL Endpoints
```bash
# Get filtered CWL clans
curl http://localhost:3001/api/cwl/clans

# Get current CWL group (basic data)
curl http://localhost:3001/api/cwl/2JCYR2VUJ/current

# Get all CWL rounds with full details (leaderboard, member summary)
curl http://localhost:3001/api/cwl/2JCYR2VUJ/all

# Get individual war details
curl http://localhost:3001/api/cwl/war/8QVP0C2Q0

# Check CWL status
curl http://localhost:3001/api/cwl/clans/2JCYR2VUJ/status
```

### Test Cache Stats
```bash
curl http://localhost:3001/api/cache/stats
```

## 🐛 Troubleshooting

### Server Won't Start
- Check all required environment variables are set (PORT, FRONTEND_URL, etc.)
- Verify PORT is available
- Check MongoDB connection (if using)

### CORS Errors
- Verify `FRONTEND_URL` includes your frontend origin
- Check no hardcoded origins in code
- Ensure credentials are allowed

### Database Issues
- Verify `MONGODB_URI` and `MONGODB_DB_NAME` are set
- Check database connection string format
- Server will run in cache-only mode if DB unavailable

### Authentication Issues
- Verify `JWT_SECRET` is set
- Check token expiration settings
- Ensure root user credentials are correct

### Cache Issues

Clear cache:
```bash
curl -X DELETE http://localhost:3001/api/cache/flush
```

### CoC API Authentication

If you see authentication errors (403 Forbidden):
1. Verify `.env` credentials (`COC_EMAIL`, `COC_PASSWORD`)
2. Check CoC developer portal for session status
3. The backend automatically re-authenticates on 403 errors via `callWithReauth` helper
4. Restart server after updating credentials if auto-reauth fails
5. Check logs for re-authentication messages (`🔄 Got 403 Forbidden, attempting re-authentication...`)

### Memory Usage

Cache size grows with usage. Monitor with:
```bash
curl http://localhost:3001/api/cache/keys
```

### Rate Limiting (429 Errors)

If you encounter `requestThrottled` (429) errors from the Clash of Clans API:
1. The backend implements sequential processing with delays (200-300ms between requests) to prevent rate limiting
2. Badge fetching is optimized to reuse data from wars before making new API calls
3. Errors are handled gracefully - the backend will continue processing even if some requests are throttled
4. Check logs for rate limiting messages
5. If issues persist, consider increasing delays in the code or reducing concurrent requests

## 🔒 Security Features

- ✅ Environment variables for all configuration (no hardcoded defaults)
- ✅ CORS restricted to specific origins
- ✅ Security headers (Helmet.js)
- ✅ Error handling (no stack traces in production)
- ✅ JWT authentication
- ✅ Role-based access control
- ✅ Password hashing (bcrypt)
- ✅ Request size limits
- ✅ Structured logging

## 📝 Logging

Structured logging with different levels:

- **Error**: Always logged (production + development)
- **Warn**: Production (as errors), Development (as warnings)
- **Info/Log/Debug**: Development only

Example:
```
GET /api/clans/2PP - 200 - 145ms
✅ Cache HIT: clan:#2PP
```

## 🚀 Deployment

### Production Checklist

1. **Environment Variables**
   - Set all required environment variables
   - Use strong `JWT_SECRET`
   - Change `ROOT_PASSWORD` from default
   - Configure `FRONTEND_URL` with production domains

2. **Security**
   - CORS properly configured
   - Security headers via Helmet
   - Error handling doesn't expose stack traces
   - All secrets in environment variables

3. **MongoDB**
   - Use MongoDB Atlas for production
   - Configure connection string
   - Set up backups

### Render/Railway/Heroku

1. Provision a Node.js service (Node 18 recommended)
2. Build command: `npm install`
3. Start command: `npm start` (PORT provided by platform)
4. Set all required environment variables
5. Configure health checks to hit `/api/health`

### Custom Domains (Render example)

1. Go to **Settings → Custom Domains** for the service
2. Add `api.your-domain.com` and follow DNS instructions
3. Wait for TLS provisioning, then enable "Force HTTPS"
4. Append the new HTTPS origin to `FRONTEND_URL`

### Docker (Optional)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

## 📚 Resources

- [Clash of Clans API](https://developer.clashofclans.com/) - CoC API docs
- [clashofclans.js](https://github.com/clashperk/clashofclans.js) - CoC API wrapper
- [Socket.IO](https://socket.io/) - WebSocket documentation

## 🤝 Contributing

Contributions welcome! Please:
1. Follow existing code style
2. Add comments for complex logic
3. Test thoroughly
4. Update documentation

## 📄 License

MIT License

---

**Built with ❤️ for the Trinity Clan Family**

