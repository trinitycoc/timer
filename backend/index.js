import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import helmet from 'helmet'
import { createServer } from 'http'
import { Server } from 'socket.io'

// Import routes
import clansRouter from './routes/clans.js'
import authRouter from './routes/auth.js'
import adminRouter from './routes/admin.js'
import gflClansRouter from './routes/gflClans.js'

// Import services
import { cacheService } from './services/cacheService.js'
import { startCacheWarmup } from './services/cacheWarmup.js'
import { syncGFLClansFromSheet } from './services/gflSheetSyncService.js'
import { syncFollowingClansFromSheet } from './services/followingSheetSyncService.js'
import { getSyncAt, advanceSyncAtToNextDay } from './services/settingsService.js'
import { runWarStatusCheckTick, getClansToCheckWithVary, getWarCheckWindow } from './services/warStatusCheckService.js'
import { connectDatabase, isDatabaseConnected } from './services/databaseService.js'
import { initializeRootUser } from './services/authService.js'
import logger from './utils/logger.js'

// Load environment variables
dotenv.config()

const app = express()
const httpServer = createServer(app)

// Get PORT from environment variable (required)
const PORT = process.env.PORT
if (!PORT) {
  console.error('PORT environment variable is required')
  process.exit(1)
}

// Get allowed origins from environment variable (required)
// Support comma-separated list of origins
const getAllowedOrigins = () => {
  const frontendUrl = process.env.FRONTEND_URL
  if (!frontendUrl) {
    console.error('FRONTEND_URL environment variable is required')
    process.exit(1)
  }
  // Split by comma, trim whitespace, and remove trailing slashes
  // Browsers send origins without trailing slashes, so we normalize them
  return frontendUrl.split(',').map(url => url.trim().replace(/\/+$/, '')).filter(url => url)
}

const allowedOrigins = getAllowedOrigins()

// Initialize Socket.IO for real-time updates
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
    methods: ['GET', 'POST'],
    credentials: true
  }
})

// Security middleware - Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow embedding for images
}))

// CORS configuration - restrict to specific origins
app.use(cors({
  origin: (origin, callback) => {
    // If no allowed origins configured, reject all
    if (allowedOrigins.length === 0) {
      return callback(new Error('Not allowed by CORS'))
    }
    
    // Allow requests with no origin (PWA, Postman, etc.)
    // PWAs and some tools send requests with no origin
    // This is safe because we also validate requests with authentication
    if (!origin) {
      // Always allow no-origin requests for PWA compatibility
      // PWAs need this to work in both development and production
      return callback(null, true)
    }
    
    // Normalize origin by removing trailing slashes for comparison
    const normalizedOrigin = origin.replace(/\/+$/, '')
    
    // Allow if origin is in allowed list
    if (allowedOrigins.includes(normalizedOrigin)) {
      callback(null, true)
    } else {
      // Log blocked origin for debugging (in development)
      if (process.env.NODE_ENV === 'development') {
        console.warn(`⚠️ CORS blocked origin: ${origin}`)
        console.warn(`   Allowed origins: ${allowedOrigins.join(', ')}`)
      }
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))

// Body parsing middleware with size limit
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Request logging middleware (only in development)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    const start = Date.now()
    res.on('finish', () => {
      const duration = Date.now() - start
      logger.info(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`)
    })
    next()
  })
}

// Routes
app.use('/api/clans', clansRouter)
app.use('/api/auth', authRouter)
app.use('/api/admin', adminRouter)
app.use('/api/gfl-clans', gflClansRouter)
// Health check endpoint
app.get('/api/health', async (req, res) => {
  const cacheStats = cacheService.getStats()
  const dbConnected = isDatabaseConnected()
  
  res.json({ 
    status: 'ok', 
    message: 'Server is running',
    cache: cacheStats,
    database: {
      connected: dbConnected,
      status: dbConnected ? 'operational' : 'disconnected'
    },
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  })
})

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'GFL Backend API',
    version: '2.0.0',
      endpoints: {
      health: '/api/health',
      clans: '/api/clans',
      auth: '/api/auth',
      admin: '/api/admin',
      gflClans: '/api/gfl-clans',
    }
  })
})

// WebSocket connection handling
io.on('connection', (socket) => {

  socket.on('subscribe:clan', (clanTag) => {
    socket.join(`clan:${clanTag}`)
  })

  socket.on('unsubscribe:clan', (clanTag) => {
    socket.leave(`clan:${clanTag}`)
  })

  socket.on('disconnect', () => {
  })
})

// Export io for use in other modules if needed
export { io }

// Error handling middleware
app.use((err, req, res, next) => {
  // Log full error details (for debugging)
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  })
  
  // In production, don't expose stack traces or detailed error messages
  const isProduction = process.env.NODE_ENV === 'production'
  
  // Handle CORS errors specifically
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'CORS policy violation'
    })
  }
  
  // Default error response
  res.status(err.status || 500).json({ 
    error: 'Something went wrong!', 
    message: isProduction ? 'An error occurred while processing your request' : err.message
  })
})

// Start server
httpServer.listen(PORT, async () => {
  // Connect to database (non-blocking - app works without DB)
  await connectDatabase()
  
  // Initialize root user if database is connected
  if (isDatabaseConnected()) {
    await initializeRootUser()
  }
  
  if (process.env.NODE_ENV !== 'production') {
    logger.info('🚀 GFL Backend Server Started')
    logger.info(`📍 Server running on port ${PORT}`)
    logger.info(`🔌 WebSocket available`)
    logger.info(`💾 Cache system initialized`)
    if (isDatabaseConnected()) {
      logger.info(`🗄️  Database connected`)
    } else {
      logger.warn(`⚠️  Database not connected - running in cache-only mode`)
    }
    logger.info('✅ Ready to accept connections')
    logger.info(`🔒 CORS allowed origins: ${allowedOrigins.join(', ')}`)
  } else {
    logger.info(`Server started on port ${PORT}`)
  }
  startCacheWarmup()

  // Sheet sync (GFL + following): run once after delay, then every hour. Also on admin force resync.
  const runAllSheetSyncs = async () => {
    try {
      await syncGFLClansFromSheet()
      await syncFollowingClansFromSheet()
    } catch (err) {
      logger.error('Sheet sync error:', err.message)
    }
  }
  const ONE_HOUR_MS = 60 * 60 * 1000

  /** True if now is inside the war status check window (skip sheet sync during this time). */
  const isInsideWarCheckWindow = async () => {
    const syncAt = await getSyncAt()
    if (!syncAt) return false
    let clansWithVary
    try {
      clansWithVary = await getClansToCheckWithVary()
    } catch {
      return false
    }
    const { minVary, maxVary } = clansWithVary
    const { windowStart, windowEnd } = getWarCheckWindow(syncAt, minVary, maxVary)
    const now = new Date()
    return now >= windowStart && now <= windowEnd
  }

  const runAllSheetSyncsUnlessInWarWindow = async () => {
    if (await isInsideWarCheckWindow()) {
      logger.info('Sheet sync skipped: inside war status check window')
      return
    }
    await runAllSheetSyncs()
  }

  setTimeout(runAllSheetSyncsUnlessInWarWindow, 10 * 1000)
  setInterval(runAllSheetSyncsUnlessInWarWindow, ONE_HOUR_MS)

  const warCheckRecordedThisCycle = new Set()
  let warCheckCycleSyncAt = null
  let warCheckWindowStartLogged = false

  setInterval(async () => {
    try {
      const syncAt = await getSyncAt()
      if (!syncAt) return
      const now = new Date()

      let clansWithVary
      try {
        clansWithVary = await getClansToCheckWithVary()
      } catch {
        clansWithVary = { clans: [], minVary: 0, maxVary: 0 }
      }
      const { minVary, maxVary } = clansWithVary
      const { windowStart, windowEnd } = getWarCheckWindow(syncAt, minVary, maxVary)

      if (now > windowEnd) {
        if (warCheckCycleSyncAt && warCheckCycleSyncAt.getTime() === syncAt.getTime()) {
          await advanceSyncAtToNextDay()
          warCheckRecordedThisCycle.clear()
          warCheckCycleSyncAt = null
          warCheckWindowStartLogged = false
          logger.info('War status check window ended, advanced to next day')
        }
        return
      }

      if (now >= windowStart && !warCheckWindowStartLogged) {
        logger.info(`War status check window started at ${windowStart.toISOString()} (syncTime: ${syncAt.toISOString()}, minVary: ${minVary}min)`)
        warCheckWindowStartLogged = true
      }
      if (!warCheckCycleSyncAt) warCheckCycleSyncAt = syncAt
      await runWarStatusCheckTick(syncAt, now, warCheckRecordedThisCycle, clansWithVary)
    } catch (err) {
      logger.error('War status check scheduler error:', err.message)
    }
  }, 60 * 1000)
})

