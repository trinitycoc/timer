// API client for making requests to the backend server

const API_BASE_URL = import.meta.env.VITE_API_URL

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

/** Authenticated fetch; throws with errorData.message or defaultErrorMessage when !response.ok. Returns response. */
const authFetch = async (path, options = {}, defaultErrorMessage = 'Request failed') => {
  const { method = 'GET', body, ...rest } = options
  const headers = { ...getAuthHeaders(), ...(rest.headers || {}) }
  if (body !== undefined && (method === 'PUT' || method === 'POST')) {
    headers['Content-Type'] = 'application/json'
  }
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    ...rest,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  })
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.message || defaultErrorMessage)
  }
  return response
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
 * Fetch all active GFL family clans in one request (backend gets tags + details)
 * Use this instead of fetchGFLClansFromSheet + fetchMultipleClans for the Clans page.
 */
export const fetchGFLFamilyClans = async (options = {}) => {
  try {
    if (!API_BASE_URL) {
      throw new Error('API URL is not configured. Please set VITE_API_URL in your .env file')
    }
    const cacheKey = 'gfl-family-clans'
    if (!options.forceRefresh) {
      const cached = getCachedData(multipleClansCache, cacheKey)
      if (cached) return cached
    }
    const response = await fetch(`${API_BASE_URL}/clans/gfl-family`)
    if (!response.ok) {
      throw new Error(`Failed to fetch GFL family clans: ${response.statusText}`)
    }
    const data = await response.json()
    setCachedData(multipleClansCache, cacheKey, data)
    if (Array.isArray(data)) {
      data.forEach((clan) => {
        if (clan?.tag) {
          const tagKey = normalizeClanTag(clan.tag)
          if (tagKey) setCachedData(clanCache, tagKey, clan)
        }
      })
    }
    return data
  } catch (error) {
    console.error('Error fetching GFL family clans:', error)
    throw error
  }
}

/**
 * Fetch all active following clans in one request (same shape as gfl-family)
 */
export const fetchFollowingFamilyClans = async (options = {}) => {
  try {
    if (!API_BASE_URL) {
      throw new Error('API URL is not configured. Please set VITE_API_URL in your .env file')
    }
    const cacheKey = 'following-family-clans'
    if (!options.forceRefresh) {
      const cached = getCachedData(multipleClansCache, cacheKey)
      if (cached) return cached
    }
    const response = await fetch(`${API_BASE_URL}/clans/following-family`)
    if (!response.ok) {
      throw new Error(`Failed to fetch following clans: ${response.statusText}`)
    }
    const data = await response.json()
    setCachedData(multipleClansCache, cacheKey, data)
    if (Array.isArray(data)) {
      data.forEach((clan) => {
        if (clan?.tag) {
          const tagKey = normalizeClanTag(clan.tag)
          if (tagKey) setCachedData(clanCache, tagKey, clan)
        }
      })
    }
    return data
  } catch (error) {
    console.error('Error fetching following family clans:', error)
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
 * Fetch clan + current war + war log in one request (backend combines all three)
 * Use for ClanDetails page instead of 3 separate calls.
 */
export const fetchClanFullDetails = async (clanTag, options = {}) => {
  try {
    if (!API_BASE_URL) {
      throw new Error('API URL is not configured. Please set VITE_API_URL in your .env file')
    }
    const normalizedTag = normalizeClanTag(clanTag)
    if (!normalizedTag) {
      throw new Error('Clan tag is required')
    }
    const cacheKey = `clan-full:${normalizedTag}`
    if (!options.forceRefresh) {
      const cached = getCachedData(clanCache, cacheKey)
      if (cached) return cached
    }
    const encodedTag = encodeURIComponent(normalizedTag)
    const response = await fetch(`${API_BASE_URL}/clans/${encodedTag}/full`)
    if (!response.ok) {
      throw new Error(`Failed to fetch clan details: ${response.statusText}`)
    }
    const data = await response.json()
    setCachedData(clanCache, cacheKey, data)
    if (data.clan?.tag) {
      setCachedData(clanCache, normalizedTag, data.clan)
    }
    return data
  } catch (error) {
    console.error('Error fetching clan full details:', error)
    throw error
  }
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
// GFL CLANS ENDPOINTS (Public)
// ============================================

/**
 * Fetch GFL clan tags from database (via backend)
 */
export const fetchGFLClansFromSheet = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/gfl-clans`)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch GFL clans: ${response.statusText}`)
    }
    
    const data = await response.json()
    return data.clanTags
  } catch (error) {
    console.error('Error fetching GFL clans:', error)
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
// ADMIN ENDPOINTS (Root user only)
// ============================================

/**
 * Get all GFL clans (admin)
 */
export const getGFLClans = async () => {
  try {
    const data = await authFetch('/admin/gfl-clans', {}, 'Failed to fetch GFL clans').then((r) => r.json())
    return data.clans
  } catch (error) {
    console.error('Error fetching GFL clans:', error)
    throw error
  }
}

/**
 * Create a GFL clan (admin)
 */
export const createGFLClan = async (clanData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/gfl-clans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(clanData)
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || 'Failed to create GFL clan')
    }
    
    const data = await response.json()
    return data.clan
  } catch (error) {
    console.error('Error creating GFL clan:', error)
    throw error
  }
}

/**
 * Update a GFL clan (admin)
 */
export const updateGFLClan = async (tag, updates) => {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/gfl-clans/${encodeURIComponent(tag)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(updates)
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || 'Failed to update GFL clan')
    }
    
    const data = await response.json()
    return data.clan
  } catch (error) {
    console.error('Error updating GFL clan:', error)
    throw error
  }
}

/**
 * Delete a GFL clan (admin)
 */
export const deleteGFLClan = async (tag) => {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/gfl-clans/${encodeURIComponent(tag)}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || 'Failed to delete GFL clan')
    }
    
    return true
  } catch (error) {
    console.error('Error deleting GFL clan:', error)
    throw error
  }
}

/**
 * Force sync GFL clans from Google Sheet (admin)
 */
export const forceSyncGFLClansFromSheet = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/gfl-clans/sync`, {
      method: 'POST',
      headers: getAuthHeaders()
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || 'Failed to sync from sheet')
    }
    
    return await response.json()
  } catch (error) {
    console.error('Error syncing GFL clans from sheet:', error)
    throw error
  }
}

// ============================================
// FOLLOWING CLANS (admin)
// ============================================

/**
 * Get all following clans (admin)
 */
export const getFollowingClans = async () => {
  try {
    const data = await authFetch('/admin/following-clans', {}, 'Failed to fetch following clans').then((r) => r.json())
    return data.clans
  } catch (error) {
    console.error('Error fetching following clans:', error)
    throw error
  }
}

/**
 * Force sync following clans from Google Sheet (admin, columns D/E/G)
 */
export const forceSyncFollowingClansFromSheet = async () => {
  try {
    return await authFetch('/admin/following-clans/sync', { method: 'POST' }, 'Failed to sync following clans from sheet').then((r) => r.json())
  } catch (error) {
    console.error('Error syncing following clans from sheet:', error)
    throw error
  }
}

// ============================================
// SETTINGS (sync time)
// ============================================

/**
 * Get sync date/time - admin. Returns { syncAt: ISO string }.
 */
export const getSyncTime = async () => {
  return authFetch('/admin/settings/sync-time', {}, 'Failed to fetch sync time').then((r) => r.json())
}

/**
 * Set sync date/time - admin. syncAt: ISO string.
 */
export const setSyncTime = async (syncAt) => {
  const data = await authFetch('/admin/settings/sync-time', { method: 'PUT', body: { syncAt } }, 'Failed to save sync time').then((r) => r.json())
  return data.syncAt
}

/**
 * Get track-clans settings - admin.
 */
export const getTrackSettings = async () => {
  return authFetch('/admin/settings/track-clans', {}, 'Failed to fetch track settings').then((r) => r.json())
}

/**
 * Set track-clans settings - admin.
 */
export const setTrackSettings = async (settings) => {
  return authFetch('/admin/settings/track-clans', { method: 'PUT', body: settings }, 'Failed to save track settings').then((r) => r.json())
}
