import { getActiveGFLClanTags } from './clanManagementService.js'
import { getMultipleClans } from './clashOfClansService.js'

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
  const clanTags = await getActiveGFLClanTags()
  if (Array.isArray(clanTags) && clanTags.length > 0) {
    await getMultipleClans(clanTags)
  }
}

const scheduleWarmupRun = () => {
  enqueueWarmup('GFL clans from CoC API', warmClanSummaries)
}

export const startCacheWarmup = () => {
  const initialDelay = Number(process.env.CACHE_WARM_INITIAL_DELAY || DEFAULT_INITIAL_DELAY)
  const warmInterval = Number(process.env.CACHE_WARM_INTERVAL || DEFAULT_INTERVAL)

  setTimeout(() => {
    scheduleWarmupRun()
    setInterval(scheduleWarmupRun, warmInterval)
  }, initialDelay)
}
