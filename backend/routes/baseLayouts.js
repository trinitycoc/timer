import express from 'express'
import { getBaseLayouts } from '../services/clanManagementService.js'

const router = express.Router()

/**
 * GET /api/base-layouts
 * Get all base layouts (public endpoint)
 */
router.get('/', async (req, res) => {
  try {
    const layouts = await getBaseLayouts()
    res.json({
      count: layouts.length,
      layouts
    })
  } catch (error) {
    console.error('Error fetching base layouts:', error)
    res.status(500).json({
      error: 'Failed to fetch base layouts',
      message: error.message
    })
  }
})

export default router

