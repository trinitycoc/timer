import React from 'react'
import { useNavigate } from 'react-router-dom'
import cwlImage from '/cwl.webp'
import capitalImage from '/Capital.webp'

function ClanCard({ clan, isLoading, error }) {
  const navigate = useNavigate()

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
          <p>Loading clan data...</p>
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
    <div className="clan-card clan-card-detailed" onClick={handleClick}>
      <img
        src={clan.badgeUrls?.medium || clan.badgeUrls?.small || clan.badgeUrls?.large}
        alt={`${clan.name} badge`}
        className="clan-badge"
      />

      <h4 className="clan-name">{clan.name}</h4>
      <p className="clan-tag">{clan.tag}</p>

      <div className="clan-info-row">
        {clan.members !== undefined && (
          <div className="clan-members-count">
            <span className="members-label">👥 {clan.members}/50</span>
          </div>
        )}
        {/* {clan.warLeague && (
          <div className="clan-league-mini">
            <img 
              src={cwlImage}
              alt="CWL badge" 
              className="league-icon-img"
            />
            <span className="league-name">{clan.warLeague.name}</span>
          </div>
        )} */}

        {/* <div className="clan-capital">
          <img 
            src={capitalImage}
            alt="Capital badge" 
            className="capital-icon-img"
          />
          <span className="capital-level">Capital Level {clan.clanCapitalLevel ?? 0}</span>
        </div> */}
      </div>

      {/* Visit In-Game Button */}
      <a
        href={`https://link.clashofclans.com/en/?action=OpenClanProfile&tag=${clan.tag.replace('#', '%23')}`}
        target="_blank"
        rel="noopener noreferrer"
        className="visit-ingame-btn"
        onClick={(e) => e.stopPropagation()}
      >
        🎮 Visit In-Game
      </a>
    </div>
  )
}

export default ClanCard

