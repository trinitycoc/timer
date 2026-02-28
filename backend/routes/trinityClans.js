import express from 'express'
import { getActiveTrinityClanTags, getTrinityClans } from '../services/clanManagementService.js'

const router = express.Router()

/**
 * GET /api/trinity-clans
 * Get active Trinity clan tags (public endpoint)
 */
router.get('/', async (req, res) => {
  try {
    const { status } = req.query
    if (status) {
      // If status filter is provided, return full clan objects
      const clans = await getTrinityClans({ status })
      const clanTags = clans.map(clan => clan.tag)
      res.json({
        count: clanTags.length,
        clanTags
      })
    } else {
      // By default, return only active clans (tags only)
      const clanTags = await getActiveTrinityClanTags()
      res.json({
        count: clanTags.length,
        clanTags
      })
    }
  } catch (error) {
    console.error('Error fetching Trinity clans:', error)
    res.status(500).json({
      error: 'Failed to fetch Trinity clans',
      message: error.message
    })
  }
})

export default router

