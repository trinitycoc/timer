import express from 'express'
import {
  getClanStats,
  getTrinityFamilyStats,
  getClanTHDistribution
} from '../services/statsService.js'

const router = express.Router()

// Get aggregated stats for a specific clan
router.get('/clans/:clanTag', async (req, res) => {
  try {
    const { clanTag } = req.params
    const stats = await getClanStats(clanTag)
    res.json(stats)
  } catch (error) {
    console.error('Error fetching clan stats:', error)
    res.status(500).json({
      error: 'Failed to fetch clan stats',
      message: error.message
    })
  }
})

// Get TH distribution for a specific clan
router.get('/clans/:clanTag/th-distribution', async (req, res) => {
  try {
    const { clanTag } = req.params
    const distribution = await getClanTHDistribution(clanTag)
    res.json(distribution)
  } catch (error) {
    console.error('Error fetching TH distribution:', error)
    res.status(500).json({
      error: 'Failed to fetch TH distribution',
      message: error.message
    })
  }
})

// Get Trinity family-wide statistics
router.get('/family', async (req, res) => {
  try {
    const stats = await getTrinityFamilyStats()
    res.json(stats)
  } catch (error) {
    console.error('Error fetching Trinity family stats:', error)
    res.status(500).json({
      error: 'Failed to fetch family stats',
      message: error.message
    })
  }
})

export default router

