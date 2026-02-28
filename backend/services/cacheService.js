import NodeCache from 'node-cache'
import { databaseService, isDatabaseConnected } from './databaseService.js'
import logger from '../utils/logger.js'

// Initialize cache with default settings
const cache = new NodeCache({
  stdTTL: 120,           // Default TTL: 2 minutes
  checkperiod: 120,      // Check for expired keys every 2 minutes
  useClones: false       // Better performance (don't clone objects)
})

// Map cache keys to database collections
// Note: 'war:', 'warlog:', and 'stats:' keys are memory-only (not stored in database)
const CACHE_TO_COLLECTION = {
  'clan:': 'clans',
  'cwlgroup:': 'cwlGroups',
  'cwlwar:': 'cwlWars'
}

// Helper to determine collection from cache key (optimized with early returns)
const getCollectionFromKey = (key) => {
  // Optimized: check most common prefixes first
  if (key.startsWith('clan:')) return 'clans'
  if (key.startsWith('cwlgroup:')) return 'cwlGroups'
  if (key.startsWith('cwlwar:')) return 'cwlWars'
  return 'cache' // Default collection
}

// Helper to extract identifier from cache key
// Note: 'war:', 'warlog:', and 'stats:' keys are memory-only, no database storage needed
const getIdentifierFromKey = (key) => {
  // Extract tag or identifier from key (e.g., "clan:#2PP" -> { tag: "#2PP" })
  if (key.startsWith('clan:')) {
    return { tag: key.slice(5) } // More efficient than replace
  }
  if (key.startsWith('cwlgroup:')) {
    return { clanTag: key.slice(9) }
  }
  if (key.startsWith('cwlwar:')) {
    return { warTag: key.slice(7) }
  }
  return { key }
}

/**
 * Cache service for storing API responses
 */
export const cacheService = {
  /**
   * Get value from cache (sync - memory only for backward compatibility)
   * @param {string} key - Cache key
   * @returns {any} Cached value or undefined
   */
  get: (key) => {
    return cache.get(key)
  },

  /**
   * Get value from cache with database fallback (async)
   * @param {string} key - Cache key
   * @returns {Promise<any>} Cached value or undefined
   */
  getAsync: async (key) => {
    // First check memory cache (fastest)
    const memoryCache = cache.get(key)
    if (memoryCache) {
      logger.debug(`[CACHE HIT] Memory cache: ${key}`)
      return memoryCache
    }

    // Skip database lookup for regular wars, warLogs, and statistics (memory-only)
    if (key.startsWith('war:') || key.startsWith('warlog:') || key.startsWith('stats:')) {
      return undefined
    }

    // If not in memory, check database
    if (isDatabaseConnected()) {
      try {
        const collection = getCollectionFromKey(key)
        const query = getIdentifierFromKey(key)
        
        const dbDoc = await databaseService.findOne(collection, query)
        if (dbDoc) {
          // Remove MongoDB _id and metadata, return data
          const { _id, createdAt, updatedAt, expiresAt, cacheKey, ...data } = dbDoc
          
          // Check if data is still fresh based on TTL or expiresAt
          let isFresh = true
          if (expiresAt) {
            isFresh = new Date(expiresAt) > new Date()
          } else {
            const ttl = CACHE_TTL[collection.toUpperCase().replace('S', '')] || 120
            const age = (Date.now() - new Date(updatedAt).getTime()) / 1000
            isFresh = age < ttl
          }
          
          if (isFresh) {
            // Restore to memory cache for faster access
            const remainingTtl = expiresAt 
              ? Math.max(0, (new Date(expiresAt).getTime() - Date.now()) / 1000)
              : 120
            cache.set(key, data, remainingTtl)
            return data
          } else {
            // Data expired, remove from DB
            await databaseService.delete(collection, query)
          }
        }
      } catch (error) {
        logger.error(`[DB ERROR] Database get error for key ${key}:`, error.message)
        // Fall through to return undefined
      }
    }

    return undefined
  },

  /**
   * Set value in cache (sync - memory only for backward compatibility)
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in seconds (optional)
   * @returns {boolean} Success status
   */
  set: (key, value, ttl) => {
    return cache.set(key, value, ttl)
  },

  /**
   * Set value in cache with database persistence (async)
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in seconds (optional)
   * @returns {Promise<boolean>} Success status
   */
  setAsync: async (key, value, ttl) => {
    // Always set in memory cache (fast access)
    const memoryResult = cache.set(key, value, ttl)

    // Skip database storage for regular wars, warLogs, and statistics (memory-only)
    if (key.startsWith('war:') || key.startsWith('warlog:') || key.startsWith('stats:')) {
      return memoryResult
    }

    // Also persist to database if connected (non-blocking)
    if (isDatabaseConnected()) {
      // Don't await - let it run in background
      setImmediate(async () => {
        try {
          const collection = getCollectionFromKey(key)
          const query = getIdentifierFromKey(key)
          
          // Store with metadata
          const doc = {
            ...query,
            ...value,
            cacheKey: key,
            expiresAt: ttl ? new Date(Date.now() + ttl * 1000) : null
          }

          await databaseService.upsert(collection, query, doc)
        } catch (error) {
          logger.error(`[DB ERROR] Database set error for key ${key}:`, error.message)
          // Continue even if DB write fails - memory cache still works
        }
      })
    }

    return memoryResult
  },

  /**
   * Delete specific key from cache
   * @param {string} key - Cache key
   * @returns {number} Number of deleted entries
   */
  del: (key) => {
    return cache.del(key)
  },

  /**
   * Delete all keys matching a pattern
   * @param {string} pattern - Pattern to match (e.g., "clan:*")
   * @returns {number} Number of deleted entries
   */
  delPattern: (pattern) => {
    const keys = cache.keys()
    const regex = new RegExp(pattern.replace('*', '.*'))
    const matchingKeys = keys.filter(key => regex.test(key))
    
    if (matchingKeys.length > 0) {
      cache.del(matchingKeys)
    }
    
    return matchingKeys.length
  },

  /**
   * Clear all cache
   */
  flush: () => {
    cache.flushAll()
  },

  /**
   * Get cache statistics
   * @returns {object} Cache stats
   */
  getStats: () => {
    const stats = cache.getStats()
    return {
      keys: stats.keys,
      hits: stats.hits,
      misses: stats.misses,
      ksize: stats.ksize,
      vsize: stats.vsize,
      hitRate: stats.hits > 0 ? ((stats.hits / (stats.hits + stats.misses)) * 100).toFixed(2) + '%' : '0%'
    }
  },

  /**
   * Check if key exists in cache
   * @param {string} key - Cache key
   * @returns {boolean} True if key exists
   */
  has: (key) => {
    return cache.has(key)
  },

  /**
   * Get all cache keys
   * @returns {string[]} Array of cache keys
   */
  keys: () => {
    return cache.keys()
  }
}

// Cache TTL constants (in seconds)
export const CACHE_TTL = {
  CLAN_BASIC: 120,        // 2 minutes - Basic clan info
  CLAN_WAR: 120,          // 2 minutes - Current war (changes during war)
  CLAN_WAR_LOG: 120,     // 2 minutes - Historical war log
  STATS: 120,             // 2 minutes - Aggregated stats
  CWL_FILTERED: 120,      // 2 minutes - Filtered CWL clans
}

export default cacheService

