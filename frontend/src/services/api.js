// API client for making requests to the backend server

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

// Get auth token from localStorage
const getAuthToken = () => {
  return localStorage.getItem('auth_token')
}

// Set auth token in localStorage
export const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem('auth_token', token)
  } else {
    localStorage.removeItem('auth_token')
  }
}

// Get auth headers for authenticated requests
const getAuthHeaders = () => {
  const token = getAuthToken()
  return token ? { 'Authorization': `Bearer ${token}` } : {}
}


const TWO_MINUTES = 2 * 60 * 1000
const clanCache = new Map()
const multipleClansCache = new Map()

const getNow = () => Date.now()

const normalizeClanTag = (tag) => {
  if (!tag) return ''
  return tag.toString().trim().toUpperCase().replace(/^#+/, '')
}

const getCachedData = (cache, key, ttl = TWO_MINUTES) => {
  const entry = cache.get(key)
  if (!entry) return null

  if (getNow() - entry.timestamp > ttl) {
    cache.delete(key)
    return null
  }

  return entry.data
}

const setCachedData = (cache, key, data) => {
  cache.set(key, { data, timestamp: getNow() })
}

/**
 * Fetch a single clan by tag
 */
export const fetchClan = async (clanTag, options = {}) => {
  try {
    if (!API_BASE_URL) {
      throw new Error('API URL is not configured. Please set VITE_API_URL in your .env file')
    }

    const normalizedTag = normalizeClanTag(clanTag)
    if (!normalizedTag) {
      throw new Error('Clan tag is required')
    }

    const cacheKey = normalizedTag
    if (!options.forceRefresh) {
      const cached = getCachedData(clanCache, cacheKey)
      if (cached) {
        return cached
      }
    }

    // Remove # from tag for URL encoding
    const encodedTag = encodeURIComponent(normalizedTag)
    const response = await fetch(`${API_BASE_URL}/clans/${encodedTag}`)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch clan: ${response.statusText}`)
    }
    
    const data = await response.json()
    setCachedData(clanCache, cacheKey, data)
    return data
  } catch (error) {
    console.error('Error fetching clan:', error)
    throw error
  }
}

/**
 * Fetch multiple clans by tags
 */
export const fetchMultipleClans = async (clanTags, options = {}) => {
  try {
    if (!API_BASE_URL) {
      throw new Error('API URL is not configured. Please set VITE_API_URL in your .env file')
    }

    if (!Array.isArray(clanTags) || clanTags.length === 0) {
      throw new Error('Clan tags array is required')
    }

    const normalizedTags = clanTags.map(normalizeClanTag).filter(Boolean)
    const cacheKey = normalizedTags.slice().sort().join(',')

    if (!options.forceRefresh) {
      const cached = getCachedData(multipleClansCache, cacheKey)
      if (cached) {
        return cached
      }
    }

    const response = await fetch(`${API_BASE_URL}/clans/multiple`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ clanTags }),
    })
    
    if (!response.ok) {
      throw new Error(`Failed to fetch clans: ${response.statusText}`)
    }
    
    const data = await response.json()

    // Cache the full response
    setCachedData(multipleClansCache, cacheKey, data)

    // Hydrate individual clan cache entries for quicker single lookups
    if (Array.isArray(data)) {
      data.forEach((clan) => {
        if (clan?.tag) {
          const tagKey = normalizeClanTag(clan.tag)
          if (tagKey) {
            setCachedData(clanCache, tagKey, clan)
          }
        }
      })
    }

    return data
  } catch (error) {
    console.error('Error fetching multiple clans:', error)
    throw error
  }
}

export const clearClanCache = () => {
  clanCache.clear()
  multipleClansCache.clear()
}

/**
 * Get current war for a clan
 */
export const fetchClanWar = async (clanTag) => {
  try {
    const encodedTag = encodeURIComponent(clanTag.replace('#', ''))
    const response = await fetch(`${API_BASE_URL}/clans/${encodedTag}/war`)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch war data: ${response.statusText}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('Error fetching war data:', error)
    throw error
  }
}

/**
 * Get war log for a clan
 */
export const fetchClanWarLog = async (clanTag) => {
  try {
    const encodedTag = encodeURIComponent(clanTag.replace('#', ''))
    const response = await fetch(`${API_BASE_URL}/clans/${encodedTag}/warlog`)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch war log: ${response.statusText}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('Error fetching war log:', error)
    throw error
  }
}

/**
 * Check if backend server is running
 */
export const checkServerHealth = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/health`)
    
    if (!response.ok) {
      return false
    }
    
    const data = await response.json()
    return data.status === 'ok'
  } catch (error) {
    return false
  }
}

// ============================================
// TRINITY CLANS ENDPOINTS (Public)
// ============================================

/**
 * Fetch Trinity clan tags from database (via backend)
 */
export const fetchTrinityClansFromSheet = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/trinity-clans`)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch Trinity clans: ${response.statusText}`)
    }
    
    const data = await response.json()
    return data.clanTags
  } catch (error) {
    console.error('Error fetching Trinity clans:', error)
    throw error
  }
}

/**
 * Fetch CWL clan tags from database (via backend)
 */
export const fetchCWLClansFromSheet = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/cwl-clans`)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch CWL clans: ${response.statusText}`)
    }
    
    const data = await response.json()
    return data.clanTags
  } catch (error) {
    console.error('Error fetching CWL clans:', error)
    throw error
  }
}

/**
 * Fetch CWL clan details from database (via backend)
 */
export const fetchCWLClansDetailsFromSheet = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/cwl-clans/details`)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch CWL clan details: ${response.statusText}`)
    }
    
    const data = await response.json()
    return data.clans
  } catch (error) {
    console.error('Error fetching CWL clan details:', error)
    throw error
  }
}

// ============================================
// CWL ENDPOINTS
// ============================================

/**
 * Get filtered CWL clans (with all logic applied on backend)
 * @param {boolean} showAll - If true, returns all clans without filtering
 * @param {boolean} includeFilteredInfo - If true and showAll is true, also returns filtered clan tags
 */
export const fetchFilteredCWLClans = async (showAll = false, includeFilteredInfo = false) => {
  try {
    let url = showAll 
      ? `${API_BASE_URL}/cwl/clans?all=true`
      : `${API_BASE_URL}/cwl/clans`
    
    if (showAll && includeFilteredInfo) {
      url += '&includeFilteredInfo=true'
    }
    
    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch filtered CWL clans: ${response.statusText}`)
    }
    
    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching filtered CWL clans:', error)
    throw error
  }
}

// ============================================
// BASE LAYOUTS ENDPOINTS (Public)
// ============================================

/**
 * Fetch base layouts from database (via backend - public endpoint)
 */
export const fetchBaseLayouts = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/base-layouts`)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch base layouts: ${response.statusText}`)
    }
    
    const data = await response.json()
    return data.layouts
  } catch (error) {
    console.error('Error fetching base layouts:', error)
    throw error
  }
}

// ============================================
// AUTHENTICATION ENDPOINTS
// ============================================

/**
 * Register a new user
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {string} username - Username
 * @returns {Promise<Object>} User object and token
 */
export const register = async (email, password, username) => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password, username })
    })

    if (!response.ok) {
      // Try to parse error response as JSON, fallback to status text
      let errorMessage = 'Registration failed'
      try {
        const errorData = await response.json()
        errorMessage = errorData.message || errorMessage
      } catch {
        errorMessage = response.statusText || errorMessage
      }
      throw new Error(errorMessage)
    }

    const data = await response.json()

    // Store token if provided
    if (data.token) {
      setAuthToken(data.token)
    }

    return data
  } catch (error) {
    console.error('Registration error:', error)
    throw error
  }
}

/**
 * Login user
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<Object>} User object and token
 */
export const login = async (email, password) => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    })

    if (!response.ok) {
      // Try to parse error response as JSON, fallback to status text
      let errorMessage = 'Login failed'
      try {
        const errorData = await response.json()
        errorMessage = errorData.message || errorMessage
      } catch {
        errorMessage = response.statusText || errorMessage
      }
      throw new Error(errorMessage)
    }

    const data = await response.json()

    // Store token
    if (data.token) {
      setAuthToken(data.token)
    }

    return data
  } catch (error) {
    console.error('Login error:', error)
    throw error
  }
}

/**
 * Logout user (clears token)
 */
export const logout = () => {
  setAuthToken(null)
}

/**
 * Get current authenticated user
 * @returns {Promise<Object>} Current user object
 */
export const getCurrentUser = async () => {
  try {
    const token = getAuthToken()
    if (!token) {
      throw new Error('No authentication token')
    }

    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: getAuthHeaders()
    })

    if (!response.ok) {
      if (response.status === 401) {
        // Token invalid, clear it
        setAuthToken(null)
      }
      // Try to parse error response as JSON, fallback to status text
      let errorMessage = 'Failed to get current user'
      try {
        const errorData = await response.json()
        errorMessage = errorData.message || errorMessage
      } catch {
        errorMessage = response.statusText || errorMessage
      }
      throw new Error(errorMessage)
    }

    const data = await response.json()
    return data.user
  } catch (error) {
    console.error('Get current user error:', error)
    throw error
  }
}

/**
 * Change user password
 * @param {string} oldPassword - Current password
 * @param {string} newPassword - New password
 * @returns {Promise<Object>} Success response
 */
export const changePassword = async (oldPassword, newPassword) => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify({ oldPassword, newPassword })
    })

    if (!response.ok) {
      // Try to parse error response as JSON, fallback to status text
      let errorMessage = 'Failed to change password'
      try {
        const errorData = await response.json()
        errorMessage = errorData.message || errorMessage
      } catch {
        errorMessage = response.statusText || errorMessage
      }
      throw new Error(errorMessage)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Change password error:', error)
    throw error
  }
}

/**
 * Get all users (admin only)
 * @returns {Promise<Array>} Array of users
 */
export const getAllUsers = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/users`, {
      headers: getAuthHeaders()
    })

    if (!response.ok) {
      // Try to parse error response as JSON, fallback to status text
      let errorMessage = 'Failed to get users'
      try {
        const errorData = await response.json()
        errorMessage = errorData.message || errorMessage
      } catch {
        errorMessage = response.statusText || errorMessage
      }
      throw new Error(errorMessage)
    }

    const data = await response.json()
    return data.users
  } catch (error) {
    console.error('Get users error:', error)
    throw error
  }
}

/**
 * Update user (admin only, only root can update roles)
 * @param {string} identifier - User ID or email
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated user object
 */
export const updateUser = async (identifier, updates) => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/users/${encodeURIComponent(identifier)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(updates)
    })

    if (!response.ok) {
      // Try to parse error response as JSON, fallback to status text
      let errorMessage = 'Failed to update user'
      try {
        const errorData = await response.json()
        errorMessage = errorData.message || errorMessage
      } catch {
        errorMessage = response.statusText || errorMessage
      }
      throw new Error(errorMessage)
    }

    const data = await response.json()
    return data.user
  } catch (error) {
    console.error('Update user error:', error)
    throw error
  }
}

/**
 * Delete user (admin only)
 * @param {string} identifier - User ID or email
 * @returns {Promise<Object>} Success response
 */
export const deleteUser = async (identifier) => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/users/${encodeURIComponent(identifier)}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    })

    if (!response.ok) {
      // Try to parse error response as JSON, fallback to status text
      let errorMessage = 'Failed to delete user'
      try {
        const errorData = await response.json()
        errorMessage = errorData.message || errorMessage
      } catch {
        errorMessage = response.statusText || errorMessage
      }
      throw new Error(errorMessage)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Delete user error:', error)
    throw error
  }
}

// ============================================
// CWL ENDPOINTS
// ============================================

/**
 * Get CWL status for a specific clan
 * @param {string} clanTag - Clan tag (with or without #)
 */
export const fetchCWLStatus = async (clanTag) => {
  try {
    // Remove # from tag for URL encoding
    const encodedTag = encodeURIComponent(clanTag.replace('#', ''))
    const response = await fetch(`${API_BASE_URL}/cwl/clans/${encodedTag}/status`)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch CWL status: ${response.statusText}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('Error fetching CWL status:', error)
    throw error
  }
}

/**
 * Get current CWL group data for a specific clan
 * Uses the new simplified endpoint: /api/cwl/:clanTag/current
 * @param {string} clanTag - Clan tag (with or without #)
 * @param {boolean} includeAllWars - If true, uses /all endpoint instead
 * @param {string} leagueName - League name (not used in new endpoint, kept for compatibility)
 * @param {string} sortBy - Sort option for member summary: 'total' or round number (1-7) as string
 */
export const fetchCWLGroup = async (clanTag, includeAllWars = false, leagueName = null, sortBy = 'total') => {
  try {
    // Remove # from tag for URL encoding
    const encodedTag = encodeURIComponent(clanTag.replace('#', ''))
    
    // Use /all endpoint if includeAllWars is true, otherwise use /current
    let url
    if (includeAllWars) {
      // Add sortBy as query parameter
      const params = new URLSearchParams()
      if (sortBy && sortBy !== 'total') {
        params.append('sortBy', sortBy)
      }
      const queryString = params.toString()
      url = `${API_BASE_URL}/cwl/${encodedTag}/all${queryString ? `?${queryString}` : ''}`
    } else {
      url = `${API_BASE_URL}/cwl/${encodedTag}/current`
    }
    
    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch CWL group: ${response.statusText}`)
    }
    
    const data = await response.json()
    
    // Transform response to match expected structure
    if (includeAllWars) {
      // /all endpoint returns: { state, season, clans, rounds: [{ round, wars }], memberSummary, ... }
      // Backend now returns clan/opponent structure (not ourClan/opponent), so minimal transformation needed
      // Extract all wars from rounds and create flat arrays for backward compatibility
      const allWars = []
      const warsByRound = {}
      
      if (data.rounds && Array.isArray(data.rounds)) {
        data.rounds.forEach(round => {
          if (round.wars && round.wars.length > 0) {
            // Backend already returns clan/opponent structure, so use directly
            warsByRound[round.round] = round.wars
            allWars.push(...round.wars)
          }
        })
      }
      
      return {
        group: {
          state: data.state,
          season: data.season,
          clans: data.clans,
          rounds: data.rounds?.map(r => ({
            round: r.round,
            warTags: r.wars?.map(w => w.warTag).filter(Boolean) || []
          })) || []
        },
        rounds: data.rounds,
        allWars: allWars,
        warsByRound: warsByRound,
        currentWars: [], // Will be populated by fetching individual wars if needed
        memberSummary: data.memberSummary || [], // Pre-calculated member summary from backend
        ...data
      }
    } else {
      // /current endpoint returns: { state, season, clans, rounds, cached }
      return {
        group: {
          state: data.state,
          season: data.season,
          clans: data.clans,
          rounds: data.rounds
        },
        allWars: [], // Not included in /current endpoint
        currentWars: [], // Not included in /current endpoint
        memberSummary: [], // Not included in /current endpoint
        ...data
      }
    }
  } catch (error) {
    console.error('Error fetching CWL group:', error)
    throw error
  }
}

/**
 * Get CWL leaderboard for a specific clan (pre-calculated on backend)
 * @param {string} clanTag - Clan tag (with or without #)
 */
export const fetchCWLLeaderboard = async (clanTag) => {
  try {
    // Remove # from tag for URL encoding
    const encodedTag = encodeURIComponent(clanTag.replace('#', ''))
    const response = await fetch(`${API_BASE_URL}/cwl/clans/${encodedTag}/leaderboard`)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch CWL leaderboard: ${response.statusText}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('Error fetching CWL leaderboard:', error)
    throw error
  }
}

/**
 * Get CWL war details by war tag
 * Uses the new simplified endpoint: /api/cwl/war/:warTag
 * @param {string} warTag - War tag (with or without #)
 * @param {string} clanTag - Clan tag (kept for compatibility, not required in new endpoint)
 */
export const fetchCWLWarByTag = async (warTag, clanTag = null) => {
  try {
    // Remove # from war tag for URL encoding
    const encodedWarTag = encodeURIComponent(warTag.replace('#', ''))
    
    // New endpoint doesn't require clanTag query parameter
    const response = await fetch(`${API_BASE_URL}/cwl/war/${encodedWarTag}`)
    
    if (!response.ok) {
      // Handle 404 (war not found) more gracefully
      if (response.status === 404) {
        const errorData = await response.json().catch(() => ({ message: 'War not found' }))
        throw new Error(errorData.message || 'War not found')
      }
      throw new Error(`Failed to fetch war details: ${response.statusText}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('Error fetching war by tag:', error)
    throw error
  }
}

// ============================================
// STATS ENDPOINTS
// ============================================

/**
 * Get aggregated stats for a clan
 */
export const fetchClanStats = async (clanTag) => {
  try {
    const encodedTag = encodeURIComponent(clanTag.replace('#', ''))
    const response = await fetch(`${API_BASE_URL}/stats/clans/${encodedTag}`)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch clan stats: ${response.statusText}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('Error fetching clan stats:', error)
    throw error
  }
}

/**
 * Get TH distribution for a clan
 */
export const fetchClanTHDistribution = async (clanTag) => {
  try {
    const encodedTag = encodeURIComponent(clanTag.replace('#', ''))
    const response = await fetch(`${API_BASE_URL}/stats/clans/${encodedTag}/th-distribution`)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch TH distribution: ${response.statusText}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('Error fetching TH distribution:', error)
    throw error
  }
}

/**
 * Get Trinity family-wide statistics
 */
export const fetchTrinityFamilyStats = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/stats/family`)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch family stats: ${response.statusText}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('Error fetching family stats:', error)
    throw error
  }
}

// ============================================
// ADMIN ENDPOINTS (Root user only)
// ============================================

/**
 * Get all Trinity clans (admin)
 */
export const getTrinityClans = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/trinity-clans`, {
      headers: getAuthHeaders()
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || 'Failed to fetch Trinity clans')
    }
    
    const data = await response.json()
    return data.clans
  } catch (error) {
    console.error('Error fetching Trinity clans:', error)
    throw error
  }
}

/**
 * Create a Trinity clan (admin)
 */
export const createTrinityClan = async (clanData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/trinity-clans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(clanData)
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || 'Failed to create Trinity clan')
    }
    
    const data = await response.json()
    return data.clan
  } catch (error) {
    console.error('Error creating Trinity clan:', error)
    throw error
  }
}

/**
 * Update a Trinity clan (admin)
 */
export const updateTrinityClan = async (tag, updates) => {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/trinity-clans/${encodeURIComponent(tag)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(updates)
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || 'Failed to update Trinity clan')
    }
    
    const data = await response.json()
    return data.clan
  } catch (error) {
    console.error('Error updating Trinity clan:', error)
    throw error
  }
}

/**
 * Delete a Trinity clan (admin)
 */
export const deleteTrinityClan = async (tag) => {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/trinity-clans/${encodeURIComponent(tag)}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || 'Failed to delete Trinity clan')
    }
    
    return true
  } catch (error) {
    console.error('Error deleting Trinity clan:', error)
    throw error
  }
}

/**
 * Get all CWL clans (admin)
 */
export const getCWLClans = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/cwl-clans`, {
      headers: getAuthHeaders()
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || 'Failed to fetch CWL clans')
    }
    
    const data = await response.json()
    return data.clans
  } catch (error) {
    console.error('Error fetching CWL clans:', error)
    throw error
  }
}

/**
 * Create a CWL clan (admin)
 */
export const createCWLClan = async (clanData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/cwl-clans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(clanData)
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || 'Failed to create CWL clan')
    }
    
    const data = await response.json()
    return data.clan
  } catch (error) {
    console.error('Error creating CWL clan:', error)
    throw error
  }
}

/**
 * Update a CWL clan (admin)
 */
export const updateCWLClan = async (tag, updates) => {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/cwl-clans/${encodeURIComponent(tag)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(updates)
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || 'Failed to update CWL clan')
    }
    
    const data = await response.json()
    return data.clan
  } catch (error) {
    console.error('Error updating CWL clan:', error)
    throw error
  }
}

/**
 * Delete a CWL clan (admin)
 */
export const deleteCWLClan = async (tag) => {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/cwl-clans/${encodeURIComponent(tag)}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || 'Failed to delete CWL clan')
    }
    
    return true
  } catch (error) {
    console.error('Error deleting CWL clan:', error)
    throw error
  }
}

/**
 * Get all base layouts (admin)
 */
export const getBaseLayouts = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/base-layouts`, {
      headers: getAuthHeaders()
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || 'Failed to fetch base layouts')
    }
    
    const data = await response.json()
    return data.layouts
  } catch (error) {
    console.error('Error fetching base layouts:', error)
    throw error
  }
}

/**
 * Create a base layout (admin)
 */
export const createBaseLayout = async (layoutData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/base-layouts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(layoutData)
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || 'Failed to create base layout')
    }
    
    const data = await response.json()
    return data.layout
  } catch (error) {
    console.error('Error creating base layout:', error)
    throw error
  }
}

/**
 * Update a base layout (admin)
 */
export const updateBaseLayout = async (townHallLevel, updates) => {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/base-layouts/${townHallLevel}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(updates)
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || 'Failed to update base layout')
    }
    
    const data = await response.json()
    return data.layout
  } catch (error) {
    console.error('Error updating base layout:', error)
    throw error
  }
}

/**
 * Delete a base layout (admin)
 */
export const deleteBaseLayout = async (townHallLevel) => {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/base-layouts/${townHallLevel}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || 'Failed to delete base layout')
    }
    
    return true
  } catch (error) {
    console.error('Error deleting base layout:', error)
    throw error
  }
}

// ============================================
// CACHE ENDPOINTS
// ============================================

/**
 * Get cache statistics
 */
export const fetchCacheStats = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/cache/stats`)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch cache stats: ${response.statusText}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('Error fetching cache stats:', error)
    throw error
  }
}

/**
 * Clear all cache
 */
export const clearCache = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/cache/flush`, {
      method: 'DELETE'
    })
    
    if (!response.ok) {
      throw new Error(`Failed to clear cache: ${response.statusText}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('Error clearing cache:', error)
    throw error
  }
}

/**
 * Submit contact form feedback
 */
export const submitContactForm = async ({ name, email, message }) => {
  try {
    const response = await fetch(`${API_BASE_URL}/contact`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name, email, message })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => null)
      const errorMessage = errorData?.message || 'Failed to send feedback.'
      throw new Error(errorMessage)
    }

    return await response.json()
  } catch (error) {
    console.error('Error submitting contact form:', error)
    throw error
  }
}

