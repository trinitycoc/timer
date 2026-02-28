import { getClanDetails, getMultipleClans } from './clashOfClansService.js'
import { getActiveTrinityClanTags } from './clanManagementService.js'
import { cacheService, CACHE_TTL } from './cacheService.js'

/**
 * Get aggregated statistics for a single clan
 * @param {string} clanTag - Clan tag
 * @returns {Promise<Object>} Clan statistics
 */
export const getClanStats = async (clanTag) => {
  const cacheKey = `stats:clan:${clanTag}`
  
  // Check cache first
  const cached = cacheService.get(cacheKey)
  if (cached) {
    return cached
  }

  try {
    const clan = await getClanDetails(clanTag)
    
    // Calculate TH distribution
    const thDistribution = {}
    let totalTrophies = 0
    let totalDonations = 0
    let totalReceived = 0
    
    if (clan.memberList && clan.memberList.length > 0) {
      clan.memberList.forEach(member => {
        // TH distribution
        const th = member.townHallLevel || 0
        thDistribution[th] = (thDistribution[th] || 0) + 1
        
        // Sum stats
        totalTrophies += member.trophies || 0
        totalDonations += member.donations || 0
        totalReceived += member.donationsReceived || 0
      })
    }
    
    // Calculate averages
    const memberCount = clan.memberList?.length || 0
    const avgTrophies = memberCount > 0 ? Math.round(totalTrophies / memberCount) : 0
    const avgDonations = memberCount > 0 ? Math.round(totalDonations / memberCount) : 0
    const avgReceived = memberCount > 0 ? Math.round(totalReceived / memberCount) : 0
    
    // Get top donors
    const topDonors = (clan.memberList || [])
      .sort((a, b) => (b.donations || 0) - (a.donations || 0))
      .slice(0, 5)
      .map(m => ({
        name: m.name,
        tag: m.tag,
        donations: m.donations || 0,
        townHallLevel: m.townHallLevel || 0
      }))
    
    // Get top trophy earners
    const topTrophies = (clan.memberList || [])
      .sort((a, b) => (b.trophies || 0) - (a.trophies || 0))
      .slice(0, 5)
      .map(m => ({
        name: m.name,
        tag: m.tag,
        trophies: m.trophies || 0,
        townHallLevel: m.townHallLevel || 0
      }))
    
    const stats = {
      tag: clan.tag,
      name: clan.name,
      members: memberCount,
      thDistribution,
      totalTrophies,
      totalDonations,
      totalReceived,
      averages: {
        trophies: avgTrophies,
        donations: avgDonations,
        received: avgReceived
      },
      topDonors,
      topTrophies,
      warStats: {
        wins: clan.warWins || 0,
        winStreak: clan.warWinStreak || 0,
        league: clan.warLeague?.name || 'Unknown'
      },
      generatedAt: new Date().toISOString()
    }
    
    // Cache the result
    cacheService.set(cacheKey, stats, CACHE_TTL.STATS)
    
    return stats
  } catch (error) {
    console.error(`Error getting clan stats for ${clanTag}:`, error)
    throw error
  }
}

/**
 * Get family-wide overview statistics
 * @returns {Promise<Object>} Trinity family statistics
 */
export const getTrinityFamilyStats = async () => {
  const cacheKey = 'stats:trinity-family'
  
  // Check cache first
  const cached = cacheService.get(cacheKey)
  if (cached) {
    return cached
  }

  try {
    // Get all Trinity clan tags
    const clanTags = await getActiveTrinityClanTags()
    
    if (clanTags.length === 0) {
      // Return empty stats if no clans found - database might be empty initially
      return {
        totalClans: 0,
        totalMembers: 0,
        totalWins: 0,
        totalTrophies: 0,
        averageClanLevel: 0,
        averageClanPoints: 0
      }
    }
    
    // Fetch all clan data
    const clans = await getMultipleClans(clanTags)
    
    // Aggregate family-wide stats
    let totalMembers = 0
    let totalWins = 0
    let totalTrophies = 0
    let totalDonations = 0
    let totalClanPoints = 0
    let activeWars = 0
    const thDistribution = {}
    const clanLevels = []
    
    clans.forEach(clan => {
      totalMembers += clan.members || 0
      totalWins += clan.warWins || 0
      totalClanPoints += clan.clanPoints || 0
      clanLevels.push(clan.clanLevel || 0)
      
      // Count members in each TH level
      if (clan.memberList && clan.memberList.length > 0) {
        clan.memberList.forEach(member => {
          const th = member.townHallLevel || 0
          thDistribution[th] = (thDistribution[th] || 0) + 1
          totalTrophies += member.trophies || 0
          totalDonations += member.donations || 0
        })
      }
    })
    
    // Calculate averages
    const avgClanLevel = clanLevels.length > 0 
      ? Math.round(clanLevels.reduce((a, b) => a + b, 0) / clanLevels.length) 
      : 0
    
    const avgMembersPerClan = clans.length > 0 
      ? Math.round(totalMembers / clans.length) 
      : 0
    
    const stats = {
      totalClans: clans.length,
      totalMembers,
      totalWins,
      totalTrophies,
      totalDonations,
      totalClanPoints,
      activeWars,
      averages: {
        clanLevel: avgClanLevel,
        membersPerClan: avgMembersPerClan,
        winsPerClan: clans.length > 0 ? Math.round(totalWins / clans.length) : 0
      },
      thDistribution,
      clans: clans.map(c => ({
        tag: c.tag,
        name: c.name,
        members: c.members,
        level: c.clanLevel,
        wins: c.warWins,
        points: c.clanPoints
      })),
      generatedAt: new Date().toISOString()
    }
    
    // Cache the result
    cacheService.set(cacheKey, stats, CACHE_TTL.STATS)
    
    
    return stats
  } catch (error) {
    console.error('Error getting Trinity family stats:', error)
    throw error
  }
}

/**
 * Get TH distribution for a clan
 * @param {string} clanTag - Clan tag
 * @returns {Promise<Object>} TH distribution
 */
export const getClanTHDistribution = async (clanTag) => {
  const cacheKey = `stats:th-distribution:${clanTag}`
  
  // Check cache first
  const cached = cacheService.get(cacheKey)
  if (cached) {
    return cached
  }

  try {
    const clan = await getClanDetails(clanTag)
    
    const distribution = {}
    
    if (clan.memberList && clan.memberList.length > 0) {
      clan.memberList.forEach(member => {
        const th = member.townHallLevel || 0
        distribution[th] = (distribution[th] || 0) + 1
      })
    }
    
    const result = {
      clanTag: clan.tag,
      clanName: clan.name,
      totalMembers: clan.memberList?.length || 0,
      distribution,
      // Convert to array format for easier charting
      distributionArray: Object.entries(distribution)
        .map(([th, count]) => ({ townHall: parseInt(th), count }))
        .sort((a, b) => b.townHall - a.townHall)
    }
    
    // Cache the result
    cacheService.set(cacheKey, result, CACHE_TTL.STATS)
    
    return result
  } catch (error) {
    console.error(`Error getting TH distribution for ${clanTag}:`, error)
    throw error
  }
}

