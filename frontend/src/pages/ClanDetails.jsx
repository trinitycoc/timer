import React, { useState, useEffect, useRef, Suspense, lazy } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchClan, fetchClanWarLog, fetchClanWar /* fetchClanCapitalRaids */ } from '../services/api'
import { useCWL } from '../contexts/CWLContext'
import { useAuth } from '../contexts/AuthContext'
import ClanHeader from '../components/clan-details/ClanHeader'
const ClanDescription = lazy(() => import('../components/clan-details/ClanDescription'))
const TownHallComposition = lazy(() => import('../components/clan-details/TownHallComposition'))
const MembersList = lazy(() => import('../components/clan-details/MembersList'))
const CurrentWar = lazy(() => import('../components/clan-details/wars/CurrentWar'))
const WarLog = lazy(() => import('../components/clan-details/wars/WarLog'))
// import CapitalRaids from '../components/clan-details/CapitalRaids'
const CWLDetails = lazy(() => import('../components/clan-details/cwl/CWLDetails'))

function ClanDetails() {
  const { clanTag } = useParams()
  const navigate = useNavigate()
  const { isCWLClan: checkIsCWLClan } = useCWL()
  const { isAdmin: userIsAdmin, isRoot } = useAuth()
  
  // Admin and root users automatically see all clans
  const isAdmin = userIsAdmin || isRoot
  const [clan, setClan] = useState(null)
  const [warLog, setWarLog] = useState([])
  const [currentWar, setCurrentWar] = useState(null)
  // const [capitalRaids, setCapitalRaids] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showWarLog, setShowWarLog] = useState(false)
  const [showCurrentWar, setShowCurrentWar] = useState(false)
  // const [showCapitalRaids, setShowCapitalRaids] = useState(false)
  const [showCWLDetails, setShowCWLDetails] = useState(false)
  
  // Check if this is a CWL clan - show button if clan has warLeague or is in CWL list
  const isCWLClan = clan && (clan.warLeague?.name || checkIsCWLClan(clan.tag))

  useEffect(() => {
    const loadClanDetails = async () => {
      try {
        setLoading(true)
        setError(null)

        // Fetch clan data, war log, current war, and capital raids
        // TODO: Capital Raids not integrated yet - commenting out to prevent unnecessary API calls
        const [clanData, warLogData, currentWarData /* , capitalRaidsData */] = await Promise.all([
          fetchClan(clanTag),
          fetchClanWarLog(clanTag).catch(() => []),
          fetchClanWar(clanTag).catch((err) => {
            console.error('Error fetching current war:', err)
            return null
          }),
          // fetchClanCapitalRaids(clanTag).catch(() => [])
        ])

        setClan(clanData)
        setWarLog(Array.isArray(warLogData) ? warLogData : [])
        setCurrentWar(currentWarData)
        // Handle capital raids - API might return {items: [...]} or direct array
        // TODO: Capital Raids not integrated yet
        // const raidsArray = Array.isArray(capitalRaidsData) 
        //   ? capitalRaidsData 
        //   : (capitalRaidsData?.items || [])
        // setCapitalRaids(raidsArray)
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
          showCapitalRaids={false /* showCapitalRaids */}
          showCWLDetails={showCWLDetails}
          setShowCurrentWar={setShowCurrentWar}
          setShowWarLog={setShowWarLog}
          setShowCapitalRaids={() => {} /* setShowCapitalRaids */}
          setShowCWLDetails={setShowCWLDetails}
          isCWLClan={isCWLClan}
        />
      </div>

      <div className="clan-details-content">
        {/* Show clan info sections only when war sections are not shown */}
        {/* TODO: Capital Raids not integrated yet - removed showCapitalRaids check */}
        {!showCurrentWar && !showWarLog && !showCWLDetails && (
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

        {/* CWL Details - Only show for CWL clans */}
        {isCWLClan && showCWLDetails && (
          <Suspense fallback={<div className="section-loading">Loading CWL details...</div>}>
            <CWLDetails 
              clanTag={clan.tag} 
              showDetails={showCWLDetails}
              leagueName={clan.warLeague?.name}
              isAdmin={isAdmin}
            />
          </Suspense>
        )}

        {/* War Log */}
        {showWarLog && (
          <Suspense fallback={<div className="section-loading">Loading war log...</div>}>
            <WarLog warLog={warLog} isWarLogPublic={clan.isWarLogPublic} />
          </Suspense>
        )}

        {/* Capital Raids */}
        {/* TODO: Capital Raids not integrated yet - commenting out to prevent unnecessary API calls */}
        {/* {showCapitalRaids && <CapitalRaids capitalRaids={capitalRaids} />} */}
      </div>
    </section>
  )
}

export default ClanDetails
