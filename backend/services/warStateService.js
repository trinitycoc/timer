import databaseService from './databaseService.js'
import logger from '../utils/logger.js'

const COLLECTION = 'clanWarState'

function normalizeTag(tag) {
  if (!tag) return ''
  return tag.startsWith('#') ? tag : `#${tag}`
}

/**
 * Record that we observed "notInWar" for this clan at the current time.
 * Used to track when each clan's war ended (so we can compare war start/end times across clans).
 */
export async function recordNotInWarObserved(clanTag) {
  const tag = normalizeTag(clanTag)
  if (!tag) return false
  try {
    const now = new Date()
    const ok = await databaseService.upsert(
      COLLECTION,
      { clanTag: tag },
      { clanTag: tag, lastNotInWarAt: now }
    )
    if (ok) {
      logger.debug(`War state: recorded notInWar at ${now.toISOString()} for ${tag}`)
    }
    return ok
  } catch (error) {
    logger.error('warStateService.recordNotInWarObserved:', error.message)
    return false
  }
}

/**
 * Get lastNotInWarAt timestamps for the given clan tags.
 * @param {string[]} clanTags - Array of clan tags (with or without #)
 * @returns {Promise<Map<string, Date>>} Map of normalized clanTag -> lastNotInWarAt
 */
export async function getLastNotInWarTimestamps(clanTags) {
  if (!Array.isArray(clanTags) || clanTags.length === 0) return new Map()
  const normalized = clanTags.map(normalizeTag).filter(Boolean)
  if (normalized.length === 0) return new Map()
  try {
    const docs = await databaseService.find(COLLECTION, { clanTag: { $in: normalized } })
    const map = new Map()
    for (const doc of docs) {
      if (doc.lastNotInWarAt) {
        map.set(doc.clanTag, doc.lastNotInWarAt instanceof Date ? doc.lastNotInWarAt : new Date(doc.lastNotInWarAt))
      }
    }
    return map
  } catch (error) {
    logger.error('warStateService.getLastNotInWarTimestamps:', error.message)
    return new Map()
  }
}
