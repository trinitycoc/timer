import express from 'express'
import {
  getClanDetails,
  getMultipleClans,
  getCurrentWar,
  getWarLog
} from '../services/clashOfClansService.js'
import { getActiveGFLClanTags, getActiveFollowingClanTags } from '../services/clanManagementService.js'
import { calculateTHComposition } from '../services/clanUtils.js'
import { recordNotInWarObserved, getLastNotInWarTimestamps } from '../services/warStateService.js'

const router = express.Router()

/**
 * GET /api/clans/gfl-family
 * Returns full clan data for all active GFL clans in one response (avoids frontend round-trip: tags + multiple)
 */
router.get('/gfl-family', async (req, res) => {
  try {
    const tags = await getActiveGFLClanTags()
    if (!tags || tags.length === 0) {
      return res.json([])
    }
    const clans = await getMultipleClans(tags)
    const withTH = Array.isArray(clans) ? clans.map((clan) => {
      if (!clan.thComposition && clan.memberList) {
        clan.thComposition = calculateTHComposition(clan.memberList)
      }
      return clan
    }) : []
    // Fetch current war for each clan in parallel (for list/card war status)
    const warPromises = withTH.map((clan) =>
      getCurrentWar(clan.tag).catch(() => null)
    )
    const wars = await Promise.all(warPromises)

    // When we see notInWar, record the timestamp so we can track when each clan's war ended
    const clanTags = withTH.map((c) => c.tag)
    await Promise.all(
      wars.map((war, i) => {
        if (war?.state === 'notInWar' && clanTags[i]) {
          return recordNotInWarObserved(clanTags[i])
        }
        return Promise.resolve()
      })
    )

    const lastNotInWarMap = await getLastNotInWarTimestamps(clanTags)

    const withWar = withTH.map((clan, i) => {
      const currentWar = wars[i] || null
      const lastNotInWarAt = lastNotInWarMap.get(clan.tag?.startsWith('#') ? clan.tag : `#${clan.tag}`) || null
      return {
        ...clan,
        currentWar,
        lastNotInWarAt: lastNotInWarAt ? lastNotInWarAt.toISOString() : null
      }
    })
    res.json(withWar)
  } catch (error) {
    console.error('Error fetching GFL family clans:', error)
    res.status(500).json({
      error: 'Failed to fetch GFL family clans',
      message: error.message
    })
  }
})

/**
 * GET /api/clans/following-family
 * Returns full clan data for all active following clans (same shape as gfl-family).
 */
router.get('/following-family', async (req, res) => {
  try {
    const tags = await getActiveFollowingClanTags()
    if (!tags || tags.length === 0) {
      return res.json([])
    }
    const clans = await getMultipleClans(tags)
    const withTH = Array.isArray(clans) ? clans.map((clan) => {
      if (!clan.thComposition && clan.memberList) {
        clan.thComposition = calculateTHComposition(clan.memberList)
      }
      return clan
    }) : []
    const warPromises = withTH.map((clan) =>
      getCurrentWar(clan.tag).catch(() => null)
    )
    const wars = await Promise.all(warPromises)
    const clanTags = withTH.map((c) => c.tag)
    await Promise.all(
      wars.map((war, i) => {
        if (war?.state === 'notInWar' && clanTags[i]) {
          return recordNotInWarObserved(clanTags[i])
        }
        return Promise.resolve()
      })
    )
    const lastNotInWarMap = await getLastNotInWarTimestamps(clanTags)
    const withWar = withTH.map((clan, i) => {
      const currentWar = wars[i] || null
      const lastNotInWarAt = lastNotInWarMap.get(clan.tag?.startsWith('#') ? clan.tag : `#${clan.tag}`) || null
      return {
        ...clan,
        currentWar,
        lastNotInWarAt: lastNotInWarAt ? lastNotInWarAt.toISOString() : null
      }
    })
    res.json(withWar)
  } catch (error) {
    console.error('Error fetching following family clans:', error)
    res.status(500).json({
      error: 'Failed to fetch following clans',
      message: error.message
    })
  }
})

/**
 * GET /api/clans/:clanTag/full
 * Returns clan + currentWar + warLog in one response (avoids 3 separate frontend requests)
 */
router.get('/:clanTag/full', async (req, res) => {
  try {
    const { clanTag } = req.params
    const [clan, currentWar, warLog] = await Promise.all([
      getClanDetails(clanTag),
      getCurrentWar(clanTag).catch(() => null),
      getWarLog(clanTag).catch(() => [])
    ])
    if (!clan.thComposition && clan.memberList) {
      clan.thComposition = calculateTHComposition(clan.memberList)
    }
    res.json({
      clan,
      currentWar: currentWar || null,
      warLog: Array.isArray(warLog) ? warLog : []
    })
  } catch (error) {
    console.error('Error fetching clan full details:', error)
    res.status(500).json({
      error: 'Failed to fetch clan details',
      message: error.message
    })
  }
})

// Get a single clan by tag
router.get('/:clanTag', async (req, res) => {
  try {
    const { clanTag } = req.params
    const clan = await getClanDetails(clanTag)
    
    // Ensure thComposition exists (fallback for old cached data without it)
    if (!clan.thComposition && clan.memberList) {
      clan.thComposition = calculateTHComposition(clan.memberList)
    }
    
    res.json(clan)
  } catch (error) {
    console.error('Error fetching clan:', error)
    res.status(500).json({ 
      error: 'Failed to fetch clan data', 
      message: error.message 
    })
  }
})

// Get multiple clans by tags (sent as query params)
router.post('/multiple', async (req, res) => {
  try {
    const { clanTags } = req.body
    
    if (!clanTags || !Array.isArray(clanTags)) {
      return res.status(400).json({ 
        error: 'Invalid request', 
        message: 'clanTags array is required' 
      })
    }

    const clans = await getMultipleClans(clanTags)
    res.json(clans)
  } catch (error) {
    console.error('Error fetching multiple clans:', error)
    res.status(500).json({ 
      error: 'Failed to fetch clans data', 
      message: error.message 
    })
  }
})

// Get current war for a clan
router.get('/:clanTag/war', async (req, res) => {
  try {
    const { clanTag } = req.params
    const war = await getCurrentWar(clanTag)
    res.json(war)
  } catch (error) {
    console.error('Error fetching war data:', error)
    res.status(500).json({ 
      error: 'Failed to fetch war data', 
      message: error.message 
    })
  }
})

// Get war log for a clan
router.get('/:clanTag/warlog', async (req, res) => {
  try {
    const { clanTag } = req.params
    const warLog = await getWarLog(clanTag)
    res.json(warLog)
  } catch (error) {
    console.error('Error fetching war log:', error)
    res.status(500).json({ 
      error: 'Failed to fetch war log', 
      message: error.message 
    })
  }
})

export default router

