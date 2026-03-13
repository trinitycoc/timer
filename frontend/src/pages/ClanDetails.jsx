import React, { useState, useEffect, Suspense, lazy } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchClanFullDetails } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import ClanHeader from '../components/clan-details/ClanHeader'
const ClanDescription = lazy(() => import('../components/clan-details/ClanDescription'))
const TownHallComposition = lazy(() => import('../components/clan-details/TownHallComposition'))
const MembersList = lazy(() => import('../components/clan-details/MembersList'))
const CurrentWar = lazy(() => import('../components/clan-details/wars/CurrentWar'))
const WarLog = lazy(() => import('../components/clan-details/wars/WarLog'))

function ClanDetails() {
  const { clanTag } = useParams()
  const navigate = useNavigate()
  const { isAdmin: userIsAdmin, isRoot } = useAuth()
  
  // Admin and root users automatically see all clans
  const isAdmin = userIsAdmin || isRoot
  const [clan, setClan] = useState(null)
  const [warLog, setWarLog] = useState([])
  const [currentWar, setCurrentWar] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showWarLog, setShowWarLog] = useState(false)
  const [showCurrentWar, setShowCurrentWar] = useState(false)

  useEffect(() => {
    const loadClanDetails = async () => {
      try {
        setLoading(true)
        setError(null)

        const { clan: clanData, currentWar: currentWarData, warLog: warLogData } = await fetchClanFullDetails(clanTag)

        setClan(clanData)
        setWarLog(Array.isArray(warLogData) ? warLogData : [])
        setCurrentWar(currentWarData)
      } catch (err) {
        console.error('Error loading clan details:', err)
        setError(err.message || 'Failed to load clan details')
      } finally {
        setLoading(false)
      }
    }

    if (clanTag) {
      loadClanDetails()
    }
  }, [clanTag])

  if (loading) {
    return (
      <section className="clan-details-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading clan details...</p>
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section className="clan-details-page">
        <div className="error-container">
          <h2>❌ Error Loading Clan</h2>
          <p>{error}</p>
          <button className="btn btn-primary" onClick={() => navigate(-1)}>
            ← Back
          </button>
        </div>
      </section>
    )
  }

  if (!clan) {
    return (
      <section className="clan-details-page">
        <div className="error-container">
          <h2>⚠️ No Clan Data</h2>
          <p>Clan data could not be loaded</p>
          <button className="btn btn-primary" onClick={() => navigate(-1)}>
            ← Back
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="clan-details-page">
      <button className="back-button" onClick={() => navigate(-1)}>
        ← Back
      </button>

      <div className="clan-details-header">
        <img
          src={clan.badgeUrls?.large || clan.badgeUrls?.medium || clan.badgeUrls?.small}
          alt={`${clan.name} badge`}
          className="clan-badge-large"
        />
        <ClanHeader
          clan={clan}
          currentWar={currentWar}
          warLog={warLog}
          showCurrentWar={showCurrentWar}
          showWarLog={showWarLog}
          setShowCurrentWar={setShowCurrentWar}
          setShowWarLog={setShowWarLog}
        />
      </div>

      <div className="clan-details-content">
        {!showCurrentWar && !showWarLog && (
          <Suspense fallback={<div className="section-loading">Loading clan overview...</div>}>
            <ClanDescription description={clan.description} />
            <TownHallComposition 
              memberList={clan.memberList} 
              totalMembers={clan.members} 
              thComposition={clan.thComposition} 
            />
            <MembersList memberList={clan.memberList} totalMembers={clan.members} />
          </Suspense>
        )}

        {/* Current War */}
        {showCurrentWar && (
          <Suspense fallback={<div className="section-loading">Loading current war...</div>}>
            <CurrentWar currentWar={currentWar} />
          </Suspense>
        )}

        {/* War Log */}
        {showWarLog && (
          <Suspense fallback={<div className="section-loading">Loading war log...</div>}>
            <WarLog warLog={warLog} isWarLogPublic={clan.isWarLogPublic} />
          </Suspense>
        )}
      </div>
    </section>
  )
}

export default ClanDetails
