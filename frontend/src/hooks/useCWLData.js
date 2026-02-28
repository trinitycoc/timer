import { useState, useEffect } from 'react'
import { fetchCWLStatus, fetchCWLGroup, fetchCWLWarByTag } from '../services/api'
import { getValidWarTags, filterWarsForDay } from '../utils/cwlUtils'

/**
 * Hook for fetching and managing CWL status
 */
export const useCWLStatus = (clanTag) => {
  const [cwlStatus, setCwlStatus] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!clanTag) return

    const fetchStatus = async () => {
      setLoading(true)
      try {
        const status = await fetchCWLStatus(clanTag)
        setCwlStatus(status)
      } catch (err) {
        console.error('Error fetching CWL status:', err)
        setCwlStatus({ error: err.message })
      } finally {
        setLoading(false)
      }
    }

    fetchStatus()
  }, [clanTag])

  return { cwlStatus, loading }
}

/**
 * Hook for fetching and managing CWL group data
 * @param {string} clanTag - Clan tag
 * @param {boolean} shouldFetch - Whether to fetch the data
 * @param {string} leagueName - League name for medal calculations (optional)
 * @param {boolean} includeAllWars - Whether to fetch all war details (default: false, uses /current endpoint)
 * @param {string} sortBy - Sort option for member summary: 'total' or round number (1-7) as string
 */
export const useCWLGroup = (clanTag, shouldFetch, leagueName = null, includeAllWars = false, sortBy = 'total') => {
  const [cwlGroupData, setCwlGroupData] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!shouldFetch || !clanTag) return

    const fetchGroupData = async () => {
      setLoading(true)
      try {
        // Use /current endpoint if includeAllWars is false, /all endpoint if true
        const data = await fetchCWLGroup(clanTag, includeAllWars, leagueName, sortBy)
        setCwlGroupData(data)
      } catch (err) {
        console.error('Error fetching CWL group data:', err)
        setCwlGroupData({ error: err.message })
      } finally {
        setLoading(false)
      }
    }

    fetchGroupData()
  }, [shouldFetch, clanTag, leagueName, includeAllWars, sortBy])

  return { cwlGroupData, loading }
}

/**
 * Hook for fetching wars for a selected day/round
 * @param {number} selectedDay - Selected day/round number
 * @param {object} cwlGroupData - CWL group data from useCWLGroup
 * @param {string} clanTag - Clan tag
 * @param {boolean} includeAllWars - Whether we're using /all endpoint (if true, never fetch individually)
 */
export const useCWLDailyWars = (selectedDay, cwlGroupData, clanTag, includeAllWars = false) => {
  const [fetchedWarsForDay, setFetchedWarsForDay] = useState([])
  const [fetchedWarsByRound, setFetchedWarsByRound] = useState({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!selectedDay || !cwlGroupData?.group?.rounds || !clanTag) {
      setFetchedWarsForDay([])
      return
    }

    const selectedRound = cwlGroupData.group.rounds.find(r => r.round === selectedDay)
    if (!selectedRound || !selectedRound.warTags) {
      setFetchedWarsForDay([])
      return
    }

    const validWarTags = getValidWarTags(selectedRound.warTags)
    if (validWarTags.length === 0) {
      setFetchedWarsForDay([])
      return
    }

    // Check if we have data from /all endpoint FIRST
    // If includeAllWars is true OR we have warsByRound/allWars populated, we should have all the data from /all endpoint
    const hasDataFromAllEndpoint = includeAllWars || 
                                   (cwlGroupData.warsByRound && Object.keys(cwlGroupData.warsByRound).length > 0) || 
                                   (cwlGroupData.allWars && cwlGroupData.allWars.length > 0)
    
    // If we have data from /all endpoint, NEVER fetch individually
    // The data is already available, even if we haven't found it yet for this specific day
    if (hasDataFromAllEndpoint) {
      // Try to find wars for this day, but don't fetch if not found
      let warsForDay = []
      
      // First check warsByRound - this is populated when using /all endpoint
      // Try both string and number keys
      if (cwlGroupData.warsByRound) {
        warsForDay = cwlGroupData.warsByRound[selectedDay] || 
                     cwlGroupData.warsByRound[String(selectedDay)] ||
                     cwlGroupData.warsByRound[Number(selectedDay)] ||
                     []
      }
      
      // If not found, check allWars (flat array)
      if (warsForDay.length === 0 && cwlGroupData.allWars && cwlGroupData.allWars.length > 0) {
        warsForDay = filterWarsForDay(
          cwlGroupData.allWars,
          selectedRound.warTags
        )
      }
      
      // Don't fetch - we already have all the data from /all endpoint
      // If warsForDay is empty, it means the data structure doesn't match, but we still shouldn't fetch
      setFetchedWarsForDay([])
      return
    }
    
    // Only if we DON'T have data from /all endpoint, try to find wars and fetch if needed
    let warsForDay = []
    
    // First check warsByRound
    if (cwlGroupData.warsByRound) {
      warsForDay = cwlGroupData.warsByRound[selectedDay] || 
                   cwlGroupData.warsByRound[String(selectedDay)] ||
                   cwlGroupData.warsByRound[Number(selectedDay)] ||
                   []
    }
    
    // If not found, check allWars (flat array)
    if (warsForDay.length === 0 && cwlGroupData.allWars && cwlGroupData.allWars.length > 0) {
      warsForDay = filterWarsForDay(
        cwlGroupData.allWars,
        selectedRound.warTags
      )
    }
    
    // Fallback to currentWars
    if (warsForDay.length === 0 && cwlGroupData.currentWars && cwlGroupData.currentWars.length > 0) {
      warsForDay = filterWarsForDay(
        cwlGroupData.currentWars,
        selectedRound.warTags
      )
    }
    
    // Only fetch individually if we truly don't have the data
    if (warsForDay.length === 0 && validWarTags.length > 0) {
      const fetchAllWars = async () => {
        setLoading(true)
        setFetchedWarsForDay([])
        try {
          const warPromises = validWarTags.map(tag =>
            fetchCWLWarByTag(tag, clanTag).catch(err => {
              console.error(`Error fetching war ${tag}:`, err)
              return null
            })
          )
          const wars = await Promise.all(warPromises)
          const validWars = wars.filter(war => war !== null)
          setFetchedWarsForDay(validWars)
          setFetchedWarsByRound(prev => ({
            ...prev,
            [selectedDay]: validWars
          }))
        } catch (err) {
          console.error('Error fetching wars:', err)
          setFetchedWarsForDay([])
        } finally {
          setLoading(false)
        }
      }
      fetchAllWars()
    } else {
      setFetchedWarsForDay([])
    }
  }, [selectedDay, cwlGroupData, clanTag])

  return { fetchedWarsForDay, fetchedWarsByRound, loading }
}

