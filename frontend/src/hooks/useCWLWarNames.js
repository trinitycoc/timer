import { useState, useEffect } from 'react'
import { fetchCWLWarByTag } from '../services/api'
import { getValidWarTags, filterWarsForDay } from '../utils/cwlUtils'

/**
 * Hook for fetching and caching war names for each round
 * @param {object} cwlGroupData - CWL group data from useCWLGroup
 * @param {string} clanTag - Clan tag
 * @param {boolean} loadingGroup - Whether group data is loading
 * @param {boolean} includeAllWars - Whether we're using /all endpoint (if true, never fetch individually)
 */
export const useCWLWarNames = (cwlGroupData, clanTag, loadingGroup, includeAllWars = false) => {
  const [dayWarNames, setDayWarNames] = useState({})

  useEffect(() => {
    if (!cwlGroupData?.group?.rounds || !clanTag || loadingGroup) return

    const fetchDayWarNames = async () => {
      const names = {}
      const promises = []

      // Check if we have data from /all endpoint - if so, we should have all war data
      // If includeAllWars is true, we're using /all endpoint, so never fetch individually
      const hasDataFromAllEndpoint = includeAllWars ||
                                     (cwlGroupData.warsByRound && Object.keys(cwlGroupData.warsByRound).length > 0) || 
                                     (cwlGroupData.allWars && cwlGroupData.allWars.length > 0)

      // Process all rounds
      for (const round of cwlGroupData.group.rounds) {
        if (!round.warTags || round.warTags.length === 0) continue

        const validWarTags = getValidWarTags(round.warTags)
        if (validWarTags.length === 0) continue

        // Check if we already have war data for this round
        // Priority: 1. warsByRound (from /all endpoint), 2. allWars, 3. currentWars
        let existingWars = []
        
        // First check warsByRound - this is populated when using /all endpoint
        if (cwlGroupData.warsByRound && cwlGroupData.warsByRound[round.round]) {
          existingWars = cwlGroupData.warsByRound[round.round]
        }
        
        // If not found, check allWars (flat array)
        if (existingWars.length === 0 && cwlGroupData.allWars && cwlGroupData.allWars.length > 0) {
          existingWars = filterWarsForDay(
            cwlGroupData.allWars,
            round.warTags
          )
        }

        // Also check currentWars
        if (existingWars.length === 0 && cwlGroupData.currentWars && cwlGroupData.currentWars.length > 0) {
          existingWars = filterWarsForDay(
            cwlGroupData.currentWars,
            round.warTags
          )
        }

        // If we have war data with clan names, use it
        if (existingWars.length > 0 && existingWars[0].clan && existingWars[0].opponent) {
          names[round.round] = `${existingWars[0].clan.name} vs ${existingWars[0].opponent.name}`
          if (existingWars.length > 1) {
            names[round.round] += ` (${existingWars.length} wars)`
          }
        } else if (validWarTags.length > 0 && !hasDataFromAllEndpoint) {
          // Only fetch if we don't have data from /all endpoint
          // Fetch the first war to get clan names
          const firstWarTag = validWarTags[0]
          promises.push(
            fetchCWLWarByTag(firstWarTag, clanTag)
              .then(war => {
                if (war && war.clan && war.opponent) {
                  const warCount = validWarTags.length
                  names[round.round] = `${war.clan.name} vs ${war.opponent.name}`
                  if (warCount > 1) {
                    names[round.round] += ` (${warCount} wars)`
                  }
                }
              })
              .catch(() => {
                // Silently fail - war data may not be available yet
              })
          )
        }
      }

      // Wait for all war fetches to complete
      if (promises.length > 0) {
        await Promise.allSettled(promises)
      }
      setDayWarNames(names)
    }

    fetchDayWarNames()
  }, [cwlGroupData, clanTag, loadingGroup])

  return dayWarNames
}

