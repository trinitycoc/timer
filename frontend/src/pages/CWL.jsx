import React, { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import SectionTitle from '../components/SectionTitle'
import CWLClanCard from '../components/CWLClanCard'
import LazyRender from '../components/LazyRender'
import { checkServerHealth, fetchFilteredCWLClans } from '../services/api'
import { useAuth } from '../contexts/AuthContext'

function CWL() {
  const { isAdmin, isRoot } = useAuth()
  const [clansData, setClansData] = useState([])
  const [filteredClanTags, setFilteredClanTags] = useState(new Set()) // Track which clans are visible to regular users
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [serverOnline, setServerOnline] = useState(false)
  
  // Admin and root users automatically see all clans
  const showAll = isAdmin || isRoot

  // Store display period info from backend
  const [displayPeriodInfo, setDisplayPeriodInfo] = useState({ isDisplayPeriod: false, monthName: '' })
  
  const shouldHoldRegularView = useMemo(() => {
    if (showAll) {
      return false
    }
    // Only show notice if it's display period AND there are no clans to show
    return displayPeriodInfo.isDisplayPeriod && clansData.length === 0
  }, [showAll, displayPeriodInfo, clansData.length])

  useEffect(() => {
    const fetchClansData = async () => {
      try {
        setLoading(true)
        setError(null)

        // Check if backend server is running
        const isOnline = await checkServerHealth()
        setServerOnline(isOnline)

        if (!isOnline) {
          setLoading(false)
          setError('Backend server is not running. Please start it with: cd Trinity_Backend && npm install && npm run dev')
          return
        }

        // Fetch CWL clans from backend with capacity-based filtering
        if (showAll) {
          // In admin mode: fetch all clans with filtered info in a single call
          const response = await fetchFilteredCWLClans(true, true) // showAll=true, includeFilteredInfo=true
          
          if (!response.clans || response.clans.length === 0) {
            setLoading(false)
            setError('No CWL clan data available. Please check your configuration.')
            return
          }
          
          // Set display period info from backend
          if (response.isDisplayPeriod !== undefined && response.monthName) {
            setDisplayPeriodInfo({ isDisplayPeriod: response.isDisplayPeriod, monthName: response.monthName })
          }
          
          // Create a set of clan tags that are visible to regular users
          const visibleTags = new Set(response.filteredClanTags || [])
          setFilteredClanTags(visibleTags)
          setClansData(response.clans)
        } else {
          // Regular user mode: fetch only filtered clans
          const response = await fetchFilteredCWLClans(false)
          
          if (!response.clans || response.clans.length === 0) {
            setLoading(false)
            setError('No CWL clan data available. Please check your configuration.')
            return
          }
          
          // Set display period info from backend
          if (response.isDisplayPeriod !== undefined && response.monthName) {
            setDisplayPeriodInfo({ isDisplayPeriod: response.isDisplayPeriod, monthName: response.monthName })
          }
          
          // Always show clans if available, regardless of display period
          // Notice will only show if display period is active AND no clans are available
          setClansData(response.clans || [])
          setFilteredClanTags(new Set())
        }
        
        setLoading(false)
      } catch (err) {
        // Catch all errors (API_BASE_URL undefined, network errors, etc.)
        console.error('Error loading CWL clans:', err)
        setLoading(false)
        setError(err.message || 'Failed to load CWL clans. Please check your connection and try again.')
        setClansData([])
      }
    }

    fetchClansData()
  }, [showAll])

  return (
    <section className="cwl-page">
      <div className="cwl-title-wrapper">
        <SectionTitle>Trinity Clan War League (CWL)</SectionTitle>
      </div>

      <div className="clans-grid">
        {loading ? (
          // Show loading state
          <div className="clan-card clan-card-loading">
            <div className="clan-loading">
              <div className="spinner"></div>
              <p>Loading CWL clan data...</p>
            </div>
          </div>
        ) : error ? (
          // Show error message
          <div className="clan-card clan-card-error">
            <div className="clan-error">
              <p className="error-title">⚠️ Error Loading CWL Clans</p>
              <p className="error-message">{error}</p>
            </div>
          </div>
        ) : shouldHoldRegularView ? (
          <div className="cwl-notice">
            <div className="cwl-notice-inner">
              <p className="cwl-notice-headline">
                We host Lazy CWL in satellite clans, ranging from Master 1 to Crystal 2 depending upon your Town Hall.
              </p>
              <p className="cwl-notice-body">
                Check the CWL page after 29th {displayPeriodInfo.monthName} (1:30&nbsp;PM IST). Until then, you can explore our{' '}
                <Link to="/clans">Trinity clans</Link>.
              </p>
            </div>
          </div>
        ) : clansData.length > 0 ? (
          // Show CWL clan cards with fetched data
          clansData.map((clan) => (
            <LazyRender
              key={clan.tag}
              placeholder={<CWLClanCard isLoading={true} />}
            >
              <CWLClanCard
                clan={clan}
                isLoading={false}
                error={false}
                sheetData={clan.sheetData}
                isVisibleToUsers={showAll ? filteredClanTags.has(clan.tag) : true}
                isAdminMode={showAll}
              />
            </LazyRender>
          ))
        ) : (
          <div className="no-data-message">
            <p>No CWL clan data available. Please check your configuration.</p>
          </div>
        )}
      </div>
    </section>
  )
}

export default CWL

