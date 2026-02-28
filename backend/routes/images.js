import express from 'express'
import { getClanDetails } from '../services/clashOfClansService.js'

const router = express.Router()

// Proxy clan badge image
router.get('/badge/:clanTag/:size?', async (req, res) => {
  try {
    const { clanTag, size } = req.params
    const validSizes = ['small', 'medium', 'large']
    const imageSize = validSizes.includes(size) ? size : 'medium'

    const clan = await getClanDetails(clanTag)

    if (!clan.badgeUrls || !clan.badgeUrls[imageSize]) {
      return res.status(404).json({
        error: 'Badge not found',
        message: 'Clan badge URL not available'
      })
    }

    // Redirect to the actual badge URL
    // The CoC API already provides CDN URLs, so we just redirect
    res.redirect(clan.badgeUrls[imageSize])
  } catch (error) {
    console.error('Error fetching clan badge:', error)
    res.status(500).json({
      error: 'Failed to fetch badge',
      message: error.message
    })
  }
})

// Get badge URLs without redirect
router.get('/badge/:clanTag', async (req, res) => {
  try {
    const { clanTag } = req.params
    const clan = await getClanDetails(clanTag)

    if (!clan.badgeUrls) {
      return res.status(404).json({
        error: 'Badge not found',
        message: 'Clan badge URLs not available'
      })
    }

    res.json({
      clanTag: clan.tag,
      clanName: clan.name,
      badgeUrls: clan.badgeUrls
    })
  } catch (error) {
    console.error('Error fetching clan badge URLs:', error)
    res.status(500).json({
      error: 'Failed to fetch badge URLs',
      message: error.message
    })
  }
})

export default router

