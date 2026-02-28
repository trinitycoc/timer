import { normalizeTag, filterWarsForDay, getValidWarTags } from './cwlUtils'

/**
 * Calculate round statistics from wars
 * 
 * @deprecated This function is deprecated. Backend now provides pre-calculated roundStats in CWL group response.
 * This is kept for backward compatibility only.
 */
export const calculateRoundStats = (round, roundWars, clanTag) => {
  let status = 'In Progress'
  let result = '-'
  let ourClanName = 'Our Clan'
  let opponentClanName = 'Opponent'
  let ourClanTag = ''
  let opponentClanTag = ''
  let ourClanBadge = null
  let opponentClanBadge = null
  let ourClanLevel = 0
  let opponentClanLevel = 0
  let ourStars = 0
  let opponentStars = 0
  let ourDestruction = 0
  let opponentDestruction = 0

  if (roundWars.length === 0) {
    return { 
      status, 
      result, 
      ourClanName, 
      opponentClanName, 
      ourClanTag,
      opponentClanTag,
      ourClanBadge,
      opponentClanBadge,
      ourClanLevel,
      opponentClanLevel,
      ourStars, 
      opponentStars, 
      ourDestruction, 
      opponentDestruction 
    }
  }

  const firstWar = roundWars[0]

  // Get clan names, badges, tags, and levels
  if (firstWar.clan && firstWar.opponent) {
    const normalizedOurTag = normalizeTag(clanTag) || clanTag
    const normalizedClanTag = normalizeTag(firstWar.clan.tag) || firstWar.clan.tag

    if (normalizedClanTag === normalizedOurTag) {
      ourClanName = firstWar.clan.name
      ourClanTag = firstWar.clan.tag
      ourClanBadge = firstWar.clan.badgeUrls
      ourClanLevel = firstWar.clan.clanLevel || 0
      opponentClanName = firstWar.opponent.name
      opponentClanTag = firstWar.opponent.tag
      opponentClanBadge = firstWar.opponent.badgeUrls
      opponentClanLevel = firstWar.opponent.clanLevel || 0
    } else {
      ourClanName = firstWar.opponent.name
      ourClanTag = firstWar.opponent.tag
      ourClanBadge = firstWar.opponent.badgeUrls
      ourClanLevel = firstWar.opponent.clanLevel || 0
      opponentClanName = firstWar.clan.name
      opponentClanTag = firstWar.clan.tag
      opponentClanBadge = firstWar.clan.badgeUrls
      opponentClanLevel = firstWar.clan.clanLevel || 0
    }
  }

  // Aggregate stats across all wars in the round
  let totalOurStars = 0
  let totalOpponentStars = 0
  let totalOurDestruction = 0
  let totalOpponentDestruction = 0
  let completedWars = 0
  let inProgressWars = 0

  roundWars.forEach(war => {
    const normalizedOurTag = normalizeTag(clanTag) || clanTag
    const normalizedWarClanTag = normalizeTag(war.clan?.tag || '') || war.clan?.tag || ''

    const isOurClanFirst = normalizedWarClanTag === normalizedOurTag

    const warOurStars = isOurClanFirst ? (war.clan?.stars || 0) : (war.opponent?.stars || 0)
    const warOpponentStars = isOurClanFirst ? (war.opponent?.stars || 0) : (war.clan?.stars || 0)
    const warOurDestruction = isOurClanFirst ? (war.clan?.destructionPercentage || 0) : (war.opponent?.destructionPercentage || 0)
    const warOpponentDestruction = isOurClanFirst ? (war.opponent?.destructionPercentage || 0) : (war.clan?.destructionPercentage || 0)

    totalOurStars += warOurStars
    totalOpponentStars += warOpponentStars
    totalOurDestruction += warOurDestruction
    totalOpponentDestruction += warOpponentDestruction

    // Determine status
    if (war.state === 'warEnded' || war.endTime) {
      const endTime = war.endTime ? new Date(war.endTime) : null
      if (endTime && endTime < new Date()) {
        completedWars++
      } else {
        inProgressWars++
      }
    } else if (war.state === 'inWar' || war.state === 'preparation') {
      inProgressWars++
    } else if (war.state === 'warEnded') {
      completedWars++
    }
  })

  ourStars = totalOurStars
  opponentStars = totalOpponentStars
  ourDestruction = roundWars.length > 0 ? totalOurDestruction / roundWars.length : 0
  opponentDestruction = roundWars.length > 0 ? totalOpponentDestruction / roundWars.length : 0

  // Determine status
  if (completedWars === roundWars.length) {
    status = 'Completed'
  } else if (inProgressWars > 0) {
    status = 'In Progress'
  } else {
    status = 'In Progress'
  }

  // Determine result
  if (completedWars === roundWars.length) {
    if (ourStars > opponentStars) {
      result = 'Win'
    } else if (ourStars < opponentStars) {
      result = 'Loss'
    } else {
      // Tie in stars, check destruction
      if (ourDestruction > opponentDestruction) {
        result = 'Win'
      } else if (ourDestruction < opponentDestruction) {
        result = 'Loss'
      } else {
        result = 'Draw'
      }
    }
  }

  return { 
    status, 
    result, 
    ourClanName, 
    opponentClanName, 
    ourClanTag,
    opponentClanTag,
    ourClanBadge,
    opponentClanBadge,
    ourClanLevel,
    opponentClanLevel,
    ourStars, 
    opponentStars, 
    ourDestruction, 
    opponentDestruction 
  }
}

/**
 * Get wars for a round from various sources
 */
export const getRoundWars = (round, cwlGroupData, fetchedWarsByRound, fetchedWarsForDay, selectedDay) => {
  if (!round?.warTags) return []

  let roundWars = filterWarsForDay(
    cwlGroupData.allWars || [],
    round.warTags
  )

  if (roundWars.length === 0 && cwlGroupData.currentWars) {
    roundWars = filterWarsForDay(
      cwlGroupData.currentWars,
      round.warTags
    )
  }

  // If still no wars, check fetched wars for this round
  if (roundWars.length === 0) {
    // Check fetchedWarsByRound first for previously fetched wars
    if (fetchedWarsByRound[round.round] && fetchedWarsByRound[round.round].length > 0) {
      roundWars = fetchedWarsByRound[round.round]
    }
    // Also check fetchedWarsForDay if this is the selected day (most recent fetch)
    if (selectedDay === round.round && fetchedWarsForDay.length > 0) {
      roundWars = fetchedWarsForDay
    }
  }

  return roundWars
}

