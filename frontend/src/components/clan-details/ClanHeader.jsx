import React from 'react'
import SectionTitle from '../SectionTitle'
import cwlImage from '/cwl.webp'
import { getLeagueImage } from '../../constants/leagueImages'

function ClanHeader({ clan, currentWar, warLog, showCurrentWar, showWarLog, showCapitalRaids /* commented out - not integrated yet */, showCWLDetails, setShowCurrentWar, setShowWarLog, setShowCapitalRaids /* commented out - not integrated yet */, setShowCWLDetails, isCWLClan }) {
  return (
    <div className="clan-header-info">
      <SectionTitle>{clan.name}</SectionTitle>
      <p className="clan-tag-large">{clan.tag}</p>
      
      {/* First Row: Location, Members, Wins (Trinity only), CWL League */}
      <div className="clan-info-grid clan-info-row-1">
        {clan.location?.name && (
          <div className="clan-info-item clan-info-inline">
            <span className="info-value">📍 {clan.location.name}</span>
          </div>
        )}
        <div className="clan-info-item clan-info-inline">
          <span className="info-value">👥 {clan.members}/50</span>
        </div>
        {!isCWLClan && (
          <div className="clan-info-item clan-info-inline">
            <span className="info-value">⚔️ {clan.warWins} Wins</span>
          </div>
        )}
        {clan.warLeague?.name && (
          <div className="clan-info-item clan-info-inline">
            <span className="info-value">
              {(() => {
                const leagueImg = getLeagueImage(clan.warLeague.name)
                if (leagueImg) {
                  return (
                    <img 
                      src={leagueImg} 
                      alt={clan.warLeague.name} 
                      className="cwl-icon-inline"
                      onError={(e) => {
                        e.target.src = cwlImage
                      }}
                    />
                  )
                }
                return <img src={cwlImage} alt="CWL" className="cwl-icon-inline" />
              })()}
              {clan.warLeague.name}
            </span>
          </div>
        )}
      </div>
      
      {/* Second Row: Type, War Log, Leader, TH Required */}
      <div className="clan-info-grid clan-info-row-2">
        <div className="clan-info-item clan-info-inline">
          <span className="info-value">
            {clan.type === 'open' && '🟢 Open'}
            {clan.type === 'inviteOnly' && '🔵 Invite Only'}
            {clan.type === 'closed' && '🔴 Closed'}
          </span>
        </div>
        <div className="clan-info-item clan-info-inline">
          <span className="info-value">
            {clan.isWarLogPublic ? '🔓 Public' : '🔒 Private'}
          </span>
        </div>
        {clan.memberList?.find(m => m.role === 'leader') && (
          <div className="clan-info-item clan-info-inline">
            <span className="info-value">
              👑 {clan.memberList.find(m => m.role === 'leader').name}
            </span>
          </div>
        )}
        {clan.requiredTownhallLevel > 0 && (
          <div className="clan-info-item clan-info-inline">
            <span className="info-value">🏠 TH {clan.requiredTownhallLevel}+</span>
          </div>
        )}
      </div>
      
      <div className="header-actions">
        <button
          className="war-log-toggle"
          onClick={() => {
            if (!showCurrentWar) {
              setShowWarLog(false)
              setShowCWLDetails(false)
              // if (!isCWLClan) setShowCapitalRaids(false) // TODO: Capital Raids not integrated yet
            }
            setShowCurrentWar(!showCurrentWar)
          }}
        >
          {showCurrentWar ? '🗡️ Hide Current War' : '🗡️ Show Current War'}
        </button>
        {(warLog.length > 0 || clan.isWarLogPublic) && (
          <button
            className="war-log-toggle"
            onClick={() => {
              if (!showWarLog) {
                setShowCurrentWar(false)
                setShowCWLDetails(false)
                // if (!isCWLClan) setShowCapitalRaids(false) // TODO: Capital Raids not integrated yet
              }
              setShowWarLog(!showWarLog)
            }}
          >
            {showWarLog ? '📊 Hide War Log' : '📊 Show War Log'}
          </button>
        )}
        {isCWLClan && (
          <button
            className="war-log-toggle"
            onClick={() => {
              if (!showCWLDetails) {
                setShowCurrentWar(false)
                setShowWarLog(false)
              }
              setShowCWLDetails(!showCWLDetails)
            }}
          >
            {showCWLDetails ? '🏆 Hide CWL Stats' : '🏆 Show CWL Stats'}
          </button>
        )}
        {/* TODO: Capital Raids not integrated yet - commenting out to prevent unnecessary API calls */}
        {/* {!isCWLClan && (
          <button
            className="war-log-toggle"
            onClick={() => {
              if (!showCapitalRaids) {
                setShowCurrentWar(false)
                setShowWarLog(false)
              }
              setShowCapitalRaids(!showCapitalRaids)
            }}
          >
            {showCapitalRaids ? '🏰 Hide Capital Raids' : '🏰 Show Capital Raids'}
          </button>
        )} */}
        <a
          href={`https://link.clashofclans.com/en/?action=OpenClanProfile&tag=${clan.tag.replace('#', '%23')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="visit-ingame-btn"
        >
          🎮 Visit In-Game
        </a>
      </div>
    </div>
  )
}

export default ClanHeader

