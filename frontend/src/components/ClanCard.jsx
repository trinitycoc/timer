import React from 'react'
import { useNavigate } from 'react-router-dom'

function formatWarEndTime(isoString) {
  if (!isoString) return ''
  const d = new Date(isoString)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

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
      <div className="clan-card-main">
        <img
          src={clan.badgeUrls?.medium || clan.badgeUrls?.small || clan.badgeUrls?.large}
          alt=""
          className="clan-badge"
        />
        <div className="clan-name-tag">
          <h4 className="clan-name">{clan.name}</h4>
          <p className="clan-tag">{clan.tag}</p>
        </div>
      </div>

      <div className="clan-card-meta">
        {clan.members !== undefined && (
          <span className="clan-members-count">👥 {clan.members}/50</span>
        )}
        {clan.currentWar && (
        <div className="clan-war-status">
          {clan.currentWar.state === 'notInWar' && (
            <span className="war-status war-not-in-war">
              Not in war
              {clan.lastNotInWarAt && (
                <span className="war-not-in-war-time" title={new Date(clan.lastNotInWarAt).toLocaleString()}>
                  {' '}(since {formatWarEndTime(clan.lastNotInWarAt)})
                </span>
              )}
            </span>
          )}
          {clan.currentWar.state === 'preparation' && (
            <span className="war-status war-preparation">⚔️ Preparation</span>
          )}
          {clan.currentWar.state === 'inWar' && (
            <span className="war-status war-in-war">
              ⚔️ vs {clan.currentWar.opponent?.name || 'Unknown'}
              {clan.currentWar.clan?.stars != null && clan.currentWar.opponent?.stars != null && (
                <span className="war-score">
                  {' '}{clan.currentWar.clan.stars} – {clan.currentWar.opponent.stars}
                </span>
              )}
            </span>
          )}
          {clan.currentWar.state === 'warEnded' && (
            <span className="war-status war-ended">
              War ended
              {clan.currentWar.clan?.stars != null && clan.currentWar.opponent?.stars != null && (
                <span className="war-score">
                  {' '}{clan.currentWar.clan.stars} – {clan.currentWar.opponent.stars}
                </span>
              )}
            </span>
          )}
        </div>
        )}
      </div>
    </div>
  )
}

export default ClanCard

