import { useEffect, useState } from 'react'
import { fetchGFLFamilyClans } from '../services/api'

function useGFLClansPreview(limit = 3) {
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
        const clansData = await fetchGFLFamilyClans()
        if (!isMounted) return
        const list = Array.isArray(clansData) ? clansData : []
        setClanCount(list.length)
        setClans(limit > 0 ? list.slice(0, limit) : [])
      } catch (err) {
        if (!isMounted) return
        console.error('Error loading clans preview:', err)
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

export default useGFLClansPreview
