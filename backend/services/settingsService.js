import databaseService from './databaseService.js'

const COLLECTION = 'appSettings'
const SYNC_SETTINGS_ID = 'sync'
const TRACK_CLANS_ID = 'trackClans'

/**
 * Get stored sync datetime (ISO string). Returns null if not set.
 */
export async function getSyncAt() {
  const doc = await databaseService.findOne(COLLECTION, { _id: SYNC_SETTINGS_ID })
  const syncAt = doc?.syncAt
  if (!syncAt) return null
  const d = new Date(syncAt)
  return isNaN(d.getTime()) ? null : d
}

/**
 * Get sync settings for API: syncAt as ISO string (or default tomorrow at 02:00 for display).
 */
export async function getSyncTime() {
  const doc = await databaseService.findOne(COLLECTION, { _id: SYNC_SETTINGS_ID })
  const syncAt = doc?.syncAt
  if (syncAt) {
    const d = new Date(syncAt)
    if (!isNaN(d.getTime())) return { syncAt: d.toISOString() }
  }
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(2, 0, 0, 0)
  return { syncAt: tomorrow.toISOString() }
}

/**
 * Set sync datetime (ISO string). Persists to DB.
 */
export async function setSyncTime(syncAt) {
  const str = String(syncAt).trim()
  const d = new Date(str)
  if (isNaN(d.getTime())) {
    throw new Error('Invalid sync date/time. Use ISO format (e.g. 2025-03-20T02:00:00.000Z).')
  }
  const ok = await databaseService.upsert(COLLECTION, { _id: SYNC_SETTINGS_ID }, { syncAt: str })
  if (!ok) throw new Error('Database unavailable. Could not save sync time.')
  return d.toISOString()
}

/**
 * Advance stored syncAt to same time next day (after a run).
 */
export async function advanceSyncAtToNextDay() {
  const doc = await databaseService.findOne(COLLECTION, { _id: SYNC_SETTINGS_ID })
  const syncAt = doc?.syncAt
  if (!syncAt) return
  const d = new Date(syncAt)
  if (isNaN(d.getTime())) return
  d.setDate(d.getDate() + 1)
  await databaseService.upsert(COLLECTION, { _id: SYNC_SETTINGS_ID }, { syncAt: d.toISOString() })
}

/** Treat only explicit true as true (avoids string "false" being truthy). */
function toBool(v) {
  return v === true || String(v).toLowerCase() === 'true'
}

/**
 * Get track-clans settings: which groups to include in war status check.
 * @returns {Promise<{ trackAllGFL: boolean, trackVaryClans: boolean, trackFollowingClans: boolean }>}
 */
export async function getTrackSettings() {
  const doc = await databaseService.findOne(COLLECTION, { _id: TRACK_CLANS_ID })
  return {
    trackAllGFL: toBool(doc?.trackAllGFL),
    trackVaryClans: toBool(doc?.trackVaryClans),
    trackFollowingClans: toBool(doc?.trackFollowingClans)
  }
}

/**
 * Set track-clans settings.
 */
export async function setTrackSettings({ trackAllGFL, trackVaryClans, trackFollowingClans }) {
  const ok = await databaseService.upsert(COLLECTION, { _id: TRACK_CLANS_ID }, {
    trackAllGFL: toBool(trackAllGFL),
    trackVaryClans: toBool(trackVaryClans),
    trackFollowingClans: toBool(trackFollowingClans)
  })
  if (!ok) throw new Error('Database unavailable. Could not save track settings.')
  return getTrackSettings()
}
