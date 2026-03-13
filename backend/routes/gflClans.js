import express from 'express'
import { getActiveGFLClanTags, getGFLClans } from '../services/clanManagementService.js'

const router = express.Router()

/**
 * GET /api/gfl-clans
 * Get active GFL clan tags (public endpoint)
 */
router.get('/', async (req, res) => {
  try {
    const { status } = req.query
    if (status) {
      // If status filter is provided, return full clan objects
      const clans = await getGFLClans({ status })
      const clanTags = clans.map(clan => clan.tag)
      res.json({
        count: clanTags.length,
        clanTags
      })
    } else {
      // By default, return only active clans (tags only)
      const clanTags = await getActiveGFLClanTags()
      res.json({
        count: clanTags.length,
        clanTags
      })
    }
  } catch (error) {
    console.error('Error fetching GFL clans:', error)
    res.status(500).json({
      error: 'Failed to fetch GFL clans',
      message: error.message
    })
  }
})

export default router
