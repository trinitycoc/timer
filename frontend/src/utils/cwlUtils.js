// CWL utility functions

/**
 * Normalize a tag to always have # prefix
 */
export const normalizeTag = (tag) => {
  if (!tag) return null
  return tag.startsWith('#') ? tag : `#${tag}`
}

/**
 * Filter valid war tags (non-zero, non-empty)
 */
export const getValidWarTags = (warTags) => {
  if (!warTags || !Array.isArray(warTags)) return []
  return warTags.filter(tag => tag && tag !== '#0' && tag !== '0')
}

/**
 * Filter wars for a specific day/round
 */
export const filterWarsForDay = (wars, warTags, normalizeFn = normalizeTag) => {
  if (!wars || !Array.isArray(wars) || !warTags || !Array.isArray(warTags)) return []
  
  const validWarTags = getValidWarTags(warTags)
  if (validWarTags.length === 0) return []
  
  const normalizedWarTags = validWarTags.map(normalizeFn)
  
  return wars.filter(war => {
    const warTag = normalizeFn(war.warTag || war.tag)
    return warTag && normalizedWarTags.includes(warTag)
  })
}

/**
 * Sort members by map position (ascending)
 */
export const sortMembersByPosition = (members) => {
  if (!members || !Array.isArray(members)) return []
  return [...members].sort((a, b) => (a.mapPosition || 0) - (b.mapPosition || 0))
}

/**
 * Sort members by town hall level (descending)
 */
export const sortMembersByTH = (members) => {
  if (!members || !Array.isArray(members)) return []
  return [...members].sort((a, b) => (b.townHallLevel || 0) - (a.townHallLevel || 0))
}

/**
 * Format destruction percentage to 2 decimal places
 */
export const formatDestruction = (value) => {
  if (typeof value === 'number') {
    return value.toFixed(2)
  }
  return value || '0.00'
}

/**
 * Calculate CWL leaderboard stats for each clan from wars data
 * Returns an array of clan stats with rank, stars, destruction, record (wins-ties-losses), and members
 * 
 * @deprecated This function is deprecated. Use backend endpoint /cwl/:clanTag/leaderboard instead.
 * This is kept for backward compatibility only.
 */
export const calculateCWLLeaderboard = (clans, wars) => {
  if (!clans || !Array.isArray(clans) || clans.length === 0) return []
  // Allow empty wars array - will show groups with zero stats
  let warsArray = wars && Array.isArray(wars) ? wars : []

  // Deduplicate wars to prevent double-counting stars
  // Same war might appear twice (once from each clan's perspective)
  const warsMap = new Map()
  warsArray.forEach(war => {
    if (!war || !war.clan || !war.opponent) return
    
    // Create unique key for deduplication
    let warKey = war.warTag || war.tag
    
    // If no war tag, use sorted clan tags + start time for consistent key
    if (!warKey && war.clan.tag && war.opponent.tag && war.startTime) {
      const clanTags = [war.clan.tag, war.opponent.tag].sort()
      warKey = `${clanTags[0]}_${clanTags[1]}_${war.startTime}`
    }
    
    // Fallback: use start time
    if (!warKey && war.startTime) {
      warKey = `war_${war.startTime}`
    }
    
    // Only add if we haven't seen this war before
    if (warKey && !warsMap.has(warKey)) {
      warsMap.set(warKey, war)
    }
  })
  
  // Use deduplicated wars
  warsArray = Array.from(warsMap.values())

  // Initialize stats for each clan
  const clanStatsMap = new Map()
  
  clans.forEach(clan => {
    clanStatsMap.set(clan.tag, {
      tag: clan.tag,
      name: clan.name || 'Unknown',
      level: clan.level || 0,
      badgeUrls: clan.badgeUrls || {},
      shareLink: clan.shareLink || null,
      members: clan.members?.length || 0,
      totalStars: 0,
      totalDestruction: 0,
      warCount: 0,
      wins: 0,
      ties: 0,
      losses: 0
    })
  })

  // Process each war to accumulate stats
  warsArray.forEach(war => {
    if (!war || !war.clan || !war.opponent) return

    const clanTag = war.clan.tag
    const opponentTag = war.opponent.tag
    
    const clanStats = clanStatsMap.get(clanTag)
    const opponentStats = clanStatsMap.get(opponentTag)

    // Get team size for calculating actual destruction points
    // Max destruction per round = teamSize * 100 (5v5 = 500, 15v15 = 1500, 30v30 = 3000)
    const teamSize = war.teamSize || 0

    if (clanStats) {
      clanStats.totalStars += war.clan.stars || 0
      // Convert destruction percentage to actual points
      // Formula: (percentage / 100) * (teamSize * 100) = percentage * teamSize
      const clanDestructionPoints = (war.clan.destructionPercentage || 0) * teamSize
      clanStats.totalDestruction += clanDestructionPoints
      clanStats.warCount += 1
    }

    if (opponentStats) {
      opponentStats.totalStars += war.opponent.stars || 0
      // Convert destruction percentage to actual points
      // Formula: (percentage / 100) * (teamSize * 100) = percentage * teamSize
      const opponentDestructionPoints = (war.opponent.destructionPercentage || 0) * teamSize
      opponentStats.totalDestruction += opponentDestructionPoints
      opponentStats.warCount += 1
    }

    // Determine win/loss/tie
    const clanStars = war.clan.stars || 0
    const opponentStars = war.opponent.stars || 0
    const clanDestruction = war.clan.destructionPercentage || 0
    const opponentDestruction = war.opponent.destructionPercentage || 0

    if (clanStats && opponentStats) {
      if (clanStars > opponentStars) {
        clanStats.wins += 1
        opponentStats.losses += 1
      } else if (clanStars < opponentStars) {
        clanStats.losses += 1
        opponentStats.wins += 1
      } else {
        // Tie on stars, check destruction
        if (clanDestruction > opponentDestruction) {
          clanStats.wins += 1
          opponentStats.losses += 1
        } else if (clanDestruction < opponentDestruction) {
          clanStats.losses += 1
          opponentStats.wins += 1
        } else {
          // Complete tie
          clanStats.ties += 1
          opponentStats.ties += 1
        }
      }
    }
  })

  // Convert map to array and calculate average destruction
  const leaderboard = Array.from(clanStatsMap.values()).map(stats => ({
    ...stats,
    averageDestruction: stats.warCount > 0 ? stats.totalDestruction / stats.warCount : 0,
    record: `${stats.wins}-${stats.ties}-${stats.losses}`
  }))

  // Sort by stars (descending), then by destruction (descending)
  leaderboard.sort((a, b) => {
    if (b.totalStars !== a.totalStars) {
      return b.totalStars - a.totalStars
    }
    return b.averageDestruction - a.averageDestruction
  })

  // Add rank
  leaderboard.forEach((stats, index) => {
    stats.rank = index + 1
  })

  return leaderboard
}

/**
 * Get promotion and demotion slots based on league name
 * 
 * @deprecated This function is deprecated. Promotion/demotion calculations are now performed on the backend.
 * This is kept for backward compatibility only. Use backend-provided values when available.
 * 
 * @param {string} leagueName - League name (e.g., "Master I", "Crystal II", "Bronze III")
 * @returns {Object} Object with promotionCount and demotionCount
 */
export const getPromotionDemotionSlots = (leagueName) => {
  if (!leagueName) {
    return { promotionCount: 0, demotionCount: 0 }
  }

  const leagueNameUpper = leagueName.toUpperCase()
  
  // Bronze III: 3 promoted, 0 demoted
  if (leagueNameUpper.includes('BRONZE') && leagueNameUpper.includes('III')) {
    return { promotionCount: 3, demotionCount: 0 }
  }
  
  // Bronze I & II: 3 promoted, 1 demoted
  if (leagueNameUpper.includes('BRONZE') && (leagueNameUpper.includes('I') || leagueNameUpper.includes('II'))) {
    // Check that it's not III (already handled above)
    if (!leagueNameUpper.includes('III')) {
      return { promotionCount: 3, demotionCount: 1 }
    }
  }
  
  // Silver III: 2 promoted, 1 demoted
  if (leagueNameUpper.includes('SILVER') && leagueNameUpper.includes('III')) {
    return { promotionCount: 2, demotionCount: 1 }
  }
  
  // Silver I & II: 2 promoted, 2 demoted
  if (leagueNameUpper.includes('SILVER') && (leagueNameUpper.includes('I') || leagueNameUpper.includes('II'))) {
    if (!leagueNameUpper.includes('III')) {
      return { promotionCount: 2, demotionCount: 2 }
    }
  }
  
  // Gold I, II, III: 2 promoted, 2 demoted
  if (leagueNameUpper.includes('GOLD')) {
    return { promotionCount: 2, demotionCount: 2 }
  }
  
  // Crystal III & II: 2 promoted, 2 demoted
  if (leagueNameUpper.includes('CRYSTAL') && (leagueNameUpper.includes('III') || leagueNameUpper.includes('II'))) {
    return { promotionCount: 2, demotionCount: 2 }
  }
  
  // Crystal I: 1 promoted, 2 demoted
  if (leagueNameUpper.includes('CRYSTAL') && leagueNameUpper.includes('I') && !leagueNameUpper.includes('II') && !leagueNameUpper.includes('III')) {
    return { promotionCount: 1, demotionCount: 2 }
  }
  
  // Master I, II, III: 1 promoted, 2 demoted
  if (leagueNameUpper.includes('MASTER')) {
    return { promotionCount: 1, demotionCount: 2 }
  }
  
  // Champion III & II: 1 promoted, 2 demoted
  if (leagueNameUpper.includes('CHAMPION') && (leagueNameUpper.includes('III') || leagueNameUpper.includes('II'))) {
    return { promotionCount: 1, demotionCount: 2 }
  }
  
  // Champion I: 0 promoted, 3 demoted
  if (leagueNameUpper.includes('CHAMPION') && leagueNameUpper.includes('I') && !leagueNameUpper.includes('II') && !leagueNameUpper.includes('III')) {
    return { promotionCount: 0, demotionCount: 3 }
  }
  
  // No match found: return 0 for both
  return { promotionCount: 0, demotionCount: 0 }
}

/**
 * Check if a rank is in promotion zone
 * 
 * @deprecated This function is deprecated. Promotion/demotion calculations are now performed on the backend.
 * This is kept for backward compatibility only. Use backend-provided values when available.
 * 
 * @param {number} rank - Clan rank (1-8)
 * @param {number} promotionCount - Number of promotion slots
 * @returns {boolean}
 */
export const isPromotionRank = (rank, promotionCount) => {
  return rank <= promotionCount
}

/**
 * Check if a rank is in demotion zone
 * 
 * @deprecated This function is deprecated. Promotion/demotion calculations are now performed on the backend.
 * This is kept for backward compatibility only. Use backend-provided values when available.
 * 
 * @param {number} rank - Clan rank (1-8)
 * @param {number} demotionCount - Number of demotion slots
 * @returns {boolean}
 */
export const isDemotionRank = (rank, demotionCount) => {
  if (demotionCount === 0) return false
  return rank > (8 - demotionCount)
}

/**
 * Get CWL medals per member by league and position (for 8 stars each)
 * 
 * @deprecated This function is deprecated. Medal calculations are now performed on the backend.
 * This is kept for backward compatibility only. Use backend-provided values when available.
 * This function now always returns null as the medal data has been moved to the backend.
 * 
 * @param {string} leagueName - League name (e.g., "Master I", "Crystal II")
 * @param {number} position - Position in leaderboard (1-8)
 * @returns {number|null} Medals per member, or null if not found
 */
export const getCWLMedalsByPosition = (leagueName, position) => {
  // Medal data has been moved to backend - this function is only for backward compatibility
  return null
}

/**
 * Get bonus medals per league
 * 
 * @deprecated This function is deprecated. Medal calculations are now performed on the backend.
 * This is kept for backward compatibility only. Use backend-provided values when available.
 * This function now always returns null as the medal data has been moved to the backend.
 * 
 * @param {string} leagueName - League name (e.g., "Master I", "Crystal II")
 * @returns {number|null} Bonus medals, or null if not found
 */
export const getCWLBonusMedals = (leagueName) => {
  // Medal data has been moved to backend - this function is only for backward compatibility
  return null
}

/**
 * Get base number of bonuses per league
 * 
 * @deprecated This function is deprecated. Medal calculations are now performed on the backend.
 * This is kept for backward compatibility only. Use backend-provided values when available.
 * This function now always returns null as the medal data has been moved to the backend.
 * 
 * @param {string} leagueName - League name (e.g., "Master I", "Crystal II")
 * @returns {number|null} Base number of bonuses, or null if not found
 */
export const getCWLBonusCount = (leagueName) => {
  // Medal data has been moved to backend - this function is only for backward compatibility
  return null
}

/**
 * Calculate total bonuses (base bonuses + wars won)
 * 
 * @deprecated This function is deprecated. Medal calculations are now performed on the backend.
 * This is kept for backward compatibility only. Use backend-provided values when available.
 * 
 * @param {string} leagueName - League name
 * @param {number} wins - Number of wars won
 * @returns {number|null} Total bonuses, or null if league not found
 */
export const getCWLTotalBonuses = (leagueName, wins) => {
  const baseBonuses = getCWLBonusCount(leagueName)
  if (baseBonuses === null) return null
  
  const winsCount = wins || 0
  return baseBonuses + winsCount
}

