import express from 'express'
import { getActiveCWLClanDetails, getActiveCWLClanTags } from '../services/clanManagementService.js'

const router = express.Router()

/**
 * GET /api/cwl-clans
 * Get active CWL clan tags (public endpoint)
 */
router.get('/', async (req, res) => {
  try {
    const clanTags = await getActiveCWLClanTags()
    res.json({
      count: clanTags.length,
      clanTags
    })
  } catch (error) {
    console.error('Error fetching CWL clans:', error)
    res.status(500).json({
      error: 'Failed to fetch CWL clans',
      message: error.message
    })
  }
})

/**
 * GET /api/cwl-clans/details
 * Get active CWL clan details with all metadata (public endpoint)
 */
router.get('/details', async (req, res) => {
  try {
    const clans = await getActiveCWLClanDetails()
    res.json({
      count: clans.length,
      clans
    })
  } catch (error) {
    console.error('Error fetching CWL clan details:', error)
    res.status(500).json({
      error: 'Failed to fetch CWL clan details',
      message: error.message
    })
  }
})

export default router

