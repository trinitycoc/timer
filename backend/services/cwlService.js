import { getMultipleClans, getCWLGroup, getCurrentCWLWars } from './clashOfClansService.js'
import { getActiveCWLClanDetails } from './clanManagementService.js'
import { cacheService, CACHE_TTL } from './cacheService.js'

// Promise cache to prevent concurrent fetches of the same data
const activeFetches = new Map()

/**
 * Calculate eligible members based on TH requirements
 * @param {Object} sheetData - Clan data from database
 * @param {Array} memberList - List of clan members
 * @returns {number} Count of eligible members
 */
export const calculateEligibleMembers = (sheetData, memberList) => {
  if (!sheetData?.townHall || !memberList) return 0

  const thRequirement = sheetData.townHall.toLowerCase()
  
  // Parse TH levels from the requirement string
  const thNumbers = []
  const matches = thRequirement.match(/th\s*(\d+)/gi)
  
  if (matches) {
    matches.forEach(match => {
      const num = parseInt(match.replace(/th\s*/i, ''))
      if (!isNaN(num)) thNumbers.push(num)
    })
  }

  if (thNumbers.length === 0) return 0

  // Determine if it's "and below" requirement
  const isAndBelow = thRequirement.includes('and below') || thRequirement.includes('below')
  
  // Get min and max TH from requirements
  const minTH = Math.min(...thNumbers)
  const maxTH = Math.max(...thNumbers)

  // Count members matching the criteria
  let count = 0
  if (isAndBelow) {
    // Count members with TH <= maxTH
    count = memberList.filter(member => member.townHallLevel <= maxTH).length
  } else if (thNumbers.length === 1) {
    // Single TH requirement
    count = memberList.filter(member => member.townHallLevel === thNumbers[0]).length
  } else {
    // Multiple TH requirements (e.g., Th17, Th16, Th15)
    count = memberList.filter(member => 
      member.townHallLevel >= minTH && member.townHallLevel <= maxTH
    ).length
  }
  
  return count
}

/**
 * Check if current date/time is within CWL display period
 * From 3rd of every month (1:30 PM IST) to (daysInMonth - 2)th of every month (1:30 PM IST)
 * e.g. 31-day month → 29th, 30-day → 28th, 29-day (Feb leap) → 27th, 28-day (Feb) → 26th
 * @returns {boolean} True if current time is within the special CWL display period
 */
export const isCWLDisplayPeriod = () => {
  const now = new Date()
  
  // Use Intl.DateTimeFormat to get IST date and time components
  const istNumericFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  })
  
  const parts = istNumericFormatter.formatToParts(now)
  const getPartNumber = (type) => Number(parts.find((part) => part.type === type)?.value || 0)
  
  const currentDate = getPartNumber('day')
  const currentMonth = getPartNumber('month')
  const currentYear = getPartNumber('year')
  const currentHour = getPartNumber('hour')
  const currentMinute = getPartNumber('minute')
  const currentTime = currentHour * 60 + currentMinute // Time in minutes from midnight
  const periodStartTime = 13 * 60 + 30 // 1:30 PM = 13:30 = 810 minutes

  // End day of display period: (days in month - 2), e.g. 31→29, 30→28, 29→27, 28→26
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate()
  const periodEndDay = daysInMonth - 2
  
  // Check if current date/time is within the period (3rd 1:30 PM to periodEndDay 1:30 PM)
  if (currentDate === 3) {
    // On 3rd: check if time is >= 1:30 PM IST
    return currentTime >= periodStartTime
  } else if (currentDate >= 4 && currentDate <= periodEndDay - 1) {
    // Between 4th and (periodEndDay - 1): always within period
    return true
  } else if (currentDate === periodEndDay) {
    // On period end day: check if time is <= 1:30 PM IST
    return currentTime <= periodStartTime
  }
  
  // Outside the period (1st, 2nd, or after periodEndDay 1:30 PM)
  return false
}

/**
 * Get current month name in IST timezone
 * @returns {string} Month name (e.g., "December")
 */
export const getCurrentMonthNameIST = () => {
  const now = new Date()
  const istFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    month: 'long'
  })
  return istFormatter.format(now)
}

/**
 * Filter clans by capacity logic:
 * Priority 1: If within CWL display period (3rd 1:30 PM IST to (daysInMonth-2)th 1:30 PM IST), show ALL clans
 * Priority 2: Outside display period, check CWL state:
 *   - If state is "preparation" or "inWar": Show clan (displays "CWL already started" banner)
 *   - Otherwise: Apply in-use logic with space/full banners
 * 
 * In-use logic:
 * - Group by database league
 * - Sort by "In Use" value within each league (smallest first)
 * - "Serious" format: HIDDEN from frontend (skip these clans)
 * - "Competitive" format: HIDDEN from frontend (skip these clans)
 * - "Lazy" format: Only show next clan when previous "Lazy" clan reaches 90% capacity
 * - Special CWL rule: If CWL is in preparation or inWar state in previous clan,
 *   show next clan regardless of 90% rule (members may have left after CWL started)
 * 
 * @param {Array} clans - Array of clan objects with sheetData
 * @returns {Array} Filtered array of clans to display
 */
export const filterClansByCapacity = (clans) => {
  // PRIORITY 1: If within CWL display period (3rd to (daysInMonth-2)th, 1:30 PM IST), show ALL clans
  if (isCWLDisplayPeriod()) {
    // During display period, still hide "Serious" and "Competitive" format clans from regular users
    return clans.filter(clan => {
      const format = (clan.sheetData?.format || 'Unknown').toLowerCase().trim()
      return format !== 'serious' && format !== 'competitive'
    })
  }
  
  // PRIORITY 2: Outside display period, apply state-based logic
  // Group clans by database league
  const clansByLeague = {}
  
  clans.forEach(clan => {
    const leagueName = clan.sheetData?.league || clan.warLeague?.name || 'Unknown'
    if (!clansByLeague[leagueName]) {
      clansByLeague[leagueName] = []
    }
    clansByLeague[leagueName].push(clan)
  })

  // Process each league group
  const visibleClans = []
  
  Object.keys(clansByLeague).forEach(leagueName => {
    const leagueClans = clansByLeague[leagueName]
    
    // Sort by "In Use" value (ascending) - smallest In Use first
    leagueClans.sort((a, b) => {
      const aInUse = a.sheetData?.inUse || 999
      const bInUse = b.sheetData?.inUse || 999
      return aInUse - bInUse
    })
    
    // Track the last visible "Lazy" clan for capacity checking  
    let lastVisibleLazyClan = null
    
    // Process each clan in order of "In Use"
    for (let i = 0; i < leagueClans.length; i++) {
      const clan = leagueClans[i]
      const currentEligible = calculateEligibleMembers(clan.sheetData, clan.memberList)
      const currentRequired = parseInt(clan.sheetData?.members) || 0
      const currentFormat = (clan.sheetData?.format || 'Unknown').toLowerCase().trim()
      
      // RULE 1: "Serious" and "Competitive" format clans are HIDDEN from frontend (skip them)
      if (currentFormat === 'serious' || currentFormat === 'competitive') {
        continue // Skip serious/competitive clans, don't add them to visibleClans
      }
      
      // PRIORITY 2: Outside display period - check CWL state first
      const cwlState = clan.cwlStatus?.state || 'unknown'
      const isCWLActive = cwlState === 'preparation' || cwlState === 'inWar'
      
      // If CWL is active (preparation or inWar), show clan regardless of other checks
      // It will display "CWL already started" banner (handled in frontend)
      if (isCWLActive) {
        visibleClans.push(clan)
        // Update lastVisibleLazyClan if this is a lazy clan
        if (currentFormat === 'lazy') {
          lastVisibleLazyClan = clan
        }
        continue
      }
      
      // If CWL is not active, apply in-use logic
      // RULE 2: First "Lazy" clan in each league is always visible
      if (currentFormat === 'lazy' && lastVisibleLazyClan === null) {
        visibleClans.push(clan)
        lastVisibleLazyClan = clan
        continue
      }
      
      // RULE 3: For "Lazy" clans, show next when previous reaches 90% of required
      // OR if CWL is in preparation or inWar in previous clan (members may have left)
      if (currentFormat === 'lazy' && lastVisibleLazyClan !== null) {
        const prevEligible = calculateEligibleMembers(lastVisibleLazyClan.sheetData, lastVisibleLazyClan.memberList)
        const prevRequired = parseInt(lastVisibleLazyClan.sheetData?.members) || 0
        
        // Check if CWL is in preparation or inWar state in previous clan
        const prevCWLState = lastVisibleLazyClan.cwlStatus?.state || 'unknown'
        const prevCWLActive = prevCWLState === 'preparation' || prevCWLState === 'inWar'
        
        // Show next clan if:
        // 1. Previous clan reached 90% capacity (normal rule), OR
        // 2. CWL is active (preparation or inWar) in previous clan (members may have left, next clan should be visible)
        if ((prevRequired > 0 && prevEligible >= Math.ceil(0.9 * prevRequired)) || 
            prevCWLActive) {
          visibleClans.push(clan)
          lastVisibleLazyClan = clan // Update to this clan for next comparison
        }
        // If not full and CWL is not active in previous clan, clan is hidden (do nothing)
      } else if (currentFormat !== 'lazy' && currentFormat !== 'serious' && currentFormat !== 'competitive') {
        // Unknown format - show it by default
        visibleClans.push(clan)
      }
    }
  })

  // Sort final result by "In Use" value globally (smallest first)
  visibleClans.sort((a, b) => {
    const aInUse = a.sheetData?.inUse || 999
    const bInUse = b.sheetData?.inUse || 999
    return aInUse - bInUse
  })

  return visibleClans
}

/**
 * Get all CWL clans with merged data (shared by both filtered and all endpoints)
 * This is cached separately to avoid duplicate API calls
 * Uses promise cache to prevent concurrent fetches
 * @returns {Promise<Array>} All CWL clans with merged data
 */
export const getAllCWLClansMerged = async () => {
  const cacheKey = 'cwl:all-clans-merged'
  
  // Check cache first
  const cached = cacheService.get(cacheKey)
  if (cached) {
    return cached
  }

  // Check if there's already an active fetch for this data
  if (activeFetches.has(cacheKey)) {
    return await activeFetches.get(cacheKey)
  }

  // Create fetch promise
  const fetchPromise = (async () => {
    try {
      // Fetch active clan details from database (only active clans are included)
      const detailsFromSheet = await getActiveCWLClanDetails()

      if (detailsFromSheet.length === 0) {
        // Return empty result instead of throwing - database might be empty initially
        // Cache empty result to prevent repeated fetches
        const emptyResult = []
        cacheService.set(cacheKey, emptyResult, CACHE_TTL.CWL_FILTERED)
        return emptyResult
      }

      // Extract clan tags for API call
      const clanTags = detailsFromSheet.map(detail => detail.tag)

      // Fetch all CWL clan data from CoC API
      const fetchedClans = await getMultipleClans(clanTags)
      
      if (fetchedClans.length === 0) {
        throw new Error('No clan data could be fetched from CoC API')
      }

      // Merge API data with database details and fetch CWL status
      // Fetch CWL status SEQUENTIALLY in batches to avoid rate limiting
      const cwlStatuses = []
      const BATCH_SIZE = 3 // Process 3 clans at a time
      
      for (let i = 0; i < fetchedClans.length; i += BATCH_SIZE) {
        const batch = fetchedClans.slice(i, i + BATCH_SIZE)
        
        // Process batch in parallel (small batches are okay)
        const batchPromises = batch.map(clan => 
          checkCWLStatus(clan.tag).catch(error => {
            console.error(`Error fetching CWL status for ${clan.tag}:`, error.message)
            return { isStarted: false, state: 'unknown', hasActiveWar: false }
          })
        )
        
        const batchResults = await Promise.all(batchPromises)
        cwlStatuses.push(...batchResults)
        
        // Add delay between batches to avoid rate limiting
        if (i + BATCH_SIZE < fetchedClans.length) {
          await new Promise(resolve => setTimeout(resolve, 500)) // 500ms delay between batches
        }
      }
      
      // Only include clans that exist in the database
      // Filter out any clans that don't have a matching database entry
      const mergedData = fetchedClans
        .map((clan, index) => {
          const sheetInfo = detailsFromSheet.find(detail => detail.tag === clan.tag)
          
          // Skip clans that don't exist in the database
          if (!sheetInfo) {
            return null
          }
          
          // Calculate eligible members (requiredMembers = allowed roster size: 5, 15, or 30)
          const eligibleMembers = calculateEligibleMembers(sheetInfo, clan.memberList)
          const requiredMembers = parseInt(sheetInfo?.members) || 0
          const availableSlots = Math.max(0, requiredMembers - eligibleMembers)
          const isFull = requiredMembers > 0 ? eligibleMembers >= requiredMembers : false
          const hasSpaceInfo = requiredMembers > 0 || eligibleMembers > 0
          
          // Get CWL status for this clan
          const cwlStatus = cwlStatuses[index] || { isStarted: false, state: 'unknown', hasActiveWar: false }
          
          return {
            ...clan,
            sheetData: sheetInfo,
            eligibleMembers,
            spaceInfo: hasSpaceInfo ? {
              required: requiredMembers,
              eligible: eligibleMembers,
              available: availableSlots,
              isFull
            } : null,
            cwlStatus
          }
        })
        .filter(clan => clan !== null) // Remove null entries (clans not in database)
      
      // Cache the merged data (used by both filtered and all endpoints)
      cacheService.set(cacheKey, mergedData, CACHE_TTL.CWL_FILTERED)
      
      return mergedData
    } catch (error) {
      console.error('Error getting all CWL clans merged:', error)
      throw error
    } finally {
      // Remove from active fetches when done
      activeFetches.delete(cacheKey)
    }
  })()

  // Store the promise to prevent duplicate fetches
  activeFetches.set(cacheKey, fetchPromise)
  
  return await fetchPromise
}

/**
 * Get CWL clans with all data merged and filtered
 * @returns {Promise<Array>} Filtered CWL clans with merged data
 */
export const getCWLClansFiltered = async () => {
  const cacheKey = 'cwl:filtered-clans'
  
  // Check cache first
  const cached = cacheService.get(cacheKey)
  if (cached) {
    return cached
  }

  try {
    // Get all merged clans (uses shared cache)
    const mergedData = await getAllCWLClansMerged()

    // Filter clans based on capacity logic
    const filteredClans = filterClansByCapacity(mergedData)
    
    // Cache the filtered result
    cacheService.set(cacheKey, filteredClans, CACHE_TTL.CWL_FILTERED)
    
    return filteredClans
  } catch (error) {
    console.error('Error getting filtered CWL clans:', error)
    throw error
  }
}

/**
 * Check if CWL has started for a clan using CWL API
 * @param {string} clanTag - Clan tag
 * @returns {Promise<Object>} CWL status object with isStarted and details
 */
export const checkCWLStatus = async (clanTag) => {
  try {
    const cwlGroup = await getCWLGroup(clanTag)
    
    // If not in war league group, CWL hasn't started
    if (cwlGroup.isNotInWar || cwlGroup.state === 'notInWar') {
      return {
        isStarted: false,
        state: 'notInWar',
        season: null,
        hasActiveWar: false,
        isDisplayPeriod: isCWLDisplayPeriod()
      }
    }
    
    // Check if there are active wars
    const currentWars = await getCurrentCWLWars(clanTag)
    const hasActiveWar = currentWars.length > 0 && currentWars.some(war => 
      war.state === 'preparation' || war.state === 'inWar'
    )
    
    // Find the active war for countdown display
    // Priority: inWar > preparation (if battle day is ongoing, show battle ends in)
    const activeWar = currentWars.find(war => 
      war.state === 'inWar'
    ) || currentWars.find(war => 
      war.state === 'preparation'
    ) || null
    
    // Find the round number for the active war by matching warTag with rounds
    let activeWarRound = null
    if (activeWar && activeWar.warTag && cwlGroup.rounds) {
      for (const round of cwlGroup.rounds) {
        if (round.warTags && round.warTags.includes(activeWar.warTag)) {
          activeWarRound = round.round
          break
        }
      }
    }
    
    // CWL has started if:
    // 1. Group state is 'preparation', 'inWar', or 'ended'
    // 2. OR there are active wars
    const isStarted = (
      (cwlGroup.state === 'preparation' || 
       cwlGroup.state === 'inWar' || 
       cwlGroup.state === 'ended') ||
      hasActiveWar
    )
    
    return {
      isStarted,
      state: cwlGroup.state,
      season: cwlGroup.season,
      hasActiveWar,
      totalRounds: cwlGroup.totalRounds,
      currentWarsCount: currentWars.length,
      isDisplayPeriod: isCWLDisplayPeriod(),
      activeWar: activeWar ? {
        state: activeWar.state,
        startTime: activeWar.startTime,
        endTime: activeWar.endTime,
        preparationStartTime: activeWar.preparationStartTime,
        round: activeWarRound
      } : null
    }
  } catch (error) {
    console.error(`Error checking CWL status for clan ${clanTag}:`, error.message)
    // On error, return not started to be safe
    return {
      isStarted: false,
      state: 'unknown',
      season: null,
      hasActiveWar: false,
      isDisplayPeriod: isCWLDisplayPeriod(),
      error: error.message
    }
  }
}

/**
 * Get eligible members count for a specific clan
 * Allowed/required members (sheetData.members) can be 5, 15, or 30 (5v5, 15v15, 30v30 CWL formats).
 * @param {string} clanTag - Clan tag
 * @param {Object} sheetData - Sheet data for the clan (members = allowed roster size)
 * @returns {Promise<Object>} Eligible members info
 */
export const getClanEligibleMembers = async (clanTag, sheetData) => {
  try {
    const { getClanDetails } = await import('./clashOfClansService.js')
    const clan = await getClanDetails(clanTag)
    
    const eligibleCount = calculateEligibleMembers(sheetData, clan.memberList)
    const required = parseInt(sheetData?.members) || 0
    
    return {
      clanTag: clan.tag,
      clanName: clan.name,
      eligibleMembers: eligibleCount,
      requiredMembers: required,
      isFull: eligibleCount >= required,
      remainingSlots: Math.max(0, required - eligibleCount)
    }
  } catch (error) {
    console.error(`Error calculating eligible members for ${clanTag}:`, error)
    throw error
  }
}

/**
 * Normalize a tag to always have # prefix
 * @param {string} tag - Clan tag
 * @returns {string|null} Normalized tag
 */
export const normalizeTag = (tag) => {
  if (!tag) return null
  return tag.startsWith('#') ? tag : `#${tag}`
}

/**
 * Get promotion and demotion slots based on league name
 * @param {string} leagueName - League name (e.g., "Master I", "Crystal II", "Bronze III", "Crystal 1", "Crystal 2", "Crystal 3")
 * @returns {Object} Object with promotionCount and demotionCount
 */
export const getPromotionDemotionSlots = (leagueName) => {
  if (!leagueName) {
    return { promotionCount: 0, demotionCount: 0 }
  }

  const leagueNameUpper = leagueName.toUpperCase()
  
  // Helper function to check for tier (handles both roman numerals and numbers)
  // Matches patterns like "CRYSTAL 1", "CRYSTAL I", "CRYSTAL 2", "CRYSTAL II", etc.
  const hasTier = (tier) => {
    if (tier === 3) {
      // Check for "III" or " 3" or ends with " 3"
      return leagueNameUpper.includes('III') || 
             leagueNameUpper.includes(' 3') || 
             leagueNameUpper.endsWith('3')
    }
    if (tier === 2) {
      // Check for "II" or " 2" or ends with " 2"
      return leagueNameUpper.includes('II') || 
             leagueNameUpper.includes(' 2') || 
             leagueNameUpper.endsWith('2')
    }
    if (tier === 1) {
      // For tier 1, check for "I" or "1" but exclude "II" and "III" and "2" and "3"
      const hasOne = (leagueNameUpper.includes(' I') || 
                     leagueNameUpper.endsWith(' I') || 
                     leagueNameUpper.includes(' 1') || 
                     leagueNameUpper.endsWith('1'))
      // Exclude if it has tier 2 or 3 indicators
      const hasTwoOrThree = (leagueNameUpper.includes('II') || 
                            leagueNameUpper.includes('III') ||
                            leagueNameUpper.includes(' 2') ||
                            leagueNameUpper.includes(' 3') ||
                            leagueNameUpper.endsWith('2') ||
                            leagueNameUpper.endsWith('3'))
      return hasOne && !hasTwoOrThree
    }
    return false
  }
  
  // Bronze III: 3 promoted, 0 demoted
  if (leagueNameUpper.includes('BRONZE') && hasTier(3)) {
    return { promotionCount: 3, demotionCount: 0 }
  }
  
  // Bronze I & II: 3 promoted, 1 demoted
  if (leagueNameUpper.includes('BRONZE') && (hasTier(1) || hasTier(2))) {
    return { promotionCount: 3, demotionCount: 1 }
  }
  
  // Silver III: 2 promoted, 1 demoted
  if (leagueNameUpper.includes('SILVER') && hasTier(3)) {
    return { promotionCount: 2, demotionCount: 1 }
  }
  
  // Silver I & II: 2 promoted, 2 demoted
  if (leagueNameUpper.includes('SILVER') && (hasTier(1) || hasTier(2))) {
    return { promotionCount: 2, demotionCount: 2 }
  }
  
  // Gold I, II, III: 2 promoted, 2 demoted
  if (leagueNameUpper.includes('GOLD')) {
    return { promotionCount: 2, demotionCount: 2 }
  }
  
  // Crystal III & II: 2 promoted, 2 demoted
  if (leagueNameUpper.includes('CRYSTAL') && (hasTier(3) || hasTier(2))) {
    return { promotionCount: 2, demotionCount: 2 }
  }
  
  // Crystal I: 1 promoted, 2 demoted
  if (leagueNameUpper.includes('CRYSTAL') && hasTier(1)) {
    return { promotionCount: 1, demotionCount: 2 }
  }
  
  // Master I, II, III: 1 promoted, 2 demoted
  if (leagueNameUpper.includes('MASTER')) {
    return { promotionCount: 1, demotionCount: 2 }
  }
  
  // Champion III & II: 1 promoted, 2 demoted
  if (leagueNameUpper.includes('CHAMPION') && (hasTier(3) || hasTier(2))) {
    return { promotionCount: 1, demotionCount: 2 }
  }
  
  // Champion I: 0 promoted, 3 demoted
  if (leagueNameUpper.includes('CHAMPION') && hasTier(1)) {
    return { promotionCount: 0, demotionCount: 3 }
  }
  
  // No match found: return 0 for both
  return { promotionCount: 0, demotionCount: 0 }
}

/**
 * CWL Medal and Bonus data by league and position
 */
const CWL_MEDAL_DATA = {
  'CHAMPION 1': { medals: [508, 501, 494, 487, 480, 473, 466, 459], bonusMedals: 105, baseBonuses: 4 },
  'CHAMPION 2': { medals: [466, 459, 452, 445, 438, 431, 424, 417], bonusMedals: 100, baseBonuses: 4 },
  'CHAMPION 3': { medals: [424, 417, 410, 403, 396, 389, 382, 375], bonusMedals: 95, baseBonuses: 4 },
  'MASTER 1': { medals: [382, 376, 370, 364, 358, 352, 346, 340], bonusMedals: 90, baseBonuses: 3 },
  'MASTER 2': { medals: [346, 340, 334, 328, 322, 316, 310, 304], bonusMedals: 85, baseBonuses: 3 },
  'MASTER 3': { medals: [310, 304, 298, 292, 286, 280, 274, 268], bonusMedals: 80, baseBonuses: 3 },
  'CRYSTAL 1': { medals: [274, 269, 264, 259, 254, 249, 244, 239], bonusMedals: 75, baseBonuses: 2 },
  'CRYSTAL 2': { medals: [244, 239, 234, 229, 224, 219, 214, 209], bonusMedals: 70, baseBonuses: 2 },
  'CRYSTAL 3': { medals: [214, 209, 204, 199, 194, 189, 184, 179], bonusMedals: 65, baseBonuses: 2 },
  'GOLD 1': { medals: [184, 180, 176, 172, 168, 164, 160, 156], bonusMedals: 60, baseBonuses: 2 },
  'GOLD 2': { medals: [160, 156, 152, 148, 144, 140, 136, 132], bonusMedals: 55, baseBonuses: 2 },
  'GOLD 3': { medals: [136, 132, 128, 124, 120, 116, 112, 108], bonusMedals: 50, baseBonuses: 2 },
  'SILVER 1': { medals: [112, 109, 106, 103, 100, 97, 94, 91], bonusMedals: 45, baseBonuses: 1 },
  'SILVER 2': { medals: [94, 91, 88, 85, 82, 79, 76, 73], bonusMedals: 40, baseBonuses: 1 },
  'SILVER 3': { medals: [76, 73, 70, 67, 64, 61, 58, 55], bonusMedals: 35, baseBonuses: 1 },
  'BRONZE 1': { medals: [58, 56, 54, 52, 50, 48, 46, 44], bonusMedals: 35, baseBonuses: 1 },
  'BRONZE 2': { medals: [46, 44, 42, 40, 38, 36, 34, 32], bonusMedals: 35, baseBonuses: 1 },
  'BRONZE 3': { medals: [34, 32, 30, 28, 26, 24, 22, 20], bonusMedals: 35, baseBonuses: 1 }
}

/**
 * Normalize league name to match medal data keys
 */
const normalizeLeagueName = (leagueName) => {
  if (!leagueName) return null
  
  const upper = leagueName.toUpperCase()
  let normalized = upper.replace('LEAGUE', '').replace(/\s+/g, ' ').trim()
  
  normalized = normalized.replace(/\s+I$/, ' 1')
  normalized = normalized.replace(/\s+II$/, ' 2')
  normalized = normalized.replace(/\s+III$/, ' 3')
  normalized = normalized.replace(/\s+(\d)$/, ' $1')
  
  return normalized
}

/**
 * Get CWL medals per member by league and position
 */
export const getCWLMedalsByPosition = (leagueName, position) => {
  if (!leagueName || !position || position < 1 || position > 8) return null
  
  const normalizedLeague = normalizeLeagueName(leagueName)
  const medalData = CWL_MEDAL_DATA[normalizedLeague]
  
  if (!medalData || !medalData.medals || !medalData.medals[position - 1]) {
    return null
  }
  
  return medalData.medals[position - 1]
}

/**
 * Get bonus medals per league
 */
export const getCWLBonusMedals = (leagueName) => {
  if (!leagueName) return null
  
  const normalizedLeague = normalizeLeagueName(leagueName)
  const medalData = CWL_MEDAL_DATA[normalizedLeague]
  
  return medalData ? medalData.bonusMedals : null
}

/**
 * Get base number of bonuses per league
 */
export const getCWLBonusCount = (leagueName) => {
  if (!leagueName) return null
  
  const normalizedLeague = normalizeLeagueName(leagueName)
  const medalData = CWL_MEDAL_DATA[normalizedLeague]
  
  return medalData ? medalData.baseBonuses : null
}

/**
 * Check if a rank is in promotion zone
 */
export const isPromotionRank = (rank, promotionCount) => {
  return rank <= promotionCount
}

/**
 * Check if a rank is in demotion zone
 */
export const isDemotionRank = (rank, demotionCount) => {
  if (demotionCount === 0) return false
  return rank > (8 - demotionCount)
}

/**
 * Calculate CWL leaderboard stats for each clan from wars data
 * Returns an array of clan stats with rank, stars, destruction, record (wins-ties-losses), members, and medal info
 * @param {Array} clans - Array of clan objects
 * @param {Array} wars - Array of war objects
 * @param {string} leagueName - League name for medal calculations (optional)
 * @returns {Array} Leaderboard array with ranked clan stats
 */
export const calculateCWLLeaderboard = (clans, wars, leagueName = null) => {
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
  // Add 10 extra stars for every win
  const leaderboard = Array.from(clanStatsMap.values()).map(stats => {
    const earnedStars = stats.totalStars // Stars earned from attacks
    const winRewardStars = stats.wins * 10 // 10 bonus stars per win
    const totalStars = earnedStars + winRewardStars
    
    return {
      ...stats,
      totalStars: totalStars,
      earnedStars: earnedStars, // Stars earned from attacks
      winRewardStars: winRewardStars, // Bonus stars from wins
      averageDestruction: stats.warCount > 0 ? stats.totalDestruction / stats.warCount : 0,
      record: `${stats.wins}-${stats.ties}-${stats.losses}`
    }
  })

  // Sort by stars (descending), then by destruction (descending)
  leaderboard.sort((a, b) => {
    if (b.totalStars !== a.totalStars) {
      return b.totalStars - a.totalStars
    }
    return b.averageDestruction - a.averageDestruction
  })

  // Get promotion/demotion slots for calculating indicators
  const promotionDemotionSlots = leagueName ? getPromotionDemotionSlots(leagueName) : { promotionCount: 0, demotionCount: 0 }
  
  // Add rank and medal information
  leaderboard.forEach((stats, index) => {
    stats.rank = index + 1
    
    // Expose wins, ties, losses as separate fields (already calculated above)
    // Keep record string for backward compatibility
    
    // Always calculate promotion/demotion indicators (even if leagueName is null/Unranked)
    const position = index + 1
    stats.isPromoted = isPromotionRank(position, promotionDemotionSlots.promotionCount)
    stats.isDemoted = isDemotionRank(position, promotionDemotionSlots.demotionCount)
    
    // Add medal information if league name is provided
    if (leagueName) {
      const wins = stats.wins || 0
      
      stats.medalsPerMember = getCWLMedalsByPosition(leagueName, position)
      stats.bonusMedals = getCWLBonusMedals(leagueName)
      stats.baseBonuses = getCWLBonusCount(leagueName)
      stats.totalBonuses = stats.baseBonuses !== null ? stats.baseBonuses + wins : null
    }
  })

  return leaderboard
}

/**
 * Calculate round statistics from wars for a specific clan
 * @param {Object} round - Round object with warTags
 * @param {Array} roundWars - Array of wars for this round
 * @param {string} clanTag - Tag of the clan to calculate stats for
 * @returns {Object} Round statistics
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
      opponentDestruction,
      ourAttacks: 0,
      opponentAttacks: 0,
      teamSize: 0,
      maxAttacks: 0,
      latestEndTime: null
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
      // Ensure badgeUrls has small/medium/large structure (not url)
      ourClanBadge = firstWar.clan.badgeUrls && typeof firstWar.clan.badgeUrls === 'object' 
        ? (firstWar.clan.badgeUrls.small || firstWar.clan.badgeUrls.medium || firstWar.clan.badgeUrls.large 
          ? firstWar.clan.badgeUrls 
          : null)
        : null
      ourClanLevel = firstWar.clan.clanLevel || 0
      opponentClanName = firstWar.opponent.name
      opponentClanTag = firstWar.opponent.tag
      opponentClanBadge = firstWar.opponent.badgeUrls && typeof firstWar.opponent.badgeUrls === 'object'
        ? (firstWar.opponent.badgeUrls.small || firstWar.opponent.badgeUrls.medium || firstWar.opponent.badgeUrls.large
          ? firstWar.opponent.badgeUrls
          : null)
        : null
      opponentClanLevel = firstWar.opponent.clanLevel || 0
    } else {
      ourClanName = firstWar.opponent.name
      ourClanTag = firstWar.opponent.tag
      ourClanBadge = firstWar.opponent.badgeUrls && typeof firstWar.opponent.badgeUrls === 'object'
        ? (firstWar.opponent.badgeUrls.small || firstWar.opponent.badgeUrls.medium || firstWar.opponent.badgeUrls.large
          ? firstWar.opponent.badgeUrls
          : null)
        : null
      ourClanLevel = firstWar.opponent.clanLevel || 0
      opponentClanName = firstWar.clan.name
      opponentClanTag = firstWar.clan.tag
      opponentClanBadge = firstWar.clan.badgeUrls && typeof firstWar.clan.badgeUrls === 'object'
        ? (firstWar.clan.badgeUrls.small || firstWar.clan.badgeUrls.medium || firstWar.clan.badgeUrls.large
          ? firstWar.clan.badgeUrls
          : null)
        : null
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

  // Calculate attack counts across all wars in the round
  let ourAttacks = 0
  let opponentAttacks = 0
  const normalizedOurTag = normalizeTag(clanTag) || clanTag
  
  roundWars.forEach(war => {
    const normalizedWarClanTag = normalizeTag(war.clan?.tag || '') || war.clan?.tag || ''
    const isOurClanFirst = normalizedWarClanTag === normalizedOurTag
    
    if (isOurClanFirst) {
      ourAttacks += war.clan?.attacks || 0
      opponentAttacks += war.opponent?.attacks || 0
    } else {
      ourAttacks += war.opponent?.attacks || 0
      opponentAttacks += war.clan?.attacks || 0
    }
  })

  // Get team size from first war (should be same across all wars in a round)
  const teamSize = firstWar.teamSize || 0
  const maxAttacks = teamSize * 1

  // Get latest end time from all wars
  const endTimes = roundWars.map(war => war.endTime).filter(Boolean).sort()
  const latestEndTime = endTimes.length > 0 ? endTimes[endTimes.length - 1] : null

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
    opponentDestruction,
    ourAttacks,
    opponentAttacks,
    teamSize,
    maxAttacks,
    latestEndTime
  }
}

/**
 * Calculate town hall composition for a clan
 * @param {Array} memberList - Array of clan members
 * @returns {Object} TH composition object with counts per TH level
 */
export const calculateTHComposition = (memberList) => {
  if (!memberList || !Array.isArray(memberList)) return {}
  
  const composition = {}
  const totalMembers = memberList.length
  
  memberList.forEach(member => {
    const th = member.townHallLevel
    composition[th] = (composition[th] || 0) + 1
  })
  
  // Calculate percentages for each TH level
  Object.keys(composition).forEach(th => {
    const count = composition[th]
    composition[th] = {
      count,
      percentage: totalMembers > 0 ? (count / totalMembers) * 100 : 0
    }
  })
  
  return composition
}

/**
 * Calculate CWL member summary statistics across all rounds
 * Aggregates stars, destruction, attacks per member per round, and tracks mirror bonus rule compliance
 * @param {Array} rounds - Array of round objects with wars
 * @param {string} clanTag - Clan tag to calculate stats for
 * @param {number} totalBonuses - Total bonus count for determining bonus eligibility
 * @param {string} sortBy - Sort option: 'total' (default) or round number (1-7) as string
 * @returns {Array} Array of member summary objects sorted by specified criteria
 */
export const calculateMemberSummary = (rounds, clanTag, totalBonuses = null, sortBy = 'total') => {
  if (!rounds || !Array.isArray(rounds) || !clanTag) return []
  
  const memberStatsMap = new Map() // Map of member tag -> { member, rounds: { 1: {...}, 2: {...}, ... }, totals: {...}, mirrorBonusRuleByRound: { 1: true/false, 2: true/false, ... }, hasMirrorBonusRule: boolean }
  const normalizedOurTag = normalizeTag(clanTag) || clanTag
  
  // Process each round
  rounds.forEach((round, roundIndex) => {
    const roundNum = round.round || (roundIndex + 1)
    
    if (!round.wars || !Array.isArray(round.wars) || round.wars.length === 0) {
      return
    }
    
    // Accumulate stats across all wars in this round
    const roundMemberStats = new Map() // Temporary map for this round: memberTag -> { stars, destruction, attacks }
    
    round.wars.forEach(war => {
      // Determine which clan is "our clan"
      // Backend returns clan/opponent structure (not ourClan/opponent)
      const normalizedWarClanTag = normalizeTag(war.clan?.tag) || war.clan?.tag
      const normalizedWarOppTag = normalizeTag(war.opponent?.tag) || war.opponent?.tag
      const isOurClanFirst = normalizedWarClanTag === normalizedOurTag
      
      const ourClan = isOurClanFirst ? war.clan : war.opponent
      const opponentClan = isOurClanFirst ? war.opponent : war.clan
      
      if (!ourClan?.members || !Array.isArray(ourClan.members)) return
      
      // Process each member in our clan
      ourClan.members.forEach(member => {
        const memberTag = normalizeTag(member.tag) || member.tag
        
        // Initialize member in main map if not exists
        if (!memberStatsMap.has(memberTag)) {
          memberStatsMap.set(memberTag, {
            member: {
              name: member.name,
              tag: member.tag,
              townHallLevel: member.townHallLevel || member.townhallLevel || 0
            },
            rounds: {},
            totals: {
              stars: 0,
              destruction: 0,
              attacks: 0
            },
            mirrorBonusRuleByRound: {},
            hasMirrorBonusRule: false
          })
        }
        
        // Initialize member in round stats if not exists
        if (!roundMemberStats.has(memberTag)) {
          roundMemberStats.set(memberTag, {
            stars: 0,
            destruction: 0,
            attacks: 0,
            hasAttacks: false,
            hasMirrorBonusInRound: false
          })
        }
        
        // Calculate stars and destruction for this war
        const attacks = member.attacks || []
        const warStars = attacks.reduce((sum, attack) => sum + (attack.stars || 0), 0)
        const warDestruction = attacks.reduce((sum, attack) => {
          const destruction = attack.destructionPercentage || attack.destruction || 0
          return sum + destruction
        }, 0)
        
        // Track if member had attacks in this round
        if (attacks.length > 0) {
          const roundStats = roundMemberStats.get(memberTag)
          roundStats.hasAttacks = true
          
          // Check if any attack is a mirror bonus attack (backend calculates isMirrorAttack flag)
          const hasMirrorBonusInThisWar = attacks.some(attack => attack.isMirrorAttack === true)
          
          // Update mirror bonus rule status for this round
          if (hasMirrorBonusInThisWar) {
            roundStats.hasMirrorBonusInRound = true
          }
        }
        
        // Accumulate in round stats (across all wars in this round)
        const roundStats = roundMemberStats.get(memberTag)
        roundStats.stars += warStars
        roundStats.destruction += warDestruction
        roundStats.attacks += attacks.length
      })
    })
    
    // Now set the accumulated round stats for each member
    roundMemberStats.forEach((roundStats, memberTag) => {
      const memberStats = memberStatsMap.get(memberTag)
      if (memberStats) {
        // Set round data (accumulated across all wars in this round)
        memberStats.rounds[roundNum] = {
          stars: roundStats.stars,
          destruction: roundStats.destruction,
          attacks: roundStats.attacks
        }
        
        // Track mirror bonus rule compliance for this round
        if (roundStats.hasAttacks) {
          memberStats.mirrorBonusRuleByRound[roundNum] = roundStats.hasMirrorBonusInRound
        }
        
        // Update totals
        memberStats.totals.stars += roundStats.stars
        memberStats.totals.destruction += roundStats.destruction
        memberStats.totals.attacks += roundStats.attacks
      }
    })
  })
  
  // Determine final mirror bonus rule compliance: must follow mirror bonus rule in ALL rounds where they had attacks
  memberStatsMap.forEach((memberStats, memberTag) => {
    const roundsWithAttacks = Object.keys(memberStats.mirrorBonusRuleByRound)
    
    // If member participated in at least one round
    if (roundsWithAttacks.length > 0) {
      // Check if they followed mirror bonus rule in ALL rounds where they had attacks
      const allRoundsFollowMirrorBonusRule = roundsWithAttacks.every(roundNum => 
        memberStats.mirrorBonusRuleByRound[roundNum] === true
      )
      memberStats.hasMirrorBonusRule = allRoundsFollowMirrorBonusRule
    } else {
      // No attacks in any round, so no mirror bonus rule to follow
      memberStats.hasMirrorBonusRule = false
    }
  })
  
  // Convert map to array and sort based on sortBy parameter
  const sortedMembers = Array.from(memberStatsMap.values()).sort((a, b) => {
    if (sortBy === 'total') {
      // Sort by total stars (descending), then by total destruction (descending)
      if (b.totals.stars !== a.totals.stars) {
        return b.totals.stars - a.totals.stars
      }
      return b.totals.destruction - a.totals.destruction
    } else {
      // Sort by specific round: stars (descending), then destruction (descending)
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
    }
  })
  
  // Mark bonus-eligible members (top X members based on totalBonuses)
  // IMPORTANT: Only members who followed the mirror bonus rule are eligible for bonuses
  if (totalBonuses !== null && totalBonuses > 0) {
    // Filter members who followed the mirror bonus rule
    const mirrorBonusRuleMembers = sortedMembers.filter(member => member.hasMirrorBonusRule === true)
    
    // Take top X members from those who followed the mirror bonus rule
    const bonusCount = Math.min(totalBonuses, mirrorBonusRuleMembers.length)
    for (let i = 0; i < bonusCount; i++) {
      const member = mirrorBonusRuleMembers[i]
      // Find the member in the sortedMembers array and mark as bonus-eligible
      const memberIndex = sortedMembers.findIndex(m => m.member.tag === member.member.tag)
      if (memberIndex !== -1) {
        sortedMembers[memberIndex].isBonusEligible = true
      }
    }
  }
  
  return sortedMembers
}

