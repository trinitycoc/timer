import { Client } from 'clashofclans.js'
import { cacheService, CACHE_TTL } from './cacheService.js'
import { calculateTHComposition } from './cwlService.js'
import { databaseService, isDatabaseConnected } from './databaseService.js'
import logger from '../utils/logger.js'
import { parseLeagueName } from './clanManagementService.js'

// Initialize the Clash of Clans API client
let client = null
let clientInitializing = null // Promise to track ongoing initialization

// Rate limiting configuration
const REQUEST_POOL_SIZE = 5 // Max concurrent requests
let activeRequests = 0

/**
 * Normalize clan tag for comparison (remove # and convert to uppercase)
 * @param {string} tag - Clan tag
 * @returns {string} Normalized tag
 */
const normalizeTagForComparison = (tag) => {
  return (tag || '').replace('#', '').toUpperCase()
}

/**
 * Initialize the CoC API client with email and password
 * Uses a promise to prevent race conditions during concurrent requests
 */
export const initializeCoCClient = async () => {
  const email = process.env.COC_EMAIL
  const password = process.env.COC_PASSWORD

  if (!email || !password) {
    throw new Error('COC_EMAIL and COC_PASSWORD must be set in .env file')
  }

  // If client already exists and is logged in, return it
  if (client) {
    return client
  }

  // If initialization is already in progress, wait for it
  if (clientInitializing) {
    return await clientInitializing
  }

  // Start new initialization
  clientInitializing = (async () => {
    try {
      const newClient = new Client({
        timeout: 15000 // Increased timeout for better reliability
      })

      // Login with email and password
      await newClient.login({ email, password })

      client = newClient

      return client
    } catch (error) {
      console.error('Failed to authenticate with Clash of Clans API:', error.message)
      client = null
      throw error
    } finally {
      clientInitializing = null
    }
  })()

  return await clientInitializing
}

/**
 * Force re-authentication by clearing the client and re-initializing
 * This is useful when we get 403 Forbidden errors (expired session)
 */
export const forceReauthenticate = async () => {
  logger.warn('🔄 Forcing re-authentication due to expired session')
  client = null
  clientInitializing = null
  return await initializeCoCClient()
}

/**
 * Get client with automatic re-authentication on 403 errors
 */
export const getClientWithRetry = async () => {
  try {
    const cocClient = await initializeCoCClient()
    return cocClient
  } catch (error) {
    // If authentication fails, try once more
    if (error.message && (error.message.includes('403') || error.message.includes('Forbidden') || error.message.includes('Unauthorized'))) {
      logger.warn('🔄 Authentication failed, attempting re-authentication...')
      return await forceReauthenticate()
    }
    throw error
  }
}

/**
 * Fetch clan details by clan tag
 * @param {string} clanTag - Clan tag (with or without #)
 * @returns {Promise<Object>} Clan data
 */
export const getClanDetails = async (clanTag) => {
  const formattedTag = clanTag.startsWith('#') ? clanTag : `#${clanTag}`
  const cacheKey = `clan:${formattedTag}`

  // Check cache first (memory + DB)
  const cached = await cacheService.getAsync(cacheKey)
  if (cached) {
    return cached
  }
  try {
    const cocClient = await initializeCoCClient()

    if (!cocClient) {
      throw new Error('CoC API client not initialized')
    }

    const clan = await cocClient.getClan(formattedTag)

    // Find the leader from the member list
    const leader = clan.members?.find(member => member.role === 'leader')

    // Extract badge URLs - Badge class has small, medium, large properties
    const badgeUrls = {
      small: clan.badge?.small || '',
      medium: clan.badge?.medium || '',
      large: clan.badge?.large || '',
    }

    // Extract member list with relevant details
    const memberList = clan.members?.map(member => ({
      name: member.name,
      tag: member.tag,
      role: member.role,
      expLevel: member.expLevel || 0,
      townHallLevel: member.townHallLevel || 0,
      trophies: member.trophies || 0,
      clanRank: member.clanRank || 0,
      donations: member.donations || 0,
      donationsReceived: member.donationsReceived || 0,
    })) || []

    // Sort members by TH level in descending order (highest first)
    memberList.sort((a, b) => (b.townHallLevel || 0) - (a.townHallLevel || 0))

    // Calculate TH composition
    const thComposition = memberList.length > 0 ? calculateTHComposition(memberList) : {}

    const clanData = {
      tag: clan.tag,
      name: clan.name,
      description: clan.description || 'No description available',
      type: clan.type, // open, inviteOnly, closed
      location: clan.location ? {
        id: clan.location.id,
        name: clan.location.name,
        isCountry: clan.location.isCountry,
        countryCode: clan.location.countryCode
      } : null,
      badgeUrls: badgeUrls,
      clanLevel: clan.level || 0,
      clanCapitalLevel: clan.clanCapital?.capitalHallLevel || 0,
      clanPoints: clan.points || 0,
      clanVersusPoints: clan.builderBasePoints || 0,
      warWins: clan.warWins || 0,
      warWinStreak: clan.warWinStreak || 0,
      warLeague: clan.warLeague ? {
        id: clan.warLeague.id,
        name: clan.warLeague.name
      } : null,
      members: clan.memberCount || 0,
      memberList: memberList,
      thComposition: thComposition,
      leader: leader ? {
        name: leader.name,
        tag: leader.tag,
        trophies: leader.trophies || 0,
        townHallLevel: leader.townHallLevel || 0,
        expLevel: leader.expLevel || 0,
      } : null,
      requiredTrophies: clan.requiredTrophies || 0,
      requiredTownHallLevel: clan.requiredTownHallLevel || 1,
      warFrequency: clan.warFrequency || 'unknown',
      isWarLogPublic: clan.isWarLogPublic || false,
    }

    // Cache the result (memory + DB)
    await cacheService.setAsync(cacheKey, clanData, CACHE_TTL.CLAN_BASIC)

    return clanData
  } catch (error) {
    logger.error(`[API ERROR] Error fetching clan ${clanTag}:`, error.message)
    throw error
  }
}

/**
 * Fetch multiple clans with intelligent batching
 * @param {Array<string>} clanTags - Array of clan tags
 * @returns {Promise<Array<Object>>} Array of clan data
 */
export const getMultipleClans = async (clanTags) => {
  try {
    // Filter out invalid tags
    const validTags = clanTags.filter(tag => tag && tag !== '#YOUR_CLAN_TAG')

    if (validTags.length === 0) {
      return []
    }

    // Process in batches to avoid overwhelming the API
    const results = []
    for (let i = 0; i < validTags.length; i += REQUEST_POOL_SIZE) {
      const batch = validTags.slice(i, i + REQUEST_POOL_SIZE)

      const batchPromises = batch.map(tag =>
        getClanDetails(tag).catch(error => {
          return null
        })
      )

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)

      // Small delay between batches to be nice to the API
      if (i + REQUEST_POOL_SIZE < validTags.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    // Remove null values (failed requests)
    const finalResults = results.filter(Boolean)
    return finalResults
  } catch (error) {
    throw error
  }
}

/**
 * Get current war information for a clan
 * @param {string} clanTag - Clan tag
 * @returns {Promise<Object>} Current war data
 */
export const getCurrentWar = async (clanTag) => {
  const formattedTag = clanTag.startsWith('#') ? clanTag : `#${clanTag}`
  const cacheKey = `war:${formattedTag}`

  // Check memory cache only (no database storage for regular wars)
  const cached = cacheService.get(cacheKey)
  if (cached) {
    return cached
  }

  try {
    const cocClient = await initializeCoCClient()

    if (!cocClient) {
      throw new Error('CoC API client not initialized')
    }
    const war = await cocClient.getClanWar(formattedTag)

    // If not in war, return minimal data
    if (war.state === 'notInWar') {
      return {
        state: 'notInWar'
      }
    }

    // Format the war data to ensure consistent structure
    // According to clashofclans.js WarClan class documentation:
    // - badge (not badgeUrls) with small, medium, large properties
    // - destruction (not destructionPercentage)
    // - attackCount (not attacks)
    // - level (not clanLevel)
    const formattedWar = {
      state: war.state || 'unknown',
      teamSize: war.teamSize || 0,
      preparationStartTime: war.preparationStartTime || null,
      startTime: war.startTime || null,
      endTime: war.endTime || null,
      clan: war.clan ? {
        tag: war.clan.tag || '',
        name: war.clan.name || 'Unknown',
        badgeUrls: {
          small: war.clan.badge?.small || '',
          medium: war.clan.badge?.medium || '',
          large: war.clan.badge?.large || '',
        },
        clanLevel: war.clan.level || 0,
        attacks: war.clan.attackCount || 0,
        stars: war.clan.stars || 0,
        destructionPercentage: war.clan.destruction || 0,
        members: war.clan.members || []
      } : null,
      opponent: war.opponent ? {
        tag: war.opponent.tag || '',
        name: war.opponent.name || 'Unknown',
        badgeUrls: {
          small: war.opponent.badge?.small || '',
          medium: war.opponent.badge?.medium || '',
          large: war.opponent.badge?.large || '',
        },
        clanLevel: war.opponent.level || 0,
        attacks: war.opponent.attackCount || 0,
        stars: war.opponent.stars || 0,
        destructionPercentage: war.opponent.destruction || 0,
        members: war.opponent.members || []
      } : null
    }

    // Cache the result in memory only (no database storage for regular wars)
    cacheService.set(cacheKey, formattedWar, CACHE_TTL.CLAN_WAR)

    return formattedWar
  } catch (error) {
    console.error(`Error fetching war data for clan ${clanTag}:`, error.message)
    throw error
  }
}

/**
 * Get clan war log
 * @param {string} clanTag - Clan tag
 * @returns {Promise<Array>} War log data
 */
export const getWarLog = async (clanTag) => {
  const formattedTag = clanTag.startsWith('#') ? clanTag : `#${clanTag}`
  const cacheKey = `warlog:${formattedTag}`

  // Check cache first
  const cached = cacheService.get(cacheKey)
  if (cached) {
    return cached
  }

  try {
    const cocClient = await initializeCoCClient()

    if (!cocClient) {
      throw new Error('CoC API client not initialized')
    }
    const warLog = await cocClient.getClanWarLog(formattedTag)

    // Format war log according to WarLogClan structure
    // Properties: name, tag, badge, level, stars, destruction, expEarned, attackCount
    const formattedWarLog = (warLog || []).map(war => ({
      result: war.result || 'unknown',
      endTime: war.endTime || null,
      teamSize: war.teamSize || 0,
      clan: war.clan ? {
        name: war.clan.name || 'Unknown',
        tag: war.clan.tag || '',
        badgeUrls: {
          small: war.clan.badge?.small || '',
          medium: war.clan.badge?.medium || '',
          large: war.clan.badge?.large || '',
        },
        level: war.clan.level || 0,
        stars: war.clan.stars || 0,
        destruction: war.clan.destruction || 0,
        expEarned: war.clan.expEarned || 0,
        attackCount: war.clan.attackCount || 0
      } : null,
      opponent: war.opponent ? {
        name: war.opponent.name || 'Unknown',
        tag: war.opponent.tag || '',
        badgeUrls: {
          small: war.opponent.badge?.small || '',
          medium: war.opponent.badge?.medium || '',
          large: war.opponent.badge?.large || '',
        },
        level: war.opponent.level || 0,
        stars: war.opponent.stars || 0,
        destruction: war.opponent.destruction || 0,
        expEarned: war.opponent.expEarned,
        attackCount: war.opponent.attackCount
      } : null
    }))

    // Cache the result
    cacheService.set(cacheKey, formattedWarLog, CACHE_TTL.CLAN_WAR_LOG)

    return formattedWarLog
  } catch (error) {
    console.error(`Error fetching war log for clan ${clanTag}:`, error.message)
    throw error
  }
}

// Capital Raids functionality removed - not needed for Trinity

/**
 * Format war members with full attack stats (shared utility function)
 * @param {Object} warClan - War clan object with members
 * @param {Object} opponentClan - Opponent clan object with members (for mirror rule checking)
 * @returns {Array} Formatted member array
 */
const formatWarMembers = (warClan, opponentClan = null) => {
  if (!warClan || !warClan.members) return []
  
  // Pre-calculate positions and attacks for mirror rule checking
  const sortedMembers = [...warClan.members].sort((a, b) => (a.mapPosition || 0) - (b.mapPosition || 0))
  const sortedOpponents = opponentClan?.members ? [...opponentClan.members].sort((a, b) => (a.mapPosition || 0) - (b.mapPosition || 0)) : []
  
  // Create position maps for O(1) lookup
  const memberPosMap = new Map()
  sortedMembers.forEach((m, idx) => {
    memberPosMap.set(m.tag?.replace('#', '').toUpperCase() || '', idx + 1)
  })
  
  const opponentPosMap = new Map()
  sortedOpponents.forEach((m, idx) => {
    opponentPosMap.set(m.tag?.replace('#', '').toUpperCase() || '', idx + 1)
  })
  
  // Collect all attacks with positions for reverse mirror checking
  const allAttacksWithPositions = []
  sortedMembers.forEach(m => {
    const attackerPos = memberPosMap.get(m.tag?.replace('#', '').toUpperCase() || '')
    ;(m.attacks || []).forEach(a => {
      allAttacksWithPositions.push({
        ...a,
        attackerTag: m.tag,
        attackerPos
      })
    })
  })
  
  return warClan.members.map(member => {
    const attackerPos = memberPosMap.get(member.tag?.replace('#', '').toUpperCase() || '')
    
    return {
      tag: member.tag || '',
      name: member.name || '',
      townHallLevel: member.townHallLevel || 0,
      mapPosition: member.mapPosition || 0,
      attacks: member.attacks?.map((attack) => {
        const defenderTag = attack.defenderTag?.replace('#', '').toUpperCase() || ''
        const defenderPos = opponentPosMap.get(defenderTag)
        
        // Check mirror rule compliance
        let isMirrorAttack = false
        if (attackerPos && defenderPos) {
          // Direct mirror: positions match
          if (attackerPos === defenderPos) {
            isMirrorAttack = true
          } else if (attack.order) {
            // Reverse mirror: Check if current attacker is RESPONDING to a broken rule
            // Find rule-breaker who attacked BEFORE (lower order) and broke the mirror rule
            const currentAttackOrder = attack.order
            const hasReverseMirror = allAttacksWithPositions.some(otherAttack => {
              // Must be a different attack that happened before
              if (!otherAttack.order || otherAttack.order >= currentAttackOrder) return false
              
              // Rule-breaker must be at position matching current defender's position
              if (otherAttack.attackerPos !== defenderPos) return false
              
              // Rule-breaker must have attacked a defender at current attacker's position
              const otherDefenderTag = otherAttack.defenderTag?.replace('#', '').toUpperCase() || ''
              const otherDefenderPos = opponentPosMap.get(otherDefenderTag)
              return otherDefenderPos === attackerPos
            })
            
            if (hasReverseMirror) {
              isMirrorAttack = true
            }
          }
        }
        
        return {
          attackerTag: attack.attackerTag || '',
          defenderTag: attack.defenderTag || '',
          stars: attack.stars || 0,
          destructionPercentage: attack.destructionPercentage ?? attack.destruction ?? attack.destructionPercent ?? 0,
          order: attack.order || 0,
          duration: attack.duration || 0,
          isMirrorAttack // Add mirror rule flag
        }
      }) || [],
      opponentAttacks: member.opponentAttacks || 0,
      bestOpponentAttack: member.bestOpponentAttack ? {
        attackerTag: member.bestOpponentAttack.attackerTag || '',
        stars: member.bestOpponentAttack.stars || 0,
        destructionPercentage: member.bestOpponentAttack.destructionPercentage || 0
      } : null
    }
  })
}

/**
 * Determine round for a war tag from CWL group
 * @param {Object} cwlGroup - CWL group object
 * @param {string} warTag - War tag to find round for
 * @returns {number|null} Round number or null
 */
const getRoundForWarTag = (cwlGroup, warTag) => {
  if (!cwlGroup?.rounds || !warTag) return null
  for (const round of cwlGroup.rounds) {
    if (round.warTags && round.warTags.includes(warTag)) {
      return round.round
    }
  }
  return null
}

/**
 * Get CWL group data for a clan
 * @param {string} clanTag - Clan tag
 * @returns {Promise<Object>} CWL group data with structure:
 *   - rounds: array of round objects, each containing:
 *     - round: round number (1-7)
 *     - warTags: array of war tag strings (4 wars per round in 8-clan groups)
 *       Example: ['#ABC123', '#DEF456', '#GHI789', '#JKL012']
 */
export const getCWLGroup = async (clanTag) => {
  const formattedTag = clanTag.startsWith('#') ? clanTag : `#${clanTag}`

  // Check database first (cwlGroups collection)
  if (isDatabaseConnected()) {
    try {
      // Try to get the latest group for this clan (by season, most recent first)
      const dbGroup = await databaseService.findOne('cwlGroups',
        { clanTag: formattedTag },
        { sort: { season: -1 } }
      )

      if (dbGroup) {
        // Remove MongoDB metadata
        const { _id, createdAt, updatedAt, ...groupData } = dbGroup

        // Ensure clanName is set if not present (for backward compatibility)
        if (!groupData.clanName && groupData.clans) {
          const formattedTagNormalized = normalizeTagForComparison(formattedTag)
          const requestingClan = groupData.clans.find(clan => 
            normalizeTagForComparison(clan.tag) === formattedTagNormalized
          )
          if (requestingClan?.name) {
            groupData.clanName = requestingClan.name
          }
        }

        // Backfill league fields if missing (for backward compatibility with old records)
        // Migrate old leagueName to matchedLeague if present
        if (groupData.leagueName && !groupData.matchedLeague) {
          groupData.matchedLeague = groupData.leagueName
        }
        
        // Track if we need to update the database
        let needsUpdate = false
        const formattedTagNormalized = normalizeTagForComparison(formattedTag)
        
        // Backfill initialLeague if missing (allow "Unranked" as valid value)
        if (!groupData.initialLeague && isDatabaseConnected()) {
          try {
            const { getCWLClanDetails } = await import('./clanManagementService.js')
            const cwlDetails = await getCWLClanDetails()
            const clanDetail = cwlDetails.find(detail => 
              normalizeTagForComparison(detail.tag) === formattedTagNormalized
            )
            if (clanDetail?.league) {
              groupData.initialLeague = clanDetail.league
              needsUpdate = true
            }
          } catch (error) {
            // Silently fail
          }
        }
        
        // Backfill matchedLeague if missing - always get from API's warLeague value
        if (!groupData.matchedLeague || groupData.matchedLeague === '') {
          try {
            const clanDetails = await getClanDetails(formattedTag)
            if (clanDetails?.warLeague?.name) {
              const parsedLeague = parseLeagueName(clanDetails.warLeague.name)
              if (parsedLeague) {
                groupData.matchedLeague = parsedLeague // Store warLeague value as matchedLeague
                needsUpdate = true
              }
            }
          } catch (error) {
            // If API fetch fails and initialLeague is not "Unranked", use initialLeague as fallback
            if (groupData.initialLeague && groupData.initialLeague.toLowerCase() !== 'unranked') {
              groupData.matchedLeague = groupData.initialLeague
              needsUpdate = true
            }
            // Silently fail otherwise
          }
        }
        
        // Always ensure all three league fields exist (use empty string if no value, never null)
        const originalInitialLeague = groupData.initialLeague || ''
        const originalMatchedLeague = groupData.matchedLeague || ''
        const originalFinalLeague = groupData.finalLeague || ''
        
        groupData.initialLeague = originalInitialLeague
        groupData.matchedLeague = originalMatchedLeague
        groupData.finalLeague = originalFinalLeague
        
        // Only update database if data changed or if we backfilled fields
        if (needsUpdate || !originalInitialLeague || !originalMatchedLeague) {
          await databaseService.upsert('cwlGroups',
            { clanTag: formattedTag, season: groupData.season },
            groupData
          )
        }

        return groupData
      }
    } catch (error) {
      // Error retrieving from database, continue to API fetch
    }
  }

  try {
    const cocClient = await initializeCoCClient()

    if (!cocClient) {
      throw new Error('CoC API client not initialized')
    }

    const cwlGroup = await cocClient.getClanWarLeagueGroup(formattedTag)

    if (!cwlGroup) {
      const notInWarData = {
        clanTag: formattedTag,
        state: 'notInWar',
        season: null,
        clans: [],
        rounds: []
      }
      // Store not-in-war status in database
      if (isDatabaseConnected()) {
        await databaseService.upsert('cwlGroups',
          { clanTag: formattedTag, season: null },
          notInWarData
        )
      }
      return notInWarData
    }

    // Find the clan name for the requesting clan
    const formattedTagNormalized = normalizeTagForComparison(formattedTag)
    const requestingClan = cwlGroup.clans?.find(clan => 
      normalizeTagForComparison(clan.tag) === formattedTagNormalized
    )
    const clanName = requestingClan?.name || null

    // Get league states for historical tracking:
    // - initialLeague: League before matching (from cwlClans or previous season)
    // - matchedLeague: League when matched (current warLeague during active CWL)
    let initialLeague = null
    let matchedLeague = null
    
    // Fetch clan details once (used for both matchedLeague and potentially other data)
    let clanDetails = null
    try {
      clanDetails = await getClanDetails(formattedTag)
    } catch (error) {
      // Will handle error later
    }
    
    // Get initial league (before matching) from cwlClans collection or previous season
    // Allow "Unranked" as a valid value for initialLeague
    if (isDatabaseConnected()) {
      try {
        const { getCWLClanDetails } = await import('./clanManagementService.js')
        const cwlDetails = await getCWLClanDetails()
        const clanDetail = cwlDetails.find(detail => 
          normalizeTagForComparison(detail.tag) === formattedTagNormalized
        )
        if (clanDetail?.league) {
          initialLeague = clanDetail.league
        }
      } catch (error) {
        // Silently fail
      }
      
      // If no initial league from cwlClans, try to get from previous season's final league
      // Allow "Unranked" as a valid value
      if (!initialLeague) {
        try {
          const previousGroup = await databaseService.findOne('cwlGroups',
            { clanTag: formattedTag },
            { sort: { season: -1 } }
          )
          if (previousGroup?.finalLeague) {
            initialLeague = previousGroup.finalLeague
          }
        } catch (error) {
          // Silently fail
        }
      }
    }
    
    // Get matched league (current league during active CWL)
    // Always get matchedLeague from API's warLeague value
    // If initialLeague is not "Unranked", matchedLeague should be same as initialLeague (but still update from API)
    // If initialLeague is "Unranked", get matchedLeague from API (clan's league on 2nd of CWL month)
    if (clanDetails?.warLeague?.name) {
      const parsedLeague = parseLeagueName(clanDetails.warLeague.name)
      if (parsedLeague) {
        matchedLeague = parsedLeague // Store warLeague value as matchedLeague
      }
    } else if (initialLeague && initialLeague.toLowerCase() !== 'unranked') {
      // If API fetch failed and initialLeague is not "Unranked", use initialLeague as fallback
      matchedLeague = initialLeague
    }

    // Format the CWL group data - Include ALL available fields
    const formattedGroup = {
      clanTag: formattedTag,
      clanName: clanName, // Add clan name for the requesting clan
      state: cwlGroup.state || 'unknown',
      season: cwlGroup.season || null,
      isNotInWar: cwlGroup.isNotInWar || false,
      totalRounds: cwlGroup.totalRounds || 0,
      shareLink: cwlGroup.shareLink || null, // Group shareLink if available
      clans: cwlGroup.clans?.map(clan => {
        // Include ALL ClanWarLeagueClan fields
        return {
          tag: clan.tag || '',
          name: clan.name || 'Unknown',
          level: clan.level || 0,
          badgeUrls: {
            small: clan.badge?.small || '',
            medium: clan.badge?.medium || '',
            large: clan.badge?.large || '',
          },
          shareLink: clan.shareLink || null, // ClanWarLeagueClan shareLink
          members: clan.members?.map(member => {
            // Include ALL ClanWarLeagueClanMember fields
            return {
              name: member.name || '',
              tag: member.tag || '',
              townHallLevel: member.townHallLevel || 0,
              shareLink: member.shareLink || null // Member shareLink
            }
          }) || []
        }
      }) || [],
      rounds: cwlGroup.rounds?.map(round => {
        // Include ALL ClanWarLeagueRound fields
        // Reference: https://clashofclans.js.org/docs/api/interfaces/APIClanWarLeagueRound#wartags
        // warTags: string[] - Array of war tag identifiers for wars in this round
        return {
          round: round.round || 0,
          warTags: round.warTags || [] // Array of war tag strings from APIClanWarLeagueRound
        }
      }) || []
    }

    // Always store all three league fields (use empty string if no value, never null)
    formattedGroup.initialLeague = initialLeague || ''
    formattedGroup.matchedLeague = matchedLeague || ''
    formattedGroup.finalLeague = '' // Will be set when CWL ends and ranks are finalized

    // Store directly in database (cwlGroups collection)
    if (isDatabaseConnected()) {
      await databaseService.upsert('cwlGroups',
        { clanTag: formattedTag, season: formattedGroup.season },
        formattedGroup
      )
    }

    return formattedGroup
  } catch (error) {
    // If error, return not in war status
    const errorData = {
      clanTag: formattedTag,
      state: 'notInWar',
      season: null,
      clans: [],
      rounds: [],
      error: error.message
    }
    return errorData
  }
}

/**
 * Get all CWL wars from all rounds for ALL clans in the group
 * This fetches wars by war tags from all rounds, not just wars for one clan
 * @param {string} clanTag - Clan tag (to get the CWL group)
 * @param {Object} cwlGroup - Optional: Pre-fetched CWL group to avoid duplicate API calls
 * @returns {Promise<Array>} All CWL wars from all rounds for all clans
 */
export const getAllCWLWars = async (clanTag, cwlGroup = null) => {
  const formattedTag = clanTag.startsWith('#') ? clanTag : `#${clanTag}`

  // Strategy: Use database for recent wars (updated in last 2 minutes), fetch from API for missing/old wars
  // This reduces API calls and avoids rate limiting while still getting fresh data
  let warsFromDB = []
  const RECENT_THRESHOLD_MS = 2 * 60 * 1000 // 2 minutes
  const now = new Date()
  const recentThresholdDate = new Date(now.getTime() - RECENT_THRESHOLD_MS)
  
  if (isDatabaseConnected()) {
    try {
      // Optimize: Query database with filters instead of fetching all and filtering in memory
      // Get completed wars (always use) OR recent active wars (updated in last 2 minutes)
      const dbWars = await databaseService.find('cwlWars',
        {
          clanTag: formattedTag,
          $or: [
            { state: 'warEnded' }, // Completed wars - always use
            { 
              state: { $in: ['inWar', 'preparation'] },
              updatedAt: { $gte: recentThresholdDate } // Recent active wars only
            }
          ]
        },
        { sort: { startTime: -1 } }
      )

      if (dbWars && dbWars.length > 0) {
        // Remove MongoDB metadata from each war
        warsFromDB = dbWars.map(war => {
          const { _id, createdAt, updatedAt, ...warData } = war
          return warData
        })
      }
    } catch (error) {
      // Error retrieving from database, continue to API fetch
    }
  }

  try {
    let cwlGroupData = cwlGroup
    
    // Only fetch CWL group from API if not provided
    if (!cwlGroupData) {
      const cocClient = await initializeCoCClient()

      if (!cocClient) {
        throw new Error('CoC API client not initialized')
      }

      cwlGroupData = await cocClient.getClanWarLeagueGroup(formattedTag)

      if (!cwlGroupData || cwlGroupData.isNotInWar) {
        return []
      }
    } else if (cwlGroupData.isNotInWar) {
      return []
    }

    // Get all war tags from all rounds
    const allWarTags = []
    if (cwlGroupData.rounds && Array.isArray(cwlGroupData.rounds)) {
      cwlGroupData.rounds.forEach(round => {
        if (round.warTags && Array.isArray(round.warTags)) {
          round.warTags.forEach(warTag => {
            // Filter out invalid war tags
            if (warTag && warTag !== '#0' && warTag !== '0' && warTag !== '' && !allWarTags.includes(warTag)) {
              allWarTags.push(warTag)
            }
          })
        }
      })
    }

    // Fetch all wars by war tags (for all clans in the group)
    // Use getWars() for each clan to get all wars they're in
    const warsMap = new Map()
    const clans = cwlGroupData.clans || []

    // Check which wars we already have from database
    const existingWarTags = new Set(warsFromDB.map(w => w.warTag).filter(Boolean))
    
    // Fetch wars for each clan to get all wars in the group
    // Add delays between API calls to avoid rate limiting
    for (let i = 0; i < clans.length; i++) {
      const clan = clans[i]
      
      // Add delay between API calls (except first one) to avoid rate limiting
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 500)) // 500ms delay
      }
      
      try {
        const clanWars = await cwlGroupData.getWars(clan.tag)
        if (clanWars && Array.isArray(clanWars)) {
          clanWars.forEach(war => {
            // Create a unique key for deduplication
            // Use war tag if available (most reliable)
            let warKey = war.tag

            // If no war tag, create a consistent key using sorted clan tags + start time
            // This ensures the same war has the same key regardless of which clan we fetch it from
            if (!warKey && war.clan && war.opponent && war.startTime) {
              const clanTags = [war.clan.tag, war.opponent.tag].sort()
              warKey = `${clanTags[0]}_${clanTags[1]}_${war.startTime}`
            }

            // Fallback: use start time only if available
            if (!warKey && war.startTime) {
              warKey = `war_${war.startTime}`
            }

            // Only add if we have a valid key and haven't seen this war before
            if (warKey && !warsMap.has(warKey)) {
              warsMap.set(warKey, war)
            }
          })
        }
      } catch (err) {
        // Skip if we can't fetch wars for this clan
      }
    }

    // Convert map to array
    let allWars = Array.from(warsMap.values())

    // CRITICAL FIX: Match wars with their warTags from rounds
    // Since getWars() doesn't return war.tag, we need to manually match wars with round warTags
    const warsWithTagsMap = new Map()
    const usedWarKeys = new Set()


    // Helper function to extract date from startTime (ignore time, only date matters for rounds)
    const getDateFromStartTime = (startTime) => {
      if (!startTime) return null
      const date = new Date(startTime)
      // Return YYYY-MM-DD format for comparison
      return date.toISOString().split('T')[0]
    }

    // FIRST: Group all wars by their date to identify which wars belong to the same round
    const warsByDate = new Map()
    allWars.forEach(war => {
      if (war.startTime) {
        const date = getDateFromStartTime(war.startTime)
        if (date) {
          if (!warsByDate.has(date)) {
            warsByDate.set(date, [])
          }
          warsByDate.get(date).push(war)
        }
      }
    })


    // SECOND: Match wars to their rounds based on date grouping
    // Optimize: Pre-group wars by date for O(1) lookup instead of O(n) search
    const warsByDateMap = new Map()
    allWars.forEach(war => {
      if (war.startTime) {
        const date = getDateFromStartTime(war.startTime)
        if (date) {
          if (!warsByDateMap.has(date)) {
            warsByDateMap.set(date, [])
          }
          warsByDateMap.get(date).push(war)
        }
      }
    })
    
    // Match wars to rounds using pre-grouped date map
    if (cwlGroupData.rounds && Array.isArray(cwlGroupData.rounds)) {
      cwlGroupData.rounds.forEach((round, roundIdx) => {
        if (round.warTags && Array.isArray(round.warTags)) {
          // Find the date for this round by examining first unmapped war
          let roundDate = null
          let roundWars = []

          // Find round date from first available war
          for (const war of allWars) {
            if (!war.clan || !war.opponent) continue
            const clanTags = [war.clan.tag, war.opponent.tag].sort()
            const warKey = `${clanTags[0]}_${clanTags[1]}_${war.startTime}`
            if (!usedWarKeys.has(warKey) && round.warTags.length > 0) {
              roundDate = getDateFromStartTime(war.startTime)
              break
            }
          }

          // If we found a date, get all wars for that date from pre-grouped map
          if (roundDate && warsByDateMap.has(roundDate)) {
            const dateWars = warsByDateMap.get(roundDate)
            
            for (const war of dateWars) {
              if (!war.clan || !war.opponent) continue
              if (round.warTags.length <= roundWars.length) break

              const clanTags = [war.clan.tag, war.opponent.tag].sort()
              const warKey = `${clanTags[0]}_${clanTags[1]}_${war.startTime}`

              // If this war hasn't been matched yet
              if (!usedWarKeys.has(warKey)) {
                const warTag = round.warTags[roundWars.length]
                const warWithTag = { ...war, tag: warTag, warTag: warTag }
                warsWithTagsMap.set(warKey, warWithTag)
                usedWarKeys.add(warKey)
                roundWars.push(warWithTag)
              }
            }
          }
        }
      })
    }

    // Use wars with tags if we matched any, otherwise use original wars
    if (warsWithTagsMap.size > 0) {
      allWars = Array.from(warsWithTagsMap.values())
    }

    // Fallback: if no wars found, try getting wars for the specified clan
    if (allWars.length === 0 && cwlGroupData) {
      const clanWars = await cwlGroupData.getWars(formattedTag)
      if (clanWars && Array.isArray(clanWars)) {
        allWars = clanWars
      }
    }

    if (!allWars || allWars.length === 0) {
      return []
    }

    // Format the war data - Include ALL attack stats and member details
    const formattedWars = allWars.map(war => {
      return {
        warTag: war.tag || null,
        state: war.state || 'unknown',
        teamSize: war.teamSize || 0,
        preparationStartTime: war.preparationStartTime || null,
        startTime: war.startTime || null,
        endTime: war.endTime || null,
        clan: war.clan ? {
          tag: war.clan.tag || '',
          name: war.clan.name || 'Unknown',
          badgeUrls: {
            small: war.clan.badge?.small || '',
            medium: war.clan.badge?.medium || '',
            large: war.clan.badge?.large || '',
          },
          clanLevel: war.clan.level || 0,
          attacks: war.clan.attackCount || 0,
          stars: war.clan.stars || 0,
          destructionPercentage: war.clan.destruction || 0,
          expEarned: war.clan.expEarned || 0,
          members: formatWarMembers(war.clan, war.opponent)
        } : null,
        opponent: war.opponent ? {
          tag: war.opponent.tag || '',
          name: war.opponent.name || 'Unknown',
          badgeUrls: {
            small: war.opponent.badge?.small || '',
            medium: war.opponent.badge?.medium || '',
            large: war.opponent.badge?.large || '',
          },
          clanLevel: war.opponent.level || 0,
          attacks: war.opponent.attackCount || 0,
          stars: war.opponent.stars || 0,
          destructionPercentage: war.opponent.destruction || 0,
          expEarned: war.opponent.expEarned || 0,
          members: formatWarMembers(war.opponent, war.clan)
        } : null
      }
    })

    // Store each war individually in database (cwlWars collection)
    // Always store active wars to keep database updated with latest attack/stars data
    // Optimized: Get CWL group once and batch operations
    if (isDatabaseConnected() && formattedWars.length > 0) {
      // Get CWL group once to determine rounds for all wars (use provided or fetch)
      let cwlGroupForRounds = cwlGroupData
      if (!cwlGroupForRounds) {
        try {
          cwlGroupForRounds = await getCWLGroup(formattedTag)
        } catch (err) {
          // Ignore errors when trying to get group info
        }
      }

      // Batch database operations (parallel upserts)
      // Store ALL wars (both active and completed) to keep database updated
      const upsertPromises = formattedWars
        .filter(war => war.warTag) // Only process wars with valid tags
        .map(war => {
          const warWithMetadata = {
            ...war,
            clanTag: formattedTag,
            round: getRoundForWarTag(cwlGroupForRounds, war.warTag) // Use optimized helper
          }

          return databaseService.upsert('cwlWars',
            { warTag: war.warTag },
            warWithMetadata
          )
        })

      // Execute all upserts in parallel
      await Promise.all(upsertPromises)
    }

    // Merge wars: Use API wars for missing/old wars, keep DB wars for recent ones
    // This ensures we have all wars while minimizing API calls
    const apiWarTags = new Set(formattedWars.map(w => w.warTag).filter(Boolean))
    const dbWarsToKeep = warsFromDB.filter(w => {
      // Keep DB wars that aren't in API results (they're recent and valid)
      return w.warTag && !apiWarTags.has(w.warTag)
    })
    
    // Combine: API wars (fresh) + DB wars (recent ones not in API)
    const mergedWars = [...formattedWars, ...dbWarsToKeep]
    
    return mergedWars
  } catch (error) {
    console.error(`Error fetching all CWL wars for clan ${clanTag}:`, error.message)
    
    // If rate limited, use database wars as fallback (even if slightly stale)
    if (error.message && error.message.includes('throttling')) {
      if (warsFromDB.length > 0) {
        return warsFromDB
      }
    }
    
    // Return database wars even if API fetch fails
    return warsFromDB
  }
}

/**
 * Get CWL war details by war tag
 * @param {string} warTag - War tag (with or without #)
 * @param {string} clanTag - Clan tag (required to get CWL group)
 * @returns {Promise<Object>} War details
 */
export const getCWLWarByTag = async (warTag, clanTag) => {
  const formattedWarTag = warTag.startsWith('#') ? warTag : `#${warTag}`
  const formattedClanTag = clanTag && clanTag.startsWith('#') ? clanTag : `#${clanTag}`

  // Check database first (cwlWars collection)
  if (isDatabaseConnected()) {
    try {
      const dbWar = await databaseService.findOne('cwlWars', { warTag: formattedWarTag })

      if (dbWar) {
        // Remove MongoDB metadata
        const { _id, createdAt, updatedAt, ...warData } = dbWar
        return warData
      }
    } catch (error) {
      // Error retrieving from database, continue to API fetch
    }
  }

  if (!clanTag) {
    throw new Error('Clan tag is required to fetch CWL war by war tag')
  }

  try {
    const cocClient = await initializeCoCClient()

    if (!cocClient) {
      throw new Error('CoC API client not initialized')
    }

    // Use getAllCWLWars to get wars with their warTags already attached
    const allWarsWithTags = await getAllCWLWars(formattedClanTag)

    if (!allWarsWithTags || allWarsWithTags.length === 0) {
      throw new Error('No wars found in CWL group')
    }

    // Find the war by war tag
    const war = allWarsWithTags.find(w => {
      const warTagFromWar = w.warTag || w.tag
      return warTagFromWar === formattedWarTag ||
        warTagFromWar === warTag ||
        warTagFromWar === warTag.replace('#', '') ||
        warTagFromWar === formattedWarTag.replace('#', '')
    })

    if (!war) {
      throw new Error(`War with tag ${formattedWarTag} not found in CWL group`)
    }

    // War is already formatted by getAllCWLWars, add metadata and store in database
    const warWithMetadata = {
      ...war,
      clanTag: formattedClanTag,
      round: null // Will be set if we can determine it
    }

    // Try to determine round from CWL group
    try {
      const cwlGroup = await getCWLGroup(formattedClanTag)
      if (cwlGroup && cwlGroup.rounds) {
        for (const round of cwlGroup.rounds) {
          if (round.warTags && round.warTags.includes(formattedWarTag)) {
            warWithMetadata.round = round.round
            break
          }
        }
      }
    } catch (err) {
      // Ignore errors when trying to get round info
    }

    // Store directly in database (cwlWars collection)
    if (isDatabaseConnected()) {
      await databaseService.upsert('cwlWars',
        { warTag: formattedWarTag },
        warWithMetadata
      )
    }

    return war
  } catch (error) {
    console.error(`Error fetching CWL war by tag ${warTag}:`, error.message)
    throw error
  }
}

/**
 * Get current CWL wars for a clan (last 2)
 * @param {string} clanTag - Clan tag
 * @param {Object} cwlGroup - Optional: Pre-fetched CWL group to avoid duplicate API calls
 * @returns {Promise<Array>} Current CWL wars (last 2)
 */
export const getCurrentCWLWars = async (clanTag, cwlGroup = null) => {
  const formattedTag = clanTag.startsWith('#') ? clanTag : `#${clanTag}`

  // For active wars, always fetch from API to get fresh attack/stars data
  // Only use database for completed wars (warEnded state)
  // This ensures we get real-time updates during active wars

  try {
    let cwlGroupData = cwlGroup
    
    // Only fetch CWL group from API if not provided
    if (!cwlGroupData) {
      const cocClient = await initializeCoCClient()

      if (!cocClient) {
        throw new Error('CoC API client not initialized')
      }

      cwlGroupData = await cocClient.getClanWarLeagueGroup(formattedTag)

      if (!cwlGroupData || cwlGroupData.isNotInWar) {
        return []
      }
    } else if (cwlGroupData.isNotInWar) {
      return []
    }

    // Get current wars (last 2)
    const currentWars = await cwlGroupData.getCurrentWars(formattedTag)

    if (!currentWars || currentWars.length === 0) {
      return []
    }

    // Get all wars from all rounds to match war tags
    // We'll use this to find the war tag for each current war
    const allWars = await cwlGroupData.getWars(formattedTag)

    // Get rounds with war tags for matching
    const rounds = cwlGroupData.rounds || []

    // Match current wars with war tags from rounds
    const formattedWars = currentWars.map(war => {
      // Try to find the war tag by matching with wars from all rounds
      // Match by start time, clan tag, and state
      let matchedWarTag = war.tag || null

      if (!matchedWarTag && allWars && allWars.length > 0) {
        const matchedWar = allWars.find(w => {
          // Match by start time (most reliable)
          if (war.startTime && w.startTime && war.startTime === w.startTime) {
            return true
          }
          // Match by preparation start time
          if (war.preparationStartTime && w.preparationStartTime &&
            war.preparationStartTime === w.preparationStartTime) {
            return true
          }
          // Match by clan tag and state
          if (war.clan && w.clan && war.clan.tag === w.clan.tag && war.state === w.state) {
            return true
          }
          // Match by opponent tag and state
          if (war.opponent && w.opponent && war.opponent.tag === w.opponent.tag && war.state === w.state) {
            return true
          }
          return false
        })

        // If we found a match, use its tag (if available)
        if (matchedWar) {
          // War objects from getWars() might have tag property
          matchedWarTag = matchedWar.tag || matchedWar.warTag || null
        }
      }

      // If still no match, try to find from rounds by matching with current round
      if (!matchedWarTag && rounds && rounds.length > 0) {
        // Find current round (usually the one with active wars)
        const currentRound = rounds.find(r => {
          return r.warTags && r.warTags.length > 0 &&
            r.warTags.some(tag => tag !== '#0' && tag !== '0')
        })

        if (currentRound && currentRound.warTags) {
          // For current wars, they're typically in the current round
          // We can't perfectly match without additional info, but we can use the first available war tag
          // This is a fallback - ideally we'd match by war details
          const validWarTags = currentRound.warTags.filter(tag => tag && tag !== '#0' && tag !== '0')
          if (validWarTags.length > 0 && currentWars.indexOf(war) < validWarTags.length) {
            matchedWarTag = validWarTags[currentWars.indexOf(war)]
          }
        }
      }

      return {
        warTag: matchedWarTag,
        state: war.state || 'unknown',
        teamSize: war.teamSize || 0,
        preparationStartTime: war.preparationStartTime || null,
        startTime: war.startTime || null,
        endTime: war.endTime || null,
        clan: war.clan ? {
          tag: war.clan.tag || '',
          name: war.clan.name || 'Unknown',
          badgeUrls: {
            small: war.clan.badge?.small || '',
            medium: war.clan.badge?.medium || '',
            large: war.clan.badge?.large || '',
          },
          clanLevel: war.clan.level || 0,
          attacks: war.clan.attackCount || 0,
          stars: war.clan.stars || 0,
          destructionPercentage: war.clan.destruction || 0,
          expEarned: war.clan.expEarned || 0,
          members: formatWarMembers(war.clan, war.opponent)
        } : null,
        opponent: war.opponent ? {
          tag: war.opponent.tag || '',
          name: war.opponent.name || 'Unknown',
          badgeUrls: {
            small: war.opponent.badge?.small || '',
            medium: war.opponent.badge?.medium || '',
            large: war.opponent.badge?.large || '',
          },
          clanLevel: war.opponent.level || 0,
          attacks: war.opponent.attackCount || 0,
          stars: war.opponent.stars || 0,
          destructionPercentage: war.opponent.destruction || 0,
          expEarned: war.opponent.expEarned || 0,
          members: formatWarMembers(war.opponent, war.clan)
        } : null
      }
    })

    // Store each war directly in database (cwlWars collection)
    // Optimized: Get CWL group once and batch operations
    if (isDatabaseConnected() && formattedWars.length > 0) {
      // Get CWL group once to determine rounds for all wars
      let cwlGroup = null
      try {
        cwlGroup = await getCWLGroup(formattedTag)
      } catch (err) {
        // Ignore errors when trying to get group info
      }

      // Batch database operations (parallel upserts)
      const upsertPromises = formattedWars
        .filter(war => war.warTag) // Only process wars with valid tags
        .map(war => {
          const warWithMetadata = {
            ...war,
            clanTag: formattedTag,
            round: getRoundForWarTag(cwlGroup, war.warTag) // Use optimized helper
          }

          return databaseService.upsert('cwlWars',
            { warTag: war.warTag },
            warWithMetadata
          )
        })

      // Execute all upserts in parallel
      await Promise.all(upsertPromises)
    }

    return formattedWars
  } catch (error) {
    return []
  }
}

