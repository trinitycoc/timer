import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useCountdown } from '../hooks/useCountdown'
import cwlImage from '/cwl.webp'

function CWLClanCard({ clan, isLoading, error, sheetData = null, isVisibleToUsers = true, isAdminMode = false }) {
  const navigate = useNavigate()

  const clanEligibleMembers = clan?.eligibleMembers
  const memberList = clan?.memberList
  const isDisplayPeriod = clan?.cwlStatus?.isDisplayPeriod

  // Use pre-calculated eligibleMembers from backend (backend always provides this)
  const thCount = clanEligibleMembers !== undefined ? `${clanEligibleMembers}` : null

  // Use pre-calculated spaceInfo from backend (backend always provides this)
  const spaceInfo = clan?.spaceInfo || null

  // Check if CWL is in preparation or inWar state
  // Only show "CWL already started" when state is "preparation" or "inWar"
  const cwlState = clan?.cwlStatus?.state || 'unknown'
  const showCWLStarted = cwlState === 'preparation' || cwlState === 'inWar'

  // Get active war for countdown display
  const activeWar = clan?.cwlStatus?.activeWar || null
  const isPreparation = activeWar?.state === 'preparation'
  const isInWar = activeWar?.state === 'inWar'

  // Determine target time based on war state
  const targetTime = isPreparation ? activeWar?.startTime : (isInWar ? activeWar?.endTime : null)
  const countdown = useCountdown(targetTime)

  // Format countdown message - Always use "Battle ends in" for consistency
  const getCountdownMessage = () => {
    if (!activeWar || !targetTime || !countdown || countdown === 'Ended') return null

    if (isPreparation) {
      return `Battle starts in ${countdown}`
    } else if (isInWar) {
      return `Battle ends in ${countdown}`
    }
    return null
  }

  const countdownMessage = getCountdownMessage()

  const handleClick = () => {
    if (clan && clan.tag) {
      // Navigate to clan details page with the clan tag (remove # for URL)
      navigate(`/clans/${clan.tag.replace('#', '')}`)
    }
  }

  if (isLoading) {
    return (
      <div className="clan-card clan-card-loading">
        <div className="clan-loading">
          <div className="spinner"></div>
          <p>Loading CWL clan data...</p>
        </div>
      </div>
    )
  }

  if (error || !clan) {
    return (
      <div className="clan-card clan-card-error">
        <div className="clan-icon">❌</div>
        <h4>{clan?.tag || 'Unknown'}</h4>
        <p className="error-message">Failed to load clan data</p>
        <p className="error-hint">Check clan tag or API connection</p>
      </div>
    )
  }

  return (
    <div className={`clan-card clan-card-detailed cwl-clan-card clan-status-${clan.type || 'unknown'} ${isAdminMode && !isVisibleToUsers ? 'cwl-clan-hidden' : ''} ${isAdminMode && isVisibleToUsers ? 'cwl-clan-visible' : ''}`} onClick={handleClick}>
      {/* Space Available Banner with String and Nail */}
      {spaceInfo && (
        <div className="cwl-banner-container">
          {/* Nail at the top */}
          <div className="cwl-nail"></div>
          {/* String hanging from nail */}
          <div className="cwl-string"></div>
          {/* Banner attached to string */}
          <div className={`cwl-space-banner ${showCWLStarted ? 'cwl-space-banner-started' : spaceInfo.isFull ? 'cwl-space-banner-full' : ''}`}>
            {/* Show CWL started message only when state is "preparation" or "inWar" */}
            {showCWLStarted ? (
              <span className="cwl-banner-message">
                {/* CWL already started in this clan */}
                {countdownMessage && (
                  <span className="cwl-banner-countdown"> • {countdownMessage}</span>
                )}
              </span>
            ) : spaceInfo.isFull ? (
              <span className="cwl-banner-message">Join Next Clans</span>
            ) : (
              <span className="cwl-banner-message">
                <span className="cwl-banner-space">Space: {spaceInfo.available}</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Header Row with Badge and Name */}
      <div className="clan-header-row">
        <img
          src={clan.badgeUrls?.medium || clan.badgeUrls?.small || clan.badgeUrls?.large}
          alt={`${clan.name} badge`}
          className="clan-badge"
        />

        <div className="clan-name-section">
          <div className="clan-name-status-row">
            <h4 className="clan-name">{clan.name}</h4>
            {/* Clan Status - inline with name */}
            {clan.type && (
              <div className="clan-status-inline">
                {clan.type === 'open' && (
                  <>
                    <span className="status-icon">🟢</span>
                    <span className="status-label">Open</span>
                  </>
                )}
                {clan.type === 'inviteOnly' && (
                  <>
                    <span className="status-icon">🔵</span>
                    <span className="status-label">Invite Only</span>
                  </>
                )}
                {clan.type === 'closed' && (
                  <>
                    <span className="status-icon">🔴</span>
                    <span className="status-label">Closed</span>
                  </>
                )}
              </div>
            )}
          </div>
          <p className="clan-tag">{clan.tag}</p>
          {/* Admin Mode Indicator - Under clan tag */}
          {isAdminMode && (
            <div className={`cwl-admin-indicator ${isVisibleToUsers ? 'cwl-visible-badge' : 'cwl-hidden-badge'}`}>
              {isVisibleToUsers ? 'Currently Visible' : 'Hidden from Users'}
            </div>
          )}
        </div>
      </div>

      {/* Show database data for CWL clans (all users: regular, admin, root) */}
      {sheetData && !isDisplayPeriod && (
        <div className="clan-sheet-info">
          {sheetData.format && (
            <div className="sheet-info-item">
              <span className="info-label">Format:</span>
              <span className="info-value">{sheetData.format}</span>
            </div>
          )}
          {/* Hide Allowed Members and Eligible Members when CWL is active */}
          {!showCWLStarted && sheetData.hasOwnProperty('members') && (
            <div className="sheet-info-item">
              <span className="info-label">Allowed Members:</span>
              <span className="info-value">{sheetData.members || '0'}</span>
            </div>
          )}
          {sheetData.hasOwnProperty('townHall') && (
            <div className="sheet-info-item">
              <span className="info-label">TH Allowed:</span>
              <span className="info-value">{sheetData.townHall || 'N/A'}</span>
            </div>
          )}
          {/* Hide Eligible Members when CWL is active */}
          {!showCWLStarted && thCount !== null && thCount !== undefined && (
            <div className="sheet-info-item">
              <span className="info-label">Eligible Members:</span>
              <span className="info-value">{thCount}</span>
            </div>
          )}
        </div>
      )}


      {/* Members Count and CWL League Badge */}
      <div className="clan-info-row">
        {clan.members !== undefined && (
          <div className="clan-members-count">
            <span className="members-label">👥 {clan.members}/50</span>
          </div>
        )}
        {clan.warLeague && (
          <div className="clan-league-mini">
            <img
              src={cwlImage}
              alt="CWL badge"
              className="league-icon-img"
            />
            <span className="league-name">{clan.warLeague.name}</span>
          </div>
        )}
      </div>

      {/* Visit In-Game Button */}
      <a
        href={`https://link.clashofclans.com/en/?action=OpenClanProfile&tag=${clan.tag.replace('#', '%23')}`}
        target="_blank"
        rel="noopener noreferrer"
        className="visit-ingame-btn"
        onClick={(e) => e.stopPropagation()}
      >
        Visit In-Game
      </a>
    </div>
  )
}

export default CWLClanCard

