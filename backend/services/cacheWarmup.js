import { getActiveTrinityClanTags, getActiveCWLClanTags } from './clanManagementService.js'
import { getAllCWLClansMerged, getCWLClansFiltered } from './cwlService.js'
import { getMultipleClans, getCWLGroup, getAllCWLWars } from './clashOfClansService.js'

const DEFAULT_INITIAL_DELAY = 5 * 1000 // 5 seconds
const DEFAULT_INTERVAL = 2 * 60 * 1000 // 2 minutes
const DEFAULT_QUEUE_DELAY = 500 // 0.5 second between tasks

let warmupQueue = Promise.resolve()

const enqueueWarmup = (label, task) => {
  warmupQueue = warmupQueue
    .then(async () => {
      const startedAt = Date.now()
      console.log(`🔥 Cache warmup started: ${label}`)
      try {
        await task()
        const duration = Date.now() - startedAt
        console.log(`✅ Cache warmup finished: ${label} (${duration}ms)`)
      } catch (error) {
        console.error(`❌ Cache warmup failed: ${label}`, error)
      }
      await new Promise(resolve => setTimeout(resolve, Number(process.env.CACHE_WARM_QUEUE_DELAY || DEFAULT_QUEUE_DELAY)))
    })
    .catch(err => {
      console.error(`❌ Cache warmup queue error: ${label}`, err)
    })
}


const warmClanSummaries = async () => {
  const clanTags = await getActiveTrinityClanTags()
  if (Array.isArray(clanTags) && clanTags.length > 0) {
    await getMultipleClans(clanTags)
  }
}

const warmCwlSummaries = async () => {
  await getAllCWLClansMerged()
  await getCWLClansFiltered()
}

const warmCwlGroupData = async () => {
  const cwlClanTags = await getActiveCWLClanTags()
  if (Array.isArray(cwlClanTags) && cwlClanTags.length > 0) {
    // Fetch CWL group data for each active CWL clan in batches
    // This will fetch from API and store in database (cwlGroups collection)
    const BATCH_SIZE = 5 // Process 5 clans at a time to avoid overwhelming the API
    for (let i = 0; i < cwlClanTags.length; i += BATCH_SIZE) {
      const batch = cwlClanTags.slice(i, i + BATCH_SIZE)
      const fetchPromises = batch.map(async (tag) => {
        try {
          // Fetch CWL group data (stores in cwlGroups collection)
          await getCWLGroup(tag)
          
          // Also fetch all CWL wars (stores in cwlWars collection)
          // This ensures war data (attacks, stars, destruction) is kept fresh
          await getAllCWLWars(tag)
        } catch (error) {
          console.error(`Failed to fetch CWL data for ${tag}:`, error.message)
        }
      })
      await Promise.all(fetchPromises)
      // Small delay between batches to be nice to the API
      if (i + BATCH_SIZE < cwlClanTags.length) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }
  }
}

const scheduleWarmupRun = () => {
  enqueueWarmup('Trinity clans from CoC API', warmClanSummaries)
  enqueueWarmup('CWL summary merge', warmCwlSummaries)
  enqueueWarmup('CWL group data', warmCwlGroupData)
}

export const startCacheWarmup = () => {
  const initialDelay = Number(process.env.CACHE_WARM_INITIAL_DELAY || DEFAULT_INITIAL_DELAY)
  const warmInterval = Number(process.env.CACHE_WARM_INTERVAL || DEFAULT_INTERVAL)

  setTimeout(() => {
    scheduleWarmupRun()
    setInterval(scheduleWarmupRun, warmInterval)
  }, initialDelay)
}
