import { databaseService } from './databaseService.js'
import { getClanDetails } from './clashOfClansService.js'

/**
 * GFL Clan Management Service
 * Manages GFL clans (clans that are part of GFL family)
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
 * Get all GFL clans
 * @param {Object} filters - Optional filters (status, etc.)
 * @returns {Promise<Array>} Array of GFL clans
 */
export const getGFLClans = async (filters = {}) => {
  const query = {}
  
  if (filters.status) {
    query.status = filters.status
  }
  
  const clans = await databaseService.find('gflClans', query, { sort: { createdAt: 1 } })
  return clans
}

/**
 * Get GFL clan by tag
 * @param {string} tag - Clan tag (with or without #)
 * @returns {Promise<Object|null>} GFL clan or null
 */
export const getGFLClanByTag = async (tag) => {
  const normalizedTag = tag.startsWith('#') ? tag : `#${tag}`
  return await databaseService.findOne('gflClans', { tag: normalizedTag })
}

/**
 * Get active GFL clan tags
 * @returns {Promise<Array<string>} Array of active clan tags
 */
export const getActiveGFLClanTags = async () => {
  const clans = await databaseService.find('gflClans', { status: 'Active' }, { sort: { createdAt: 1 } })
  return clans.map(clan => clan.tag)
}

/**
 * Parse vary to number (minutes). Sheet/DB store as string or number e.g. "-4", "4", "0". Default 0.
 */
function parseVary(vary) {
  if (vary === undefined || vary === null || vary === '') return 0
  const n = Number(vary)
  return Number.isFinite(n) ? n : 0
}

/**
 * Get active GFL clans with vary (for war status check window). vary is in minutes.
 * @returns {Promise<{ clans: Array<{ tag: string, vary: number }>, minVary: number, maxVary: number }>}
 */
export const getActiveGFLClansWithVary = async () => {
  const clans = await databaseService.find('gflClans', { status: 'Active' }, { sort: { createdAt: 1 } })
  const withVary = clans.map((c) => {
    const vary = parseVary(c.vary)
    return { tag: c.tag, vary, rawVary: c.vary }
  })
  if (withVary.length === 0) {
    return { clans: [], minVary: 0, maxVary: 0 }
  }
  const varys = withVary.map((c) => c.vary)
  const minVary = Math.min(...varys)
  const maxVary = Math.max(...varys)
  return { clans: withVary, minVary, maxVary }
}

/**
 * Create a new GFL clan
 * @param {Object} clanData - Clan data
 * @returns {Promise<Object>} Created clan
 */
export const createGFLClan = async (clanData) => {
  const { tag } = clanData
  const normalizedTag = tag.startsWith('#') ? tag : `#${tag}`
  
  // Check if clan already exists
  const existing = await getGFLClanByTag(normalizedTag)
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
  
  const inserted = await databaseService.insert('gflClans', clan)
  if (!inserted) {
    throw new Error('Failed to create clan')
  }
  
  return await getGFLClanByTag(normalizedTag)
}

/**
 * Update a GFL clan
 * @param {string} tag - Clan tag
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated clan
 */
export const updateGFLClan = async (tag, updates) => {
  const normalizedTag = tag.startsWith('#') ? tag : `#${tag}`
  
  const existing = await getGFLClanByTag(normalizedTag)
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
  
  const updated = await databaseService.update('gflClans', { tag: normalizedTag }, updateData)
  if (!updated) {
    throw new Error('Failed to update clan')
  }
  
  return await getGFLClanByTag(normalizedTag)
}

/**
 * Delete a GFL clan
 * @param {string} tag - Clan tag
 * @returns {Promise<boolean>} True if deleted
 */
export const deleteGFLClan = async (tag) => {
  const normalizedTag = tag.startsWith('#') ? tag : `#${tag}`
  return await databaseService.delete('gflClans', { tag: normalizedTag })
}

/**
 * Upsert a GFL clan from sheet row (used by hourly sheet sync)
 * @param {Object} row - { tag, name, status, vary }
 * @returns {Promise<Object>} The clan document after upsert
 */
export const upsertGFLClanFromSheet = async (row) => {
  const normalizedTag = row.tag.startsWith('#') ? row.tag : `#${row.tag}`
  const existing = await getGFLClanByTag(normalizedTag)
  const data = {
    tag: normalizedTag,
    name: row.name || '',
    status: row.status || 'Active',
    vary: row.vary != null ? String(row.vary) : '',
    updatedAt: new Date()
  }
  if (existing) {
    await databaseService.update('gflClans', { tag: normalizedTag }, {
      name: data.name,
      status: data.status,
      vary: data.vary
    })
  } else {
    await databaseService.insert('gflClans', {
      ...data,
      createdAt: new Date()
    })
  }
  return await getGFLClanByTag(normalizedTag)
}

// ============================================
// FOLLOWING CLANS (from sheet: D=tag, E=name, G=status; no vary)
// ============================================

export const getFollowingClans = async (filters = {}) => {
  const query = {}
  if (filters.status) query.status = filters.status
  return await databaseService.find('followingClans', query, { sort: { createdAt: 1 } })
}

export const getFollowingClanByTag = async (tag) => {
  const normalizedTag = tag.startsWith('#') ? tag : `#${tag}`
  return await databaseService.findOne('followingClans', { tag: normalizedTag })
}

export const getActiveFollowingClanTags = async () => {
  const clans = await databaseService.find('followingClans', { status: 'Active' }, { sort: { createdAt: 1 } })
  return clans.map((c) => c.tag)
}

/**
 * Upsert a following clan from sheet row (tag, name, status only; no vary)
 */
export const upsertFollowingClanFromSheet = async (row) => {
  const normalizedTag = row.tag.startsWith('#') ? row.tag : `#${row.tag}`
  const existing = await getFollowingClanByTag(normalizedTag)
  const data = {
    tag: normalizedTag,
    name: row.name || '',
    status: row.status || 'Active',
    updatedAt: new Date()
  }
  if (existing) {
    await databaseService.update('followingClans', { tag: normalizedTag }, {
      name: data.name,
      status: data.status
    })
  } else {
    await databaseService.insert('followingClans', {
      ...data,
      createdAt: new Date()
    })
  }
  return await getFollowingClanByTag(normalizedTag)
}

