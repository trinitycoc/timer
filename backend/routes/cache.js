import express from 'express'
import { cacheService } from '../services/cacheService.js'

const router = express.Router()

// Get cache statistics
router.get('/stats', (req, res) => {
  try {
    const stats = cacheService.getStats()
    res.json({
      success: true,
      stats
    })
  } catch (error) {
    console.error('Error fetching cache stats:', error)
    res.status(500).json({
      error: 'Failed to fetch cache stats',
      message: error.message
    })
  }
})

// Get all cache keys
router.get('/keys', (req, res) => {
  try {
    const keys = cacheService.keys()
    res.json({
      success: true,
      count: keys.length,
      keys
    })
  } catch (error) {
    console.error('Error fetching cache keys:', error)
    res.status(500).json({
      error: 'Failed to fetch cache keys',
      message: error.message
    })
  }
})

// Clear specific cache key
router.delete('/keys/:key', (req, res) => {
  try {
    const { key } = req.params
    const decodedKey = decodeURIComponent(key)
    const deleted = cacheService.del(decodedKey)
    
    res.json({
      success: true,
      deleted: deleted > 0,
      key: decodedKey
    })
  } catch (error) {
    console.error('Error deleting cache key:', error)
    res.status(500).json({
      error: 'Failed to delete cache key',
      message: error.message
    })
  }
})

// Clear cache by pattern
router.delete('/pattern/:pattern', (req, res) => {
  try {
    const { pattern } = req.params
    const decodedPattern = decodeURIComponent(pattern)
    const deleted = cacheService.delPattern(decodedPattern)
    
    res.json({
      success: true,
      deletedCount: deleted,
      pattern: decodedPattern
    })
  } catch (error) {
    console.error('Error deleting cache pattern:', error)
    res.status(500).json({
      error: 'Failed to delete cache pattern',
      message: error.message
    })
  }
})

// Clear all cache
router.delete('/flush', (req, res) => {
  try {
    cacheService.flush()
    res.json({
      success: true,
      message: 'Cache flushed successfully'
    })
  } catch (error) {
    console.error('Error flushing cache:', error)
    res.status(500).json({
      error: 'Failed to flush cache',
      message: error.message
    })
  }
})

export default router

