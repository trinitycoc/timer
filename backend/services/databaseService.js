import { MongoClient } from 'mongodb'

let client = null
let db = null
let isConnected = false

/**
 * Initialize MongoDB connection
 */
export const connectDatabase = async () => {
  if (isConnected && db) {
    return db
  }

  const mongoUri = process.env.MONGODB_URI
  const dbName = process.env.MONGODB_DB_NAME
  
  if (!mongoUri) {
    // Database is optional - app can run without it
    return null
  }
  
  if (!dbName) {
    console.error('MONGODB_DB_NAME environment variable is required when MONGODB_URI is set')
    return null
  }

  try {
    client = new MongoClient(mongoUri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    })

    await client.connect()
    db = client.db(dbName)
    isConnected = true

    // Create indexes for better performance
    await createIndexes(db)

    console.log('✅ Connected to MongoDB')
    return db
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message)
    // Don't throw - allow app to run without DB (fallback to cache only)
    isConnected = false
    return null
  }
}

/**
 * Create database indexes for optimal query performance
 */
const createIndexes = async (database) => {
  try {
    // Note: Clan details from CoC API are memory-only cache (not stored in DB)
    // Only gflClans and users are persisted

    // Users collection (for authentication)
    await database.collection('users').createIndex({ email: 1 }, { unique: true })
    await database.collection('users').createIndex({ username: 1 }, { unique: true })
    await database.collection('users').createIndex({ role: 1 })
    await database.collection('users').createIndex({ createdAt: 1 })

    // GFL clans collection
    await database.collection('gflClans').createIndex({ tag: 1 }, { unique: true })
    await database.collection('gflClans').createIndex({ status: 1 })
    await database.collection('gflClans').createIndex({ createdAt: 1 })

    // Clan war state: when we last observed "notInWar" per clan (for war start/end tracking)
    await database.collection('clanWarState').createIndex({ clanTag: 1 }, { unique: true })
    await database.collection('clanWarState').createIndex({ lastNotInWarAt: 1 })

    // Following clans (from sheet: tag D, name E, status G; no vary)
    await database.collection('followingClans').createIndex({ tag: 1 }, { unique: true })
    await database.collection('followingClans').createIndex({ status: 1 })
    await database.collection('followingClans').createIndex({ createdAt: 1 })

    // appSettings uses _id as document key (e.g. 'sync', 'trackClans'); MongoDB's default _id index is sufficient

    console.log('✅ Database indexes created')
  } catch (error) {
    console.warn('⚠️ Index creation warning:', error.message)
  }
}

/**
 * Get database instance
 */
export const getDatabase = () => {
  return db
}

/**
 * Check if database is connected
 */
export const isDatabaseConnected = () => {
  return isConnected && db !== null
}

/**
 * Close database connection
 */
export const closeDatabase = async () => {
  if (client) {
    await client.close()
    isConnected = false
    db = null
    client = null
    console.log('✅ MongoDB connection closed')
  }
}

/**
 * Database service for CRUD operations
 */
export const databaseService = {
  /**
   * Get document from collection
   */
  async findOne(collection, query, options = {}) {
    if (!isDatabaseConnected()) return null
    
    try {
      return await db.collection(collection).findOne(query, options)
    } catch (error) {
      console.error(`Database findOne error (${collection}):`, error.message)
      return null
    }
  },

  /**
   * Find multiple documents
   */
  async find(collection, query = {}, options = {}) {
    if (!isDatabaseConnected()) return []
    
    try {
      const cursor = db.collection(collection).find(query, options)
      return await cursor.toArray()
    } catch (error) {
      console.error(`Database find error (${collection}):`, error.message)
      return []
    }
  },

  /**
   * Insert or update document (upsert)
   * Handles race conditions by retrying on duplicate key errors
   */
  async upsert(collection, query, data, options = {}) {
    if (!isDatabaseConnected()) return false
    
    try {
      const updateData = {
        ...data,
        updatedAt: new Date()
      }

      const result = await db.collection(collection).updateOne(
        query,
        { $set: updateData },
        { upsert: true, ...options }
      )
      
      return result.acknowledged
    } catch (error) {
      // Handle duplicate key error (E11000) - can happen in race conditions
      // Retry as a regular update instead of upsert
      if (error.code === 11000 || error.message.includes('duplicate key')) {
        try {
          const updateData = {
            ...data,
            updatedAt: new Date()
          }
          const result = await db.collection(collection).updateOne(
            query,
            { $set: updateData },
            options
          )
          return result.acknowledged
        } catch (retryError) {
          console.error(`Database upsert retry error (${collection}):`, retryError.message)
          return false
        }
      }
      console.error(`Database upsert error (${collection}):`, error.message)
      return false
    }
  },

  /**
   * Insert document
   */
  async insert(collection, data) {
    if (!isDatabaseConnected()) return false
    
    try {
      const insertData = {
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const result = await db.collection(collection).insertOne(insertData)
      return result.acknowledged
    } catch (error) {
      console.error(`Database insert error (${collection}):`, error.message)
      return false
    }
  },

  /**
   * Update document
   */
  async update(collection, query, updateData, options = {}) {
    if (!isDatabaseConnected()) return false
    
    try {
      const data = {
        $set: {
          ...updateData,
          updatedAt: new Date()
        }
      }

      const result = await db.collection(collection).updateOne(query, data, options)
      return result.acknowledged
    } catch (error) {
      console.error(`Database update error (${collection}):`, error.message)
      return false
    }
  },

  /**
   * Delete document
   */
  async delete(collection, query) {
    if (!isDatabaseConnected()) return false
    
    try {
      const result = await db.collection(collection).deleteOne(query)
      return result.deletedCount > 0
    } catch (error) {
      console.error(`Database delete error (${collection}):`, error.message)
      return false
    }
  },

  /**
   * Delete multiple documents
   */
  async deleteMany(collection, query) {
    if (!isDatabaseConnected()) return 0
    
    try {
      const result = await db.collection(collection).deleteMany(query)
      return result.deletedCount
    } catch (error) {
      console.error(`Database deleteMany error (${collection}):`, error.message)
      return 0
    }
  },

  /**
   * Count documents
   */
  async count(collection, query = {}) {
    if (!isDatabaseConnected()) return 0
    
    try {
      return await db.collection(collection).countDocuments(query)
    } catch (error) {
      console.error(`Database count error (${collection}):`, error.message)
      return 0
    }
  }
}

export default databaseService

