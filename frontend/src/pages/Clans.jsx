import React, { useState, useEffect } from 'react'
import SectionTitle from '../components/SectionTitle'
import ClanCard from '../components/ClanCard'
import LazyRender from '../components/LazyRender'
import { fetchGFLFamilyClans, fetchFollowingFamilyClans } from '../services/api'

function Clans() {
  const [clanTab, setClanTab] = useState('gfl') // 'gfl' | 'following'
  const [clansData, setClansData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchClansData = async () => {
      try {
        setLoading(true)
        setError(null)
        const fetcher = clanTab === 'following' ? fetchFollowingFamilyClans : fetchGFLFamilyClans
        const fetchedClans = await fetcher()
        if (!Array.isArray(fetchedClans) || fetchedClans.length === 0) {
          setError(clanTab === 'following' ? 'No following clans available.' : 'No clan data available. Please check your configuration.')
          setClansData([])
        } else {
          setClansData(fetchedClans)
        }
      } catch (err) {
        console.error('Error loading clans:', err)
        setError(err.message || 'Failed to load clans. Please check your connection and try again.')
        setClansData([])
      } finally {
        setLoading(false)
      }
    }

    fetchClansData()
  }, [clanTab])

  return (
    <section className="clans-page">
      <SectionTitle>{clanTab === 'following' ? 'Following Clans' : 'GFL Clans'}</SectionTitle>

      <div className="clans-page-tabs">
        <button
          type="button"
          className={`clans-page-tab ${clanTab === 'gfl' ? 'active' : ''}`}
          onClick={() => setClanTab('gfl')}
        >
          GFL Clans
        </button>
        <button
          type="button"
          className={`clans-page-tab ${clanTab === 'following' ? 'active' : ''}`}
          onClick={() => setClanTab('following')}
        >
          Following Clans
        </button>
      </div>

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
