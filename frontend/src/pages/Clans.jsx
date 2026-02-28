import React, { useState, useEffect } from 'react'
import SectionTitle from '../components/SectionTitle'
import ClanCard from '../components/ClanCard'
import LazyRender from '../components/LazyRender'
import { fetchMultipleClans, checkServerHealth, fetchTrinityClansFromSheet } from '../services/api'

function Clans() {
  const [clansData, setClansData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [serverOnline, setServerOnline] = useState(false)

  useEffect(() => {
    const fetchClansData = async () => {
      try {
        setLoading(true)
        setError(null)

        // First, fetch clan tags from database
        const tagsFromSheet = await fetchTrinityClansFromSheet()

        if (tagsFromSheet.length === 0) {
          setLoading(false)
          setError('No clan tags found. Please check your configuration.')
          return
        }

        // Check if backend server is running
        const isOnline = await checkServerHealth()
        setServerOnline(isOnline)

        if (!isOnline) {
          setLoading(false)
          setError('Backend server is not running. Please start it with: cd Trinity_Backend && npm install && npm run dev')
          return
        }

        // Fetch all clan data using the backend API
        const fetchedClans = await fetchMultipleClans(tagsFromSheet)
        
        if (!Array.isArray(fetchedClans) || fetchedClans.length === 0) {
          setLoading(false)
          setError(`No clan data available. Attempted to fetch ${tagsFromSheet.length} clans but received ${Array.isArray(fetchedClans) ? 'empty' : 'invalid'} response. Check backend logs for API errors.`)
          return
        }

        setClansData(fetchedClans)
        setLoading(false)
      } catch (err) {
        // Catch all errors (API_BASE_URL undefined, network errors, etc.)
        console.error('Error loading clans:', err)
        setLoading(false)
        setError(err.message || 'Failed to load clans. Please check your connection and try again.')
        setClansData([])
      }
    }

    fetchClansData()
  }, [])

  return (
    <section className="clans-page">
      <SectionTitle>Trinity Family Clans</SectionTitle>
      <p className="page-description">
        Explore our family of clans. Each clan has its own unique culture and requirements, 
        but all share the Trinity spirit of excellence and camaraderie.
      </p>

      <div className="clans-grid">
        {loading ? (
          // Show single loading skeleton
          <ClanCard isLoading={true} />
        ) : error ? (
          // Show error message
          <div className="clan-card clan-card-error">
            <div className="clan-error">
              <p className="error-title">⚠️ Error Loading Clans</p>
              <p className="error-message">{error}</p>
            </div>
          </div>
        ) : clansData.length > 0 ? (
          // Show clan cards with fetched data
          clansData.map((clan) => (
            <LazyRender
              key={clan.tag}
              placeholder={<ClanCard isLoading={true} />}
            >
              <ClanCard
                clan={clan}
                isLoading={false}
                error={false}
              />
            </LazyRender>
          ))
        ) : (
          <div className="no-data-message">
            <p>No clan data available. Please check your configuration.</p>
          </div>
        )}
      </div>
    </section>
  )
}

export default Clans
