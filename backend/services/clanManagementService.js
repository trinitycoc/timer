import { databaseService } from './databaseService.js'
import { getClanDetails } from './clashOfClansService.js'

/**
 * Trinity Clan Management Service
 * Manages Trinity clans (clans that are part of Trinity family)
 */

/**
 * Normalize townHall field - accepts array or string, returns formatted string
 */
const normalizeTownHall = (townHall) => {
  if (!townHall) return ''
  
  if (Array.isArray(townHall)) {
    return townHall.map(th => {
      // Handle both numbers and strings like "TH17" or "17"
      const num = typeof th === 'string' ? parseInt(th.replace(/^TH/i, '')) : th
      return `TH${num}`
    }).join(', ')
  }
  
  if (typeof townHall === 'string') {
    // Already a string, return as-is
    return townHall
  }
  
  return ''
}

/**
 * Normalize weight - ensures only digits
 */
const normalizeWeight = (weight) => {
  if (!weight) return ''
  const str = String(weight)
  const digitsOnly = str.replace(/\D/g, '')
  return digitsOnly
}

/**
 * Parse league name from warLeague API format to normalized format
 * Converts "Master League I" to "Master 1", "Crystal League III" to "Crystal 3", etc.
 * @param {string} leagueName - League name from API (e.g., "Master League I")
 * @returns {string} Normalized league name (e.g., "Master 1") or empty string
 */
export const parseLeagueName = (leagueName) => {
  if (!leagueName) return ''
  
  // Convert "Master League I" to "Master 1", "Crystal League III" to "Crystal 3", etc.
  const leagueMatch = leagueName.match(/^(\w+)\s+League\s+([IVX]+)$/i)
  if (leagueMatch) {
    const tier = leagueMatch[1] // e.g., "Master", "Crystal"
    const romanNumeral = leagueMatch[2] // e.g., "I", "II", "III"
    
    // Convert roman numeral to number
    const romanToNumber = {
      'I': '1',
      'II': '2',
      'III': '3'
    }
    const level = romanToNumber[romanNumeral.toUpperCase()] || '1'
    
    return `${tier} ${level}`
  } else if (leagueName.toLowerCase().includes('unranked')) {
    // Handle Unranked league
    return 'Unranked'
  }
  
  return ''
}

/**
 * Get all Trinity clans
 * @param {Object} filters - Optional filters (status, etc.)
 * @returns {Promise<Array>} Array of Trinity clans
 */
export const getTrinityClans = async (filters = {}) => {
  const query = {}
  
  if (filters.status) {
    query.status = filters.status
  }
  
  const clans = await databaseService.find('trinityClans', query, { sort: { createdAt: 1 } })
  return clans
}

/**
 * Get Trinity clan by tag
 * @param {string} tag - Clan tag (with or without #)
 * @returns {Promise<Object|null>} Trinity clan or null
 */
export const getTrinityClanByTag = async (tag) => {
  const normalizedTag = tag.startsWith('#') ? tag : `#${tag}`
  return await databaseService.findOne('trinityClans', { tag: normalizedTag })
}

/**
 * Get active Trinity clan tags
 * @returns {Promise<Array<string>} Array of active clan tags
 */
export const getActiveTrinityClanTags = async () => {
  const clans = await databaseService.find('trinityClans', { status: 'Active' }, { sort: { createdAt: 1 } })
  return clans.map(clan => clan.tag)
}

/**
 * Create a new Trinity clan
 * @param {Object} clanData - Clan data
 * @returns {Promise<Object>} Created clan
 */
export const createTrinityClan = async (clanData) => {
  const { tag } = clanData
  const normalizedTag = tag.startsWith('#') ? tag : `#${tag}`
  
  // Check if clan already exists
  const existing = await getTrinityClanByTag(normalizedTag)
  if (existing) {
    throw new Error('Clan with this tag already exists')
  }
  
  // Auto-fetch clan name if not provided
  let clanName = clanData.name || ''
  if (!clanName) {
    try {
      const clanDetails = await getClanDetails(normalizedTag)
      if (clanDetails && clanDetails.name) {
        clanName = clanDetails.name
      }
    } catch (err) {
      // Silently fail - clan name is optional
      console.warn(`Could not auto-fetch clan name for ${normalizedTag}:`, err.message)
    }
  }
  
  const clan = {
    tag: normalizedTag,
    status: clanData.status || 'Active',
    name: clanName,
    createdAt: new Date(),
    updatedAt: new Date()
  }
  
  const inserted = await databaseService.insert('trinityClans', clan)
  if (!inserted) {
    throw new Error('Failed to create clan')
  }
  
  return await getTrinityClanByTag(normalizedTag)
}

/**
 * Update a Trinity clan
 * @param {string} tag - Clan tag
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated clan
 */
export const updateTrinityClan = async (tag, updates) => {
  const normalizedTag = tag.startsWith('#') ? tag : `#${tag}`
  
  const existing = await getTrinityClanByTag(normalizedTag)
  if (!existing) {
    throw new Error('Clan not found')
  }
  
  const updateData = {}
  if (updates.status !== undefined) {
    updateData.status = updates.status
  }
  if (updates.name !== undefined) {
    // Auto-fetch clan name if updating to empty
    if (!updates.name) {
      try {
        const clanDetails = await getClanDetails(normalizedTag)
        if (clanDetails && clanDetails.name) {
          updateData.name = clanDetails.name
        } else {
          updateData.name = ''
        }
      } catch (err) {
        updateData.name = ''
      }
    } else {
      updateData.name = updates.name
    }
  }
  
  const updated = await databaseService.update('trinityClans', { tag: normalizedTag }, updateData)
  if (!updated) {
    throw new Error('Failed to update clan')
  }
  
  return await getTrinityClanByTag(normalizedTag)
}

/**
 * Delete a Trinity clan
 * @param {string} tag - Clan tag
 * @returns {Promise<boolean>} True if deleted
 */
export const deleteTrinityClan = async (tag) => {
  const normalizedTag = tag.startsWith('#') ? tag : `#${tag}`
  return await databaseService.delete('trinityClans', { tag: normalizedTag })
}

/**
 * CWL Clan Management Service
 * Manages CWL clans (clans used for CWL)
 */

/**
 * Get all CWL clans
 * @returns {Promise<Array>} Array of CWL clans sorted by inUse
 */
export const getCWLClans = async () => {
  const clans = await databaseService.find('cwlClans', {}, { sort: { inUse: 1 } })
  return clans
}

/**
 * Get CWL clan by tag
 * @param {string} tag - Clan tag
 * @returns {Promise<Object|null>} CWL clan or null
 */
export const getCWLClanByTag = async (tag) => {
  const normalizedTag = tag.startsWith('#') ? tag : `#${tag}`
  return await databaseService.findOne('cwlClans', { tag: normalizedTag })
}

/**
 * Get active CWL clan tags
 * @returns {Promise<Array<string>} Array of active CWL clan tags
 */
export const getActiveCWLClanTags = async () => {
  // Get all clans, then filter for Active status or missing status (backward compatibility)
  const allClans = await databaseService.find('cwlClans', {}, { sort: { inUse: 1 } })
  const activeClans = allClans.filter(clan => !clan.status || clan.status === 'Active')
  return activeClans.map(clan => clan.tag)
}

/**
 * Get CWL clan details (same as getCWLClans, but kept for compatibility)
 * @returns {Promise<Array>} Array of CWL clan details
 */
export const getCWLClanDetails = async () => {
  return await getCWLClans()
}

/**
 * Get active CWL clan details (filtered by status)
 * @returns {Promise<Array>} Array of active CWL clan details
 */
export const getActiveCWLClanDetails = async () => {
  const allClans = await getCWLClans()
  // Filter for Active status or missing status (backward compatibility)
  return allClans.filter(clan => !clan.status || clan.status === 'Active')
}

/**
 * Create a new CWL clan
 * @param {Object} clanData - CWL clan data
 * @returns {Promise<Object>} Created CWL clan
 */
export const createCWLClan = async (clanData) => {
  const { tag, inUse } = clanData
  const normalizedTag = tag.startsWith('#') ? tag : `#${tag}`
  
  // Check if clan already exists
  const existing = await getCWLClanByTag(normalizedTag)
  if (existing) {
    throw new Error('CWL clan with this tag already exists')
  }
  
  // Check if inUse number is already taken
  const existingInUse = await databaseService.findOne('cwlClans', { inUse: parseInt(inUse) })
  if (existingInUse) {
    throw new Error(`A CWL clan with inUse number ${inUse} already exists`)
  }
  
  // Auto-fetch clan name and league if not provided
  let clanName = clanData.name || ''
  let leagueName = clanData.league || ''
  
  if (!clanName || !leagueName) {
    try {
      const clanDetails = await getClanDetails(normalizedTag)
      if (clanDetails) {
        if (!clanName && clanDetails.name) {
          clanName = clanDetails.name
        }
        // Auto-parse league from warLeague if not provided
        if (!leagueName && clanDetails.warLeague && clanDetails.warLeague.name) {
          leagueName = parseLeagueName(clanDetails.warLeague.name)
        }
      }
    } catch (err) {
      // Silently fail - clan name and league are optional
      console.warn(`Could not auto-fetch clan data for ${normalizedTag}:`, err.message)
    }
  }
  
  const clan = {
    tag: normalizedTag,
    inUse: parseInt(inUse),
    name: clanName,
    format: clanData.format || '',
    members: clanData.members || '',
    townHall: normalizeTownHall(clanData.townHall),
    weight: normalizeWeight(clanData.weight),
    league: leagueName,
    status: clanData.status || 'Active',
    createdAt: new Date(),
    updatedAt: new Date()
  }
  
  const inserted = await databaseService.insert('cwlClans', clan)
  if (!inserted) {
    throw new Error('Failed to create CWL clan')
  }
  
  return await getCWLClanByTag(normalizedTag)
}

/**
 * Update a CWL clan
 * @param {string} tag - Clan tag
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated CWL clan
 */
export const updateCWLClan = async (tag, updates) => {
  const normalizedTag = tag.startsWith('#') ? tag : `#${tag}`
  
  const existing = await getCWLClanByTag(normalizedTag)
  if (!existing) {
    throw new Error('CWL clan not found')
  }
  
  const updateData = {}
  if (updates.inUse !== undefined) {
    // Check if new inUse number is already taken by another clan
    const existingInUse = await databaseService.findOne('cwlClans', { 
      inUse: parseInt(updates.inUse),
      tag: { $ne: normalizedTag }
    })
    if (existingInUse) {
      throw new Error(`A CWL clan with inUse number ${updates.inUse} already exists`)
    }
    updateData.inUse = parseInt(updates.inUse)
  }
  if (updates.name !== undefined) {
    // Auto-fetch clan name if updating to empty and tag exists
    if (!updates.name) {
      try {
        const clanDetails = await getClanDetails(normalizedTag)
        if (clanDetails && clanDetails.name) {
          updateData.name = clanDetails.name
        } else {
          updateData.name = ''
        }
      } catch (err) {
        updateData.name = ''
      }
    } else {
      updateData.name = updates.name
    }
  }
  if (updates.league !== undefined) {
    // Auto-parse league from warLeague if updating to empty
    if (!updates.league) {
      try {
        const clanDetails = await getClanDetails(normalizedTag)
        if (clanDetails && clanDetails.warLeague && clanDetails.warLeague.name) {
          updateData.league = parseLeagueName(clanDetails.warLeague.name)
        } else {
          updateData.league = ''
        }
      } catch (err) {
        updateData.league = ''
      }
    } else {
      updateData.league = updates.league
    }
  }
  if (updates.format !== undefined) updateData.format = updates.format
  if (updates.members !== undefined) updateData.members = updates.members
  if (updates.townHall !== undefined) updateData.townHall = normalizeTownHall(updates.townHall)
  if (updates.weight !== undefined) updateData.weight = normalizeWeight(updates.weight)
  if (updates.status !== undefined) updateData.status = updates.status
  
  const updated = await databaseService.update('cwlClans', { tag: normalizedTag }, updateData)
  if (!updated) {
    throw new Error('Failed to update CWL clan')
  }
  
  return await getCWLClanByTag(normalizedTag)
}

/**
 * Delete a CWL clan
 * @param {string} tag - Clan tag
 * @returns {Promise<boolean>} True if deleted
 */
export const deleteCWLClan = async (tag) => {
  const normalizedTag = tag.startsWith('#') ? tag : `#${tag}`
  return await databaseService.delete('cwlClans', { tag: normalizedTag })
}

/**
 * Base Layout Management Service
 * Manages farming base layouts
 */

/**
 * Get all base layouts
 * @returns {Promise<Array>} Array of base layouts sorted by townHallLevel (descending)
 */
export const getBaseLayouts = async () => {
  const layouts = await databaseService.find('baseLayouts', {}, { sort: { townHallLevel: -1 } })
  return layouts
}

/**
 * Get base layout by town hall level
 * @param {number} townHallLevel - Town hall level
 * @returns {Promise<Object|null>} Base layout or null
 */
export const getBaseLayoutByTH = async (townHallLevel) => {
  return await databaseService.findOne('baseLayouts', { townHallLevel: parseInt(townHallLevel) })
}

/**
 * Create a new base layout
 * @param {Object} layoutData - Base layout data
 * @returns {Promise<Object>} Created base layout
 */
export const createBaseLayout = async (layoutData) => {
  const { townHallLevel, link, imagePath } = layoutData
  
  // Check if layout for this TH level already exists
  const existing = await getBaseLayoutByTH(townHallLevel)
  if (existing) {
    throw new Error(`Base layout for TH${townHallLevel} already exists`)
  }
  
  const layout = {
    townHallLevel: parseInt(townHallLevel),
    link: link || '',
    imagePath: imagePath || '',
    createdAt: new Date(),
    updatedAt: new Date()
  }
  
  const inserted = await databaseService.insert('baseLayouts', layout)
  if (!inserted) {
    throw new Error('Failed to create base layout')
  }
  
  return await getBaseLayoutByTH(townHallLevel)
}

/**
 * Update a base layout
 * @param {number} townHallLevel - Town hall level
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated base layout
 */
export const updateBaseLayout = async (townHallLevel, updates) => {
  const th = parseInt(townHallLevel)
  
  const existing = await getBaseLayoutByTH(th)
  if (!existing) {
    throw new Error('Base layout not found')
  }
  
  const updateData = {}
  if (updates.link !== undefined) updateData.link = updates.link
  if (updates.imagePath !== undefined) updateData.imagePath = updates.imagePath
  
  const updated = await databaseService.update('baseLayouts', { townHallLevel: th }, updateData)
  if (!updated) {
    throw new Error('Failed to update base layout')
  }
  
  return await getBaseLayoutByTH(th)
}

/**
 * Delete a base layout
 * @param {number} townHallLevel - Town hall level
 * @returns {Promise<boolean>} True if deleted
 */
export const deleteBaseLayout = async (townHallLevel) => {
  const th = parseInt(townHallLevel)
  return await databaseService.delete('baseLayouts', { townHallLevel: th })
}

