// Get base URL from Vite (handles deployment subpaths like /trinity/)
const BASE_URL = import.meta.env.BASE_URL

// Use base URL for paths since files are in public folder
// Vite serves files from public/ at the base path
export const leagueImages = {
  // Format with "League" (from API)
  'Bronze League I': `${BASE_URL}bronze1.png`,
  'Bronze League II': `${BASE_URL}bronze2.png`,
  'Bronze League III': `${BASE_URL}bronze3.png`,
  'Silver League I': `${BASE_URL}silver1.png`,
  'Silver League II': `${BASE_URL}silver2.png`,
  'Silver League III': `${BASE_URL}silver3.png`,
  'Gold League I': `${BASE_URL}gold1.png`,
  'Gold League II': `${BASE_URL}gold2.png`,
  'Gold League III': `${BASE_URL}gold3.png`,
  'Crystal League I': `${BASE_URL}crystal1.png`,
  'Crystal League II': `${BASE_URL}crystal2.png`,
  'Crystal League III': `${BASE_URL}crystal3.png`,
  'Master League I': `${BASE_URL}master1.png`,
  'Master League II': `${BASE_URL}master2.png`,
  'Master League III': `${BASE_URL}master3.png`,
  'Champion League I': `${BASE_URL}champion1.png`,
  'Champion League II': `${BASE_URL}champion2.png`,
  'Champion League III': `${BASE_URL}champion3.png`,
  // Format without "League" (fallback)
  'Bronze I': `${BASE_URL}bronze1.png`,
  'Bronze II': `${BASE_URL}bronze2.png`,
  'Bronze III': `${BASE_URL}bronze3.png`,
  'Silver I': `${BASE_URL}silver1.png`,
  'Silver II': `${BASE_URL}silver2.png`,
  'Silver III': `${BASE_URL}silver3.png`,
  'Gold I': `${BASE_URL}gold1.png`,
  'Gold II': `${BASE_URL}gold2.png`,
  'Gold III': `${BASE_URL}gold3.png`,
  'Crystal I': `${BASE_URL}crystal1.png`,
  'Crystal II': `${BASE_URL}crystal2.png`,
  'Crystal III': `${BASE_URL}crystal3.png`,
  'Master I': `${BASE_URL}master1.png`,
  'Master II': `${BASE_URL}master2.png`,
  'Master III': `${BASE_URL}master3.png`,
  'Champion I': `${BASE_URL}champion1.png`,
  'Champion II': `${BASE_URL}champion2.png`,
  'Champion III': `${BASE_URL}champion3.png`
}

/**
 * Get league image by league name
 * @param {string} leagueName - League name (e.g., "Master I", "Crystal III")
 * @returns {string|null} Image path or null if not found
 */
export const getLeagueImage = (leagueName) => {
  if (!leagueName) return null
  return leagueImages[leagueName] || null
}

