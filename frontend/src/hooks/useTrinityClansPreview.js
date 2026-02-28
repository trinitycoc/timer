import { useEffect, useState } from 'react'
import { fetchMultipleClans, fetchTrinityClansFromSheet } from '../services/api'

function useTrinityClansPreview(limit = 3) {
  const [clanCount, setClanCount] = useState(0)
  const [clans, setClans] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let isMounted = true

    const loadClans = async () => {
      setLoading(true)
      setError(null)

      try {
        const clanTags = await fetchTrinityClansFromSheet()
        if (!isMounted) return

        const tags = Array.isArray(clanTags) ? clanTags : []
        setClanCount(tags.length)

        if (limit > 0 && tags.length > 0) {
          try {
            const clansData = await fetchMultipleClans(tags.slice(0, limit))
            if (!isMounted) return
            setClans(clansData.slice(0, limit))
          } catch (err) {
            if (!isMounted) return
            console.error('Error fetching home clans:', err)
            setError('Unable to load clan list right now.')
          }
        } else {
          setClans([])
        }
      } catch (err) {
        if (!isMounted) return
        console.error('Error loading clan count:', err)
        setError('Unable to load clan list right now.')
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadClans()

    return () => {
      isMounted = false
    }
  }, [limit])

  return { clanCount, clans, loading, error }
}

export default useTrinityClansPreview

