import express from 'express'
import logger from '../utils/logger.js'
import {
  getCWLClansFiltered,
  getAllCWLClansMerged,
  getClanEligibleMembers,
  checkCWLStatus,
  calculateCWLLeaderboard,
  calculateRoundStats,
  calculateTHComposition,
  calculateMemberSummary,
  getPromotionDemotionSlots,
  isCWLDisplayPeriod,
  getCurrentMonthNameIST
} from '../services/cwlService.js'
import { getCWLGroup, getCurrentCWLWars, getAllCWLWars, getCWLWarByTag, initializeCoCClient, getClanDetails, forceReauthenticate } from '../services/clashOfClansService.js'
import { cacheService, CACHE_TTL } from '../services/cacheService.js'
import { databaseService, isDatabaseConnected } from '../services/databaseService.js'
import { normalizeTag } from '../services/cwlService.js'

const router = express.Router()

// ============================================================================
// SHARED UTILITY FUNCTIONS
// ============================================================================

/**
 * Extract badge URLs from clan object (handles both badge and badgeUrls formats)
 */
const getBadgeUrls = (clan) => {
  if (clan.badgeUrls && (clan.badgeUrls.small || clan.badgeUrls.medium || clan.badgeUrls.large)) {
    return clan.badgeUrls
  }
  if (clan.badge) {
    return {
      small: (typeof clan.badge.small === 'string' ? clan.badge.small : '') || '',
      medium: (typeof clan.badge.medium === 'string' ? clan.badge.medium : '') || '',
      large: (typeof clan.badge.large === 'string' ? clan.badge.large : '') || ''
    }
  }
  return { small: '', medium: '', large: '' }
}

/**
 * Handle API call with automatic re-authentication on 403 errors
 * @param {Function} apiCall - Function that returns a Promise
 * @param {Object} clientRef - Reference to client object that may need to be updated
 * @returns {Promise} Result of apiCall
 */
const callWithReauth = async (apiCall, clientRef = null) => {
  try {
    return await apiCall()
  } catch (error) {
    if (error.status === 403 || error.message?.includes('Forbidden') || error.message?.includes('403')) {
      logger.warn('🔄 Got 403 Forbidden, attempting re-authentication...')
      const newClient = await forceReauthenticate()
      if (clientRef && typeof clientRef === 'object') {
        Object.assign(clientRef, { client: newClient })
      }
      return await apiCall()
    }
    throw error
  }
}

/**
 * Format CWL war members with mirror rule detection
 */
const formatCWLMembers = (clanMembers, opponentMembers) => {
  if (!clanMembers || !Array.isArray(clanMembers)) return []
  
  // Pre-calculate positions for mirror rule checking
  const sortedMembers = [...clanMembers].sort((a, b) => (a.mapPosition || 0) - (b.mapPosition || 0))
  const sortedOpponents = opponentMembers ? [...opponentMembers].sort((a, b) => (a.mapPosition || 0) - (b.mapPosition || 0)) : []
  
  // Create position maps for O(1) lookup
  const memberPosMap = new Map()
  sortedMembers.forEach((m, idx) => {
    memberPosMap.set((m.tag || '').replace('#', '').toUpperCase(), idx + 1)
  })
  
  const opponentPosMap = new Map()
  sortedOpponents.forEach((m, idx) => {
    opponentPosMap.set((m.tag || '').replace('#', '').toUpperCase(), idx + 1)
  })
  
  // Collect all attacks with positions for reverse mirror checking
  const allAttacksWithPositions = []
  sortedMembers.forEach(m => {
    const attackerPos = memberPosMap.get((m.tag || '').replace('#', '').toUpperCase())
    ;(m.attacks || []).forEach(a => {
      allAttacksWithPositions.push({
        ...a,
        attackerTag: m.tag,
        attackerPos
      })
    })
  })
  
  return clanMembers.map(member => {
    const attackerPos = memberPosMap.get((member.tag || '').replace('#', '').toUpperCase())
    
    return {
      name: member.name,
      tag: member.tag,
      townHallLevel: member.townHallLevel || member.townhallLevel || 0,
      mapPosition: member.mapPosition,
      attacks: (member.attacks || []).map(attack => {
        const defenderTag = (attack.defenderTag || '').replace('#', '').toUpperCase()
        const defenderPos = opponentPosMap.get(defenderTag)
        
        // Check mirror rule compliance
        let isMirrorAttack = false
        if (attackerPos && defenderPos) {
          // Direct mirror: positions match
          if (attackerPos === defenderPos) {
            isMirrorAttack = true
          } else if (attack.order) {
            // Reverse mirror: Check if current attacker is RESPONDING to a broken rule
            const currentAttackOrder = attack.order
            const hasReverseMirror = allAttacksWithPositions.some(otherAttack => {
              // Must be a different attack that happened before
              if (!otherAttack.order || otherAttack.order >= currentAttackOrder) return false
              
              // Rule-breaker must be at position matching current defender's position
              if (otherAttack.attackerPos !== defenderPos) return false
              
              // Rule-breaker must have attacked a defender at current attacker's position
              const otherDefenderTag = (otherAttack.defenderTag || '').replace('#', '').toUpperCase()
              const otherDefenderPos = opponentPosMap.get(otherDefenderTag)
              return otherDefenderPos === attackerPos
            })
            
            if (hasReverseMirror) {
              isMirrorAttack = true
            }
          }
        }
        
        return {
          stars: attack.stars,
          destructionPercentage: attack.destructionPercentage || attack.destruction || 0,
          order: attack.order,
          duration: attack.duration,
          attackerTag: attack.attackerTag,
          defenderTag: attack.defenderTag,
          isMirrorAttack
        }
      }),
      bestOpponentAttack: member.bestOpponentAttack ? {
        stars: member.bestOpponentAttack.stars,
        destructionPercentage: member.bestOpponentAttack.destructionPercentage || member.bestOpponentAttack.destruction || 0,
        attackerTag: member.bestOpponentAttack.attackerTag
      } : null
    }
  })
}

// Get filtered CWL clans (merged data with capacity logic applied)
router.get('/clans', async (req, res) => {
  try {
    const showAll = req.query.all === 'true'
    const includeFilteredInfo = req.query.includeFilteredInfo === 'true'
    
    // Get display period info (for frontend to determine if it should show the notice)
    const isDisplayPeriod = isCWLDisplayPeriod()
    const monthName = getCurrentMonthNameIST()
    
    if (showAll) {
      // Show all clans without filtering (uses shared cache)
      const allClans = await getAllCWLClansMerged()
      
      // If includeFilteredInfo is true, also return filtered clans for admin mode
      if (includeFilteredInfo) {
        const filteredClans = await getCWLClansFiltered()
        const filteredTags = new Set(filteredClans.map(clan => clan.tag))
        
        return res.json({
          count: allClans.length,
          clans: allClans,
          filtered: false,
          filteredClanTags: Array.from(filteredTags),
          isDisplayPeriod,
          monthName
        })
      }
      
      return res.json({
        count: allClans.length,
        clans: allClans,
        filtered: false,
        isDisplayPeriod,
        monthName
      })
    }
    
    // Default: filtered clans
    const clans = await getCWLClansFiltered()
    res.json({
      count: clans.length,
      clans,
      filtered: true,
      isDisplayPeriod,
      monthName
    })
  } catch (error) {
    logger.error('Error fetching filtered CWL clans:', error.message)
    res.status(500).json({
      error: 'Failed to fetch CWL clans',
      message: error.message
    })
  }
})

// Get eligible members for a specific clan
router.post('/clans/:clanTag/eligible', async (req, res) => {
  try {
    const { clanTag } = req.params
    const { sheetData } = req.body

    if (!sheetData) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'sheetData is required in request body'
      })
    }

    const eligibleInfo = await getClanEligibleMembers(clanTag, sheetData)
    res.json(eligibleInfo)
  } catch (error) {
    logger.error('Error calculating eligible members:', error.message)
    res.status(500).json({
      error: 'Failed to calculate eligible members',
      message: error.message
    })
  }
})

// Get CWL status for a specific clan
router.get('/clans/:clanTag/status', async (req, res) => {
  try {
    const { clanTag } = req.params
    const decodedTag = decodeURIComponent(clanTag)
    
    const cwlStatus = await checkCWLStatus(decodedTag)
    res.json(cwlStatus)
  } catch (error) {
    logger.error('Error checking CWL status:', error.message)
    res.status(500).json({
      error: 'Failed to check CWL status',
      message: error.message
    })
  }
})

// Get specific CWL war by warTag - SIMPLE VERSION
// Must come before /:clanTag routes to avoid route conflicts
router.get('/war/:warTag', async (req, res) => {
  try {
    const { warTag } = req.params
    const formattedTag = normalizeTag(warTag)
    const cacheKey = `cwl_war_${formattedTag}`
    
    // Check cache
    const cached = cacheService.get(cacheKey)
    if (cached) {
      return res.json({ ...cached, cached: true })
    }
    
    // Get CoC client
    let client = await initializeCoCClient()
    if (!client) {
      throw new Error('CoC API client not initialized')
    }
    
    // Fetch war details with automatic re-authentication on 403
    const war = await callWithReauth(async () => {
      return await client.getClanWarLeagueRound(formattedTag)
    })
    
    const warData = {
      warTag: formattedTag,
      state: war.state,
      teamSize: war.teamSize,
      startTime: war.startTime,
      endTime: war.endTime,
      preparationStartTime: war.preparationStartTime,
      clan: {
        name: war.clan.name,
        tag: war.clan.tag,
        badgeUrls: getBadgeUrls(war.clan),
        clanLevel: war.clan.clanLevel || war.clan.level || 0,
        stars: war.clan.stars || 0,
        destructionPercentage: war.clan.destruction || war.clan.destructionPercentage || 0,
        attacks: Array.isArray(war.clan.attacks) ? war.clan.attacks.length : (war.clan.attackCount || 0),
        expEarned: war.clan.expEarned || 0,
        members: war.clan.members?.map(m => ({
          name: m.name,
          tag: m.tag,
          townHallLevel: m.townHallLevel || m.townhallLevel || 0,
          mapPosition: m.mapPosition,
          attacks: (m.attacks || []).map(atk => ({
            stars: atk.stars,
            destructionPercentage: atk.destructionPercentage || atk.destruction || 0,
            order: atk.order,
            duration: atk.duration,
            attackerTag: atk.attackerTag,
            defenderTag: atk.defenderTag
          })),
          bestOpponentAttack: m.bestOpponentAttack ? {
            stars: m.bestOpponentAttack.stars,
            destructionPercentage: m.bestOpponentAttack.destructionPercentage || m.bestOpponentAttack.destruction || 0,
            attackerTag: m.bestOpponentAttack.attackerTag
          } : null
        })) || []
      },
      opponent: {
        name: war.opponent.name,
        tag: war.opponent.tag,
        badgeUrls: getBadgeUrls(war.opponent),
        clanLevel: war.opponent.clanLevel || war.opponent.level || 0,
        stars: war.opponent.stars || 0,
        destructionPercentage: war.opponent.destruction || war.opponent.destructionPercentage || 0,
        attacks: Array.isArray(war.opponent.attacks) ? war.opponent.attacks.length : (war.opponent.attackCount || 0),
        expEarned: war.opponent.expEarned || 0,
        members: war.opponent.members?.map(m => ({
          name: m.name,
          tag: m.tag,
          townHallLevel: m.townHallLevel || m.townhallLevel || 0,
          mapPosition: m.mapPosition,
          attacks: (m.attacks || []).map(atk => ({
            stars: atk.stars,
            destructionPercentage: atk.destructionPercentage || atk.destruction || 0,
            order: atk.order,
            duration: atk.duration,
            attackerTag: atk.attackerTag,
            defenderTag: atk.defenderTag
          })),
          bestOpponentAttack: m.bestOpponentAttack ? {
            stars: m.bestOpponentAttack.stars,
            destructionPercentage: m.bestOpponentAttack.destructionPercentage || m.bestOpponentAttack.destruction || 0,
            attackerTag: m.bestOpponentAttack.attackerTag
          } : null
        })) || []
      }
    }
    
    // Note: Individual wars are saved to database by the /all endpoint
    // We don't save here because we don't have the requesting clanTag context
    // and don't want to use war.clan.tag as it might be incorrect if requester is opponent
    
    // Cache the result
    cacheService.set(cacheKey, warData, CACHE_TTL.CLAN_WAR || 120)
    
    res.json({ ...warData, cached: false })
  } catch (error) {
    logger.error('Error fetching CWL war:', error)
    res.status(error.status || 500).json({
      error: error.message || 'Failed to fetch war data',
      status: error.status || 500
    })
  }
})

// Get current CWL group - SIMPLE VERSION
// Returns just the group structure with rounds and warTags (single API call)
router.get('/:clanTag/current', async (req, res) => {
  try {
    const { clanTag } = req.params
    const formattedTag = normalizeTag(clanTag)
    const cacheKey = `cwl_current_${formattedTag}`
    
    // Check cache
    const cached = cacheService.get(cacheKey)
    if (cached) {
      return res.json({ ...cached, cached: true })
    }
    
    // Get CoC client
    let client = await initializeCoCClient()
    if (!client) {
      throw new Error('CoC API client not initialized')
    }
    
    // Single API call to get CWL group
    let cwlGroup
    try {
      cwlGroup = await client.getClanWarLeagueGroup(formattedTag)
    } catch (error) {
      // If we get a 403 Forbidden, the session might have expired - try re-authenticating
      if (error.status === 403 || error.message?.includes('Forbidden') || error.message?.includes('403')) {
        logger.warn('🔄 Got 403 Forbidden, attempting re-authentication...')
        const { forceReauthenticate } = await import('../services/clashOfClansService.js')
        client = await forceReauthenticate()
        cwlGroup = await client.getClanWarLeagueGroup(formattedTag)
      } else {
        throw error
      }
    }
    
    // Fetch full clan details to get badge URLs - SEQUENTIALLY to avoid rate limiting
    const clansWithBadges = []
    for (let i = 0; i < cwlGroup.clans.length; i++) {
      const c = cwlGroup.clans[i]
      
      // Add delay between requests (except first one) to prevent throttling
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 400)) // 400ms delay between clan fetches
      }
      
      try {
        const fullClan = await getClanDetails(c.tag)
        clansWithBadges.push({
          name: c.name,
          tag: c.tag,
          badgeUrls: fullClan.badgeUrls || {},
          clanLevel: c.level || fullClan.clanLevel || 0,
          members: c.members?.length || 0,
          memberList: c.members?.map(m => ({
            name: m.name,
            tag: m.tag,
            townHallLevel: m.townHallLevel
          })) || []
        })
      } catch (err) {
        // Handle rate limiting gracefully
        if (err.status === 429 || err.message?.includes('throttl') || err.message?.includes('rate limit')) {
          logger.warn(`Rate limited while fetching clan ${c.name}, using fallback data`)
          // Wait longer before continuing
          await new Promise(resolve => setTimeout(resolve, 2000))
        } else {
          logger.error(`Error fetching clan ${c.name}:`, err.message)
        }
        
        clansWithBadges.push({
          name: c.name,
          tag: c.tag,
          badgeUrls: null,
          clanLevel: c.level || 0,
          members: c.members?.length || 0,
          memberList: c.members?.map(m => ({
            name: m.name,
            tag: m.tag,
            townHallLevel: m.townHallLevel
          })) || []
        })
      }
    }
    
    const cwlData = {
      state: cwlGroup.state,
      season: cwlGroup.season,
      clans: clansWithBadges,
      rounds: cwlGroup.rounds?.map(round => ({
        round: round.round,
        warTags: round.warTags || []
      })) || []
    }
    
    // Cache the result
    cacheService.set(cacheKey, cwlData, CACHE_TTL.CLAN_WAR || 120)
    
    res.json({ ...cwlData, cached: false })
  } catch (error) {
    logger.error('Error fetching CWL group:', error)
    res.status(error.status || 500).json({
      error: error.message || 'Failed to fetch CWL data',
      status: error.status || 500
    })
  }
})

// Get all CWL rounds with details - SIMPLE VERSION
router.get('/:clanTag/all', async (req, res) => {
  try {
    const { clanTag } = req.params
    const formattedTag = normalizeTag(clanTag)
    const sortBy = req.query.sortBy || 'total' // Get sortBy from query params, default to 'total'
    
    // Use separate cache keys for different sort options to avoid re-sorting on every request
    // Cache base data separately, then sort on demand
    const getCacheKeys = (tag, sort) => ({
      base: `cwl_all_base_${tag}`,
      sorted: `cwl_all_${tag}_sort_${sort}`
    })
    const cacheKeys = getCacheKeys(formattedTag, sortBy)
    
    // Check if we have a cached version with this sort
    let cached = cacheService.get(cacheKeys.sorted)
    if (cached) {
      return res.json({ ...cached, cached: true })
    }
    
    // Check base cache (unsorted or default sorted)
    const baseCached = cacheService.get(cacheKeys.base)
    if (baseCached) {
      // If sortBy is 'total', use base cache as-is (it's already sorted by total)
      if (sortBy === 'total') {
        // Also cache under sorted key for consistency
        cacheService.set(cacheKeys.sorted, baseCached, 60)
        return res.json({ ...baseCached, cached: true })
      }
      
      // For other sorts, re-sort the memberSummary from base cache
      if (baseCached.memberSummary && Array.isArray(baseCached.memberSummary)) {
        const sortedMemberSummary = [...baseCached.memberSummary].sort((a, b) => {
          const roundNum = parseInt(sortBy)
          const aRoundData = a.rounds[roundNum]
          const bRoundData = b.rounds[roundNum]
          
          // Members without data for this round go to the bottom
          if (!aRoundData && !bRoundData) return 0
          if (!aRoundData) return 1
          if (!bRoundData) return -1
          
          // Sort by stars first (descending)
          if (bRoundData.stars !== aRoundData.stars) {
            return bRoundData.stars - aRoundData.stars
          }
          // Then by destruction (descending)
          return bRoundData.destruction - aRoundData.destruction
        })
        
        const result = {
          ...baseCached,
          memberSummary: sortedMemberSummary,
          cached: true
        }
        
        // Cache the sorted version
        cacheService.set(cacheKeys.sorted, result, 60)
        return res.json(result)
      }
    }
    
    // Get CoC client
    let client = await initializeCoCClient()
    if (!client) {
      throw new Error('CoC API client not initialized')
    }
    
    // Get CWL group first with automatic re-authentication on 403
    const cwlGroup = await callWithReauth(async () => {
      return await client.getClanWarLeagueGroup(formattedTag)
    })
    
    // Get all war details - fetch wars SEQUENTIALLY with rate limiting to avoid throttling
    // CRITICAL: Process wars one at a time with delays to prevent 429 errors
    const allWarsWithRaw = []
    const roundsData = []
    
    // Process rounds sequentially to avoid overwhelming the API
    for (let roundIndex = 0; roundIndex < cwlGroup.rounds.length; roundIndex++) {
      const round = cwlGroup.rounds[roundIndex]
      const warTags = round.warTags.filter(tag => tag && tag !== '#0' && tag !== '0')
      const actualRoundNumber = round.round || (roundIndex + 1)
      
      const wars = []
      
      // Process wars sequentially with delays to avoid rate limiting
      for (let warIndex = 0; warIndex < warTags.length; warIndex++) {
        const warTag = warTags[warIndex]
        
        // Add delay between war requests (except first one) to prevent throttling
        if (warIndex > 0) {
          await new Promise(resolve => setTimeout(resolve, 500)) // 500ms delay between war fetches
        }
        
        try {
          // Fetch war with automatic re-authentication on 403 and retry on 429
          let war
          let retries = 0
          const maxRetries = 3
          
          while (retries <= maxRetries) {
            try {
              war = await client.getClanWarLeagueRound(warTag)
              break // Success, exit retry loop
            } catch (error) {
              // Handle 403 Forbidden (re-authentication needed)
              if (error.status === 403 || error.message?.includes('Forbidden') || error.message?.includes('403')) {
                logger.warn(`🔄 Got 403 Forbidden for war ${warTag}, attempting re-authentication...`)
                client = await forceReauthenticate()
                // Retry immediately after re-auth
                continue
              }
              
              // Handle 429 Rate Limited - wait with exponential backoff
              if (error.status === 429 || error.message?.includes('throttl') || error.message?.includes('rate limit')) {
                if (retries < maxRetries) {
                  const waitTime = Math.min(1000 * Math.pow(2, retries), 8000) // Exponential backoff: 1s, 2s, 4s, max 8s
                  logger.warn(`⚠️ Rate limited for war ${warTag}, waiting ${waitTime}ms before retry ${retries + 1}/${maxRetries}`)
                  await new Promise(resolve => setTimeout(resolve, waitTime))
                  retries++
                  continue
                } else {
                  logger.error(`❌ Rate limited for war ${warTag} after ${maxRetries} retries, skipping`)
                  throw error
                }
              }
              
              // Other errors - throw immediately
              throw error
            }
          }
          
          // Store raw war for leaderboard (has both clan and opponent perspectives)
          allWarsWithRaw.push({ war, roundIndex, roundNumber: actualRoundNumber, warTag })
          
          // Check if our clan is in this war
          const isOurClan = normalizeTag(war.clan.tag) === normalizeTag(formattedTag)
          
          // Only return war data if our clan is in this war (for frontend display)
          // But we still store all wars in allWarsWithRaw for leaderboard calculation
          if (!isOurClan && normalizeTag(war.opponent.tag) !== normalizeTag(formattedTag)) {
            // Skip badge fetching for wars not involving our clan to save API calls
            continue
          }
          
          const ourClan = isOurClan ? war.clan : war.opponent
          const theirClan = isOurClan ? war.opponent : war.clan
          
          // Get badge URLs for both clans using shared helper
          let ourClanBadgeUrls = getBadgeUrls(ourClan)
          let opponentBadgeUrls = getBadgeUrls(theirClan)
          
          // Only fetch badges if missing - but do it sequentially with delays
          if (!ourClanBadgeUrls.small && !ourClanBadgeUrls.medium && !ourClanBadgeUrls.large) {
            try {
              await new Promise(resolve => setTimeout(resolve, 300)) // Delay before badge fetch
              const fullClan = await getClanDetails(ourClan.tag)
              if (fullClan?.badgeUrls && (fullClan.badgeUrls.small || fullClan.badgeUrls.medium || fullClan.badgeUrls.large)) {
                ourClanBadgeUrls = fullClan.badgeUrls
              }
            } catch (err) {
              // Silently fail - badge URLs are optional
              if (err.status === 429) {
                logger.warn(`Rate limited while fetching badge for ${ourClan.name}, skipping`)
              } else if (err.status !== 429) {
                logger.warn(`Could not fetch badge for ${ourClan.name}:`, err.message)
              }
            }
          }
          
          if (!opponentBadgeUrls.small && !opponentBadgeUrls.medium && !opponentBadgeUrls.large) {
            try {
              await new Promise(resolve => setTimeout(resolve, 300)) // Delay before badge fetch
              const fullOpponent = await getClanDetails(theirClan.tag)
              if (fullOpponent?.badgeUrls && (fullOpponent.badgeUrls.small || fullOpponent.badgeUrls.medium || fullOpponent.badgeUrls.large)) {
                opponentBadgeUrls = fullOpponent.badgeUrls
              }
            } catch (err) {
              // Silently fail - badge URLs are optional
              if (err.status === 429) {
                logger.warn(`Rate limited while fetching badge for ${theirClan.name}, skipping`)
              } else if (err.status !== 429) {
                logger.warn(`Could not fetch badge for ${theirClan.name}:`, err.message)
              }
            }
          }
          
          wars.push({
            warTag: warTag,
            state: war.state,
            teamSize: war.teamSize || 0,
            startTime: war.startTime || null,
            endTime: war.endTime || null,
            preparationStartTime: war.preparationStartTime || null,
            clan: {
              name: ourClan.name,
              tag: ourClan.tag,
              badgeUrls: ourClanBadgeUrls,
              clanLevel: ourClan.clanLevel || ourClan.level || 0,
              stars: ourClan.stars,
              destructionPercentage: ourClan.destruction || ourClan.destructionPercentage || 0,
              attacks: ourClan.attackCount !== undefined ? ourClan.attackCount : (Array.isArray(ourClan.attacks) ? ourClan.attacks.length : 0),
              members: formatCWLMembers(ourClan.members, theirClan.members)
            },
            opponent: {
              name: theirClan.name,
              tag: theirClan.tag,
              badgeUrls: opponentBadgeUrls,
              clanLevel: theirClan.clanLevel || theirClan.level || 0,
              stars: theirClan.stars,
              destructionPercentage: theirClan.destruction || theirClan.destructionPercentage || 0,
              attacks: theirClan.attackCount !== undefined ? theirClan.attackCount : (Array.isArray(theirClan.attacks) ? theirClan.attacks.length : 0),
              members: formatCWLMembers(theirClan.members, ourClan.members)
            },
            result: ourClan.stars > theirClan.stars ? 'win' : 
                    ourClan.stars < theirClan.stars ? 'loss' : 'draw'
          })
        } catch (error) {
          logger.error(`Error fetching war ${warTag}:`, error.message)
          // Continue processing other wars even if one fails
        }
      }
      
      // Filter to only include our clan's wars (should be only 1 war per round typically)
      const ourClanWars = wars.filter(w => w !== null)
      
      roundsData.push({
        round: actualRoundNumber,
        wars: ourClanWars
      })
      
      // Add delay between rounds to give API a breather
      if (roundIndex < cwlGroup.rounds.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300))
      }
    }
    
    // Transform all raw wars to format expected by calculateCWLLeaderboard
    // This includes ALL wars from ALL clans (not just our clan's wars)
    // Format matches what getAllCWLWars returns (clan/opponent structure)
    // Note: API returns 'destruction' not 'destructionPercentage' (same as getAllCWLWars)
    const allWarsForLeaderboard = allWarsWithRaw.map(({ war, warTag }) => ({
      warTag: warTag || war.tag || null,
      state: war.state || 'unknown',
      teamSize: war.teamSize || 0, // Required for destruction calculation
      clan: {
        name: war.clan?.name || 'Unknown',
        tag: war.clan?.tag || '',
        badgeUrls: war.clan?.badgeUrls || war.clan?.badge || {},
        stars: war.clan?.stars || 0,
        destructionPercentage: war.clan?.destruction || war.clan?.destructionPercentage || 0,
        attacks: war.clan?.attacks || []
      },
      opponent: {
        name: war.opponent?.name || 'Unknown',
        tag: war.opponent?.tag || '',
        badgeUrls: war.opponent?.badgeUrls || war.opponent?.badge || {},
        stars: war.opponent?.stars || 0,
        destructionPercentage: war.opponent?.destruction || war.opponent?.destructionPercentage || 0,
        attacks: war.opponent?.attacks || []
      }
    }))
    
    // Get league name from query param or database
    let leagueName = req.query.leagueName || null
    if (!leagueName) {
      try {
        const { getCWLClanDetails } = await import('../services/clanManagementService.js')
        const cwlDetails = await getCWLClanDetails()
        const clanDetail = cwlDetails.find(detail => detail.tag === formattedTag)
        if (clanDetail?.league && clanDetail.league.toLowerCase() !== 'unranked') {
          leagueName = clanDetail.league
        }
      } catch (error) {
        logger.error('Error fetching league name from database:', error.message)
      }
    }
    
    // Fallback: Try to get league name from clan's current warLeague if still not found
    if (!leagueName || leagueName.toLowerCase() === 'unranked') {
      try {
        const clanDetails = await getClanDetails(formattedTag)
        if (clanDetails?.warLeague?.name) {
          const { parseLeagueName } = await import('../services/clanManagementService.js')
          const parsedLeague = parseLeagueName(clanDetails.warLeague.name)
          if (parsedLeague && parsedLeague.toLowerCase() !== 'unranked') {
            leagueName = parsedLeague
          }
        }
      } catch (error) {
        logger.warn('Could not fetch league name from clan API:', error.message)
      }
    }
    
    // Calculate round stats for each round (for our clan only)
    const roundStats = {}
    const normalizedOurTag = formattedTag.replace('#', '').toUpperCase()
    
    cwlGroup.rounds.forEach((round, roundIndex) => {
      // Use actual round number from API, not array index (API rounds may not be sequential)
      const roundNumber = round.round || (roundIndex + 1)
      
      // Get raw wars for this round - filter by both roundIndex and roundNumber for safety
      const roundRawWars = allWarsWithRaw
        .filter(item => {
          // Match by round number first (more reliable), fallback to roundIndex
          return (item.roundNumber === roundNumber) || (item.roundIndex === roundIndex)
        })
        .map(item => item.war)
      
      // Filter to only our clan's war and transform to format expected by calculateRoundStats
      const ourRoundWars = roundRawWars
        .filter(war => {
          const warClanTag = (war.clan?.tag || '').replace('#', '').toUpperCase()
          const warOppTag = (war.opponent?.tag || '').replace('#', '').toUpperCase()
          return warClanTag === normalizedOurTag || warOppTag === normalizedOurTag
        })
        .map(war => {
          // Transform to clan/opponent format expected by calculateRoundStats
          // Note: API returns 'destruction' not 'destructionPercentage' (same as getAllCWLWars)
          return {
            warTag: war.tag || null,
            state: war.state || 'unknown',
            teamSize: war.teamSize || 0,
            endTime: war.endTime || null,
            clan: {
              name: war.clan?.name || 'Unknown',
              tag: war.clan?.tag || '',
              badgeUrls: getBadgeUrls(war.clan),
              clanLevel: war.clan?.clanLevel || war.clan?.level || 0,
              stars: war.clan?.stars || 0,
              destructionPercentage: war.clan?.destruction || war.clan?.destructionPercentage || 0,
              attacks: Array.isArray(war.clan?.attacks) ? war.clan.attacks.length : 0
            },
            opponent: {
              name: war.opponent?.name || 'Unknown',
              tag: war.opponent?.tag || '',
              badgeUrls: getBadgeUrls(war.opponent),
              clanLevel: war.opponent?.clanLevel || war.opponent?.level || 0,
              stars: war.opponent?.stars || 0,
              destructionPercentage: war.opponent?.destruction || war.opponent?.destructionPercentage || 0,
              attacks: Array.isArray(war.opponent?.attacks) ? war.opponent.attacks.length : 0
            }
          }
        })
      
      // Calculate stats using only our clan's war(s), even if no wars (will return default values)
      const stats = calculateRoundStats(round, ourRoundWars, formattedTag)
      roundStats[roundNumber] = stats
    })
    
    // Calculate leaderboard from all wars
    let leaderboard = []
    let promotionDemotionInfo = null
    if (cwlGroup.clans && cwlGroup.clans.length > 0) {
      // Collect badges from wars first to avoid redundant API calls
      const badgeCache = new Map()
      allWarsWithRaw.forEach(({ war }) => {
        if (war.clan?.tag) {
          const badge = getBadgeUrls(war.clan)
          if (badge.small || badge.medium || badge.large) {
            badgeCache.set(normalizeTag(war.clan.tag), badge)
          }
        }
        if (war.opponent?.tag) {
          const badge = getBadgeUrls(war.opponent)
          if (badge.small || badge.medium || badge.large) {
            badgeCache.set(normalizeTag(war.opponent.tag), badge)
          }
        }
      })
      
      // Enhance clans with badgeUrls - reuse from cache, only fetch missing ones SEQUENTIALLY
      const clansWithBadges = []
      for (let i = 0; i < cwlGroup.clans.length; i++) {
        const c = cwlGroup.clans[i]
        const normalizedTag = normalizeTag(c.tag)
        
        // Check if we already have badge from wars
        let badgeUrls = badgeCache.get(normalizedTag) || {}
        
        // Only fetch if badge is missing
        if (!badgeUrls.small && !badgeUrls.medium && !badgeUrls.large) {
          // Add delay between requests to avoid rate limiting (except first one)
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 500)) // Increased to 500ms delay between requests
          }
          
          let retries = 0
          const maxRetries = 2
          
          while (retries <= maxRetries) {
            try {
              const fullClan = await getClanDetails(c.tag)
              badgeUrls = fullClan.badgeUrls || {}
              if (badgeUrls.small || badgeUrls.medium || badgeUrls.large) {
                badgeCache.set(normalizedTag, badgeUrls) // Cache for future use
              }
              break // Success, exit retry loop
            } catch (err) {
              // Handle rate limiting with exponential backoff
              if (err.status === 429 || err.message?.includes('throttl') || err.message?.includes('rate limit')) {
                if (retries < maxRetries) {
                  const waitTime = Math.min(2000 * Math.pow(2, retries), 8000) // Exponential backoff: 2s, 4s, max 8s
                  logger.warn(`Rate limited while fetching clan ${c.name}, waiting ${waitTime}ms before retry ${retries + 1}/${maxRetries}`)
                  await new Promise(resolve => setTimeout(resolve, waitTime))
                  retries++
                  continue
                } else {
                  logger.warn(`Rate limited while fetching clan ${c.name} after ${maxRetries} retries, using fallback data`)
                  badgeUrls = {}
                  break
                }
              } else {
                // Other errors - use empty badge
                logger.warn(`Error fetching badge for clan ${c.name}:`, err.message || err)
                badgeUrls = {}
                break
              }
            }
          }
        }
        
        clansWithBadges.push({
          name: c.name,
          tag: c.tag,
          level: c.level || 0,
          badgeUrls: badgeUrls,
          members: c.members?.length || 0
        })
      }
      
      leaderboard = calculateCWLLeaderboard(clansWithBadges, allWarsForLeaderboard, leagueName)
      
      // Get promotion/demotion info if league name is available
      if (leagueName) {
        promotionDemotionInfo = getPromotionDemotionSlots(leagueName)
      } else {
        promotionDemotionInfo = { promotionCount: 0, demotionCount: 0 }
      }
    }
    
    // Calculate member summary statistics (aggregated across all rounds)
    // This replaces ~200 lines of client-side calculation in CWLMembersSummary.jsx
    let memberSummary = []
    if (leaderboard && leaderboard.length > 0 && roundsData && roundsData.length > 0) {
      // Get totalBonuses for the requesting clan from leaderboard
      let totalBonuses = null
      const clanLeaderboard = leaderboard.find(clan => {
        const normalizedClanTag = normalizeTag(clan.tag) || clan.tag
        return normalizedClanTag === normalizeTag(formattedTag)
      })
      if (clanLeaderboard?.totalBonuses !== undefined && clanLeaderboard.totalBonuses !== null) {
        totalBonuses = clanLeaderboard.totalBonuses
      }
      
      // Calculate member summary using roundsData (which has wars organized by round)
      // roundsData structure: [{ round: 1, wars: [...] }, { round: 2, wars: [...] }, ...]
      // Pass sortBy parameter to sort the results
      memberSummary = calculateMemberSummary(roundsData, formattedTag, totalBonuses, sortBy)
    }
    
    // Save wars to database (cwlWars collection)
    if (isDatabaseConnected() && allWarsWithRaw.length > 0) {
      try {
        // Helper function to get round number for a war tag (if needed in future)
        const getRoundForWarTag = (warsWithRaw, warTag) => {
          const warItem = warsWithRaw.find(item => item.warTag === warTag)
          // Use actual round number from API, not array index
          return warItem ? (warItem.roundNumber || warItem.roundIndex + 1) : null
        }
        
        // Format and save each war to database
        const warUpsertPromises = allWarsWithRaw.map(({ war, warTag, roundIndex, roundNumber }) => {
          if (!warTag) return null
          
          // Use actual round number from API, not array index (API rounds may not be sequential)
          const actualRoundNumber = roundNumber || (roundIndex + 1)
          
          // Format war data similar to getAllCWLWars format
          const formattedWar = {
            warTag: warTag,
            state: war.state || 'unknown',
            teamSize: war.teamSize || 0,
            preparationStartTime: war.preparationStartTime || null,
            startTime: war.startTime || null,
            endTime: war.endTime || null,
            clan: war.clan ? {
              tag: war.clan.tag || '',
              name: war.clan.name || 'Unknown',
              badgeUrls: getBadgeUrls(war.clan),
              clanLevel: war.clan.clanLevel || war.clan.level || 0,
              attacks: Array.isArray(war.clan.attacks) ? war.clan.attacks.length : (war.clan.attackCount || 0),
              stars: war.clan.stars || 0,
              destructionPercentage: war.clan.destruction || war.clan.destructionPercentage || 0,
              expEarned: war.clan.expEarned || 0,
              members: war.clan.members || []
            } : null,
            opponent: war.opponent ? {
              tag: war.opponent.tag || '',
              name: war.opponent.name || 'Unknown',
              badgeUrls: getBadgeUrls(war.opponent),
              clanLevel: war.opponent.clanLevel || war.opponent.level || 0,
              attacks: Array.isArray(war.opponent.attacks) ? war.opponent.attacks.length : (war.opponent.attackCount || 0),
              stars: war.opponent.stars || 0,
              destructionPercentage: war.opponent.destruction || war.opponent.destructionPercentage || 0,
              expEarned: war.opponent.expEarned || 0,
              members: war.opponent.members || []
            } : null,
            clanTag: formattedTag,
            round: actualRoundNumber
          }
          
          return databaseService.upsert('cwlWars',
            { warTag: warTag },
            formattedWar
          )
        })
        
        // Execute all war upserts in parallel
        await Promise.all(warUpsertPromises.filter(p => p !== null))
      } catch (error) {
        logger.error('Error saving CWL wars to database:', error.message)
        // Continue even if war save fails
      }
    }
    
    // Save CWL group with leaderboard to database (cwlGroups collection)
    if (isDatabaseConnected() && leaderboard && leaderboard.length > 0 && cwlGroup.season) {
      try {
        // Create a map of clan tag to rank for quick lookup
        const rankMap = new Map()
        leaderboard.forEach(clan => {
          if (clan.tag) {
            rankMap.set(clan.tag, clan.rank || null)
          }
        })
        
        // Update clans array with ranks
        const updatedClans = cwlGroup.clans.map(clan => ({
          tag: clan.tag || '',
          name: clan.name || 'Unknown',
          level: clan.level || 0,
          badgeUrls: {
            small: (typeof clan.badge?.small === 'string' ? clan.badge.small : '') || '',
            medium: (typeof clan.badge?.medium === 'string' ? clan.badge.medium : '') || '',
            large: (typeof clan.badge?.large === 'string' ? clan.badge.large : '') || ''
          },
          members: clan.members?.map(m => ({
            name: m.name || '',
            tag: m.tag || '',
            townHallLevel: m.townHallLevel || 0
          })) || [],
          rank: rankMap.get(clan.tag) || null
        }))
        
        // Get current league from clan API to capture final league after promotion/demotion
        let finalLeague = null
        try {
          const clanDetails = await getClanDetails(formattedTag)
          if (clanDetails?.warLeague?.name) {
            const { parseLeagueName } = await import('../services/clanManagementService.js')
            const parsedLeague = parseLeagueName(clanDetails.warLeague.name)
            if (parsedLeague && parsedLeague.toLowerCase() !== 'unranked') {
              finalLeague = parsedLeague
            }
          }
        } catch (error) {
          // Silently fail
        }
        
        // Format CWL group data similar to getCWLGroup format
        const formattedGroup = {
          clanTag: formattedTag,
          state: cwlGroup.state || 'unknown',
          season: cwlGroup.season || null,
          clans: updatedClans,
          rounds: cwlGroup.rounds?.map(round => ({
            round: round.round || 0,
            warTags: round.warTags || []
          })) || [],
          leaderboard: leaderboard, // Store full leaderboard for historical reference
          initialLeague: '', // Will be set by getCWLGroup service if needed
          matchedLeague: leagueName || '',
          finalLeague: finalLeague || ''
        }
        
        await databaseService.upsert('cwlGroups',
          { clanTag: formattedTag, season: cwlGroup.season },
          formattedGroup
        )
      } catch (error) {
        logger.error('Error saving CWL group to database:', error.message)
        // Continue even if group save fails
      }
    }
    
    const result = {
      state: cwlGroup.state,
      season: cwlGroup.season,
      clans: cwlGroup.clans.map(c => ({
        name: c.name,
        tag: c.tag,
        level: c.level
      })),
      rounds: roundsData,
      roundStats: roundStats, // Round stats for frontend
      leaderboard: leaderboard,
      promotionDemotion: promotionDemotionInfo,
      leagueName: leagueName,
      memberSummary: memberSummary // Pre-calculated member summary statistics
    }
    
    // Cache the result (shorter TTL since it's more expensive)
    // Cache base version (sorted by total) and sorted version separately
    const finalCacheKeys = getCacheKeys(formattedTag, sortBy)
    
    // Cache base version (always sorted by total)
    cacheService.set(finalCacheKeys.base, result, 60) // 1 minute cache
    // Also cache the sorted version
    cacheService.set(finalCacheKeys.sorted, result, 60) // 1 minute cache
    
    res.json({ ...result, cached: false })
  } catch (error) {
    logger.error('Error fetching all CWL data:', error)
    res.status(error.status || 500).json({
      error: error.message || 'Failed to fetch CWL data',
      status: error.status || 500
    })
  }
})

export default router
