/**
 * War status check: sync window is 1 hour. We check clans continuously in the window:
 *   start = syncTime + minVary - 5 mins   (minVary in minutes)
 *   end   = syncTime + 60 mins + maxVary  (maxVary in minutes)
 * When we see notInWar, record timestamp and stop checking that clan for this cycle.
 */

import { getCurrentWar } from './clashOfClansService.js'
import { getActiveGFLClansWithVary, getActiveFollowingClanTags } from './clanManagementService.js'
import { recordNotInWarObserved } from './warStateService.js'
import { getTrackSettings } from './settingsService.js'
import logger from '../utils/logger.js'

const MS_PER_MINUTE = 60 * 1000
const SYNC_WINDOW_MS = 60 * 60 * 1000   // 1 hour
const START_BUFFER_MS = 5 * 60 * 1000   // 5 mins before: start = syncTime + minVary - 5 mins

/** Window bounds for war status check (single source of truth). */
export function getWarCheckWindow(syncAt, minVary, maxVary) {
  const windowStart = new Date(syncAt.getTime() + minVary * MS_PER_MINUTE - START_BUFFER_MS)
  const windowEnd = new Date(syncAt.getTime() + SYNC_WINDOW_MS + maxVary * MS_PER_MINUTE)
  return { windowStart, windowEnd }
}

function hasVaryNonZero(rawVary, parsedVary) {
  if (rawVary === undefined || rawVary === null || rawVary === '') return false
  return parsedVary !== 0
}

/**
 * Get clans to check based on track settings: trackAllGFL, trackVaryClans (GFL with vary ≠ 0 and not empty), trackFollowingClans.
 * @returns {Promise<{ clans: Array<{ tag: string, vary: number }>, minVary: number, maxVary: number }>}  vary in minutes
 */
export async function getClansToCheckWithVary() {
  const [track, gfl, followingTags] = await Promise.all([
    getTrackSettings(),
    getActiveGFLClansWithVary(),
    getActiveFollowingClanTags()
  ])

  const gflFiltered = gfl.clans.filter((c) => {
    if (track.trackAllGFL) return true
    if (track.trackVaryClans && hasVaryNonZero(c.rawVary, c.vary)) return true
    return false
  })

  const gflClans = gflFiltered.map((c) => ({ tag: c.tag, vary: c.vary }))
  const followingClans = track.trackFollowingClans ? followingTags.map((tag) => ({ tag, vary: 0 })) : []
  const allClans = [...gflClans, ...followingClans]

  const { minVary, maxVary } = allClans.length === 0
    ? { minVary: 0, maxVary: 0 }
    : allClans.reduce(
        (acc, c) => ({ minVary: Math.min(acc.minVary, c.vary), maxVary: Math.max(acc.maxVary, c.vary) }),
        { minVary: allClans[0].vary, maxVary: allClans[0].vary }
      )
  return { clans: allClans, minVary, maxVary }
}

/**
 * Run one tick of war status check: check clans that are due (now >= syncAt + vary) and not yet in recordedSet.
 * When a clan is notInWar, record timestamp and add to recordedSet (stop checking that clan further).
 * @param {Date} syncAt - Sync time for this cycle
 * @param {Date} now - Current time
 * @param {Set<string>} recordedSet - Clan tags we've already recorded notInWar for this cycle (mutated)
 * @param {{ clans: Array<{ tag: string, vary: number }>, minVary: number, maxVary: number }} [precomputed] - optional, from getClansToCheckWithVary()
 * @returns {{ shouldAdvance: boolean }} shouldAdvance true when now > windowEnd (scheduler should advance to next day)
 */
export async function runWarStatusCheckTick(syncAt, now, recordedSet, precomputed) {
  let clansWithVary = precomputed
  if (!clansWithVary) {
    try {
      clansWithVary = await getClansToCheckWithVary()
    } catch (err) {
      logger.error('War status check: failed to get clans', err.message)
      return { shouldAdvance: false }
    }
  }

  const { clans, minVary, maxVary } = clansWithVary
  const { windowStart, windowEnd } = getWarCheckWindow(syncAt, minVary, maxVary)

  if (now < windowStart) {
    return { shouldAdvance: false }
  }
  if (now > windowEnd) {
    return { shouldAdvance: true }
  }

  let checked = 0
  let recorded = 0
  for (const { tag, vary } of clans) {
    if (recordedSet.has(tag)) continue
    const clanCheckTime = new Date(syncAt.getTime() + vary * MS_PER_MINUTE)
    if (now < clanCheckTime) continue

    try {
      const war = await getCurrentWar(tag).catch(() => null)
      checked++
      if (war?.state === 'notInWar') {
        await recordNotInWarObserved(tag)
        recordedSet.add(tag)
        recorded++
        logger.debug(`War status: ${tag} notInWar recorded`)
      }
    } catch (err) {
      logger.warn(`War status check [${tag}]:`, err.message)
    }
  }

  if (checked > 0 || recorded > 0) {
    logger.info(`War status check tick: ${checked} checked, ${recorded} notInWar recorded this tick`)
  }

  return { shouldAdvance: false }
}
