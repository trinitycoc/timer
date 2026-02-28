import React, { useState } from 'react'
import { normalizeTag, sortMembersByTH, getPromotionDemotionSlots, isPromotionRank, isDemotionRank, getCWLMedalsByPosition, getCWLBonusMedals, getCWLTotalBonuses } from '../../../utils/cwlUtils'
import { thImages } from '../../../constants/thImages'
import { getLeagueImage } from '../../../constants/leagueImages'

export const CWLLeaderboard = ({ cwlGroupData, expandedClans, setExpandedClans, leagueName }) => {
  if (!cwlGroupData?.group?.clans || cwlGroupData.group.clans.length === 0) {
    return null
  }

  // Use pre-calculated leaderboard from backend if available
  // Fallback to calculating if backend doesn't provide it (backward compatibility)
  const leaderboard = cwlGroupData.leaderboard || []

  // Get promotion and demotion slots from backend if available, otherwise calculate
  const promotionDemotion = cwlGroupData.promotionDemotion || (leagueName ? getPromotionDemotionSlots(leagueName) : { promotionCount: 0, demotionCount: 0 })
  const { promotionCount, demotionCount } = promotionDemotion

  // Count clans in promotion and demotion zones
  const promotedCount = leaderboard.filter(clan => {
    // Use backend-provided value if available, otherwise calculate
    return clan.isPromoted !== undefined ? clan.isPromoted : isPromotionRank(clan.rank, promotionCount)
  }).length
  const demotedCount = leaderboard.filter(clan => {
    // Use backend-provided value if available, otherwise calculate
    return clan.isDemoted !== undefined ? clan.isDemoted : isDemotionRank(clan.rank, demotionCount)
  }).length

  return (
    <div className="cwl-subsection cwl-leaderboard">
      <div className="cwl-leaderboard-header">
        <div className="cwl-leaderboard-title">
          CWL Leaderboard
          {leagueName && <span className="cwl-leaderboard-league"> - {leagueName}</span>}
        </div>
        <div className="cwl-leaderboard-count">
          {leagueName && getLeagueImage(leagueName) && (
            <img 
              src={getLeagueImage(leagueName)} 
              alt={leagueName} 
              className="cwl-league-badge-large" 
            />
          )}
          {!leagueName && <span>{leaderboard.length} Groups</span>}
        </div>
      </div>
      <div className="cwl-leaderboard-table-wrapper">
        <table className="cwl-leaderboard-table">
          <thead>
            <tr>
              <th className="cwl-lb-rank">POSITION</th>
              <th className="cwl-lb-group">CLAN</th>
              <th className="cwl-lb-stars">STARS</th>
              <th className="cwl-lb-destruction">DESTRUCTION</th>
              <th className="cwl-lb-record">RECORD</th>
              <th className="cwl-lb-medals">REWARDS</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((group, idx) => {
              const normalizedTag = normalizeTag(group.tag) || group.tag
              const isExpanded = expandedClans.has(normalizedTag) || expandedClans.has(group.tag)
              const originalClan = cwlGroupData.group.clans.find(c => {
                const clanTag = normalizeTag(c.tag) || c.tag
                return clanTag === normalizedTag || c.tag === group.tag
              })
              const hasMembers = originalClan?.members && originalClan.members.length > 0

              const toggleMembers = (e) => {
                e.preventDefault()
                e.stopPropagation()
                if (!hasMembers || !originalClan) return

                const tagToUse = originalClan.tag

                if (isExpanded) {
                  setExpandedClans(new Set())
                } else {
                  const newExpanded = new Set([tagToUse])
                  setExpandedClans(newExpanded)
                }
              }

              // Use backend-provided values if available, otherwise calculate
              const isPromoted = group.isPromoted !== undefined 
                ? group.isPromoted 
                : isPromotionRank(group.rank, promotionCount)
              const isDemoted = group.isDemoted !== undefined 
                ? group.isDemoted 
                : isDemotionRank(group.rank, demotionCount)

              // Use backend-provided wins/ties/losses if available, otherwise parse from record string
              const wins = group.wins !== undefined ? group.wins : (group.record ? parseInt(group.record.split('-')[0]) || 0 : 0)
              const ties = group.ties !== undefined ? group.ties : (group.record ? parseInt(group.record.split('-')[1]) || 0 : 0)
              const losses = group.losses !== undefined ? group.losses : (group.record ? parseInt(group.record.split('-')[2]) || 0 : 0)
              
              // Get medal information - use backend-provided values if available, otherwise calculate
              const medalsPerMember = group.medalsPerMember !== undefined && group.medalsPerMember !== null
                ? group.medalsPerMember
                : (leagueName ? getCWLMedalsByPosition(leagueName, group.rank) : null)
              const bonusMedals = group.bonusMedals !== undefined && group.bonusMedals !== null
                ? group.bonusMedals
                : (leagueName ? getCWLBonusMedals(leagueName) : null)
              const totalBonuses = group.totalBonuses !== undefined && group.totalBonuses !== null
                ? group.totalBonuses
                : (leagueName ? getCWLTotalBonuses(leagueName, wins) : null)

              return (
                <tr key={idx} className={`cwl-lb-row ${isPromoted ? 'promotion-zone' : ''} ${isDemoted ? 'demotion-zone' : ''}`}>
                  <td className="cwl-lb-rank">
                    <span className="cwl-lb-rank-badge">
                      {group.rank}
                      {isPromoted && <span className="cwl-rank-indicator promotion"></span>}
                      {isDemoted && <span className="cwl-rank-indicator demotion"></span>}
                    </span>
                  </td>
                  <td className="cwl-lb-group">
                    <div className="cwl-lb-group-info">
                      {group.badgeUrls?.medium && (
                        <img
                          src={group.badgeUrls.medium}
                          alt={group.name}
                          className={`cwl-lb-badge ${hasMembers ? 'clickable' : ''}`}
                          onClick={hasMembers ? toggleMembers : undefined}
                          style={hasMembers ? { cursor: 'pointer' } : {}}
                          title={hasMembers ? (isExpanded ? 'Hide members' : 'Show members') : ''}
                        />
                      )}
                      <div className="cwl-lb-group-details">
                        <div
                          className={`cwl-lb-group-name ${hasMembers ? 'clickable' : ''}`}
                          onClick={hasMembers ? toggleMembers : undefined}
                          style={hasMembers ? { cursor: 'pointer' } : {}}
                          title={hasMembers ? (isExpanded ? 'Hide members' : 'Show members') : ''}
                        >
                          {group.name}
                        </div>
                        <div className="cwl-lb-group-tag">{group.tag}</div>
                      </div>
                    </div>
                  </td>
                  <td className="cwl-lb-stars">
                    {group.earnedStars !== undefined && group.winRewardStars !== undefined ? (
                      <span className="cwl-stars-breakdown">
                        <span className="cwl-stars-total">{group.totalStars}</span>
                        <span className="cwl-stars-separator"> = </span>
                        <span className="cwl-stars-earned">{group.earnedStars}</span>
                        <span className="cwl-stars-plus"> + </span>
                        <span className="cwl-stars-reward">{group.winRewardStars}</span>
                      </span>
                    ) : (
                      <span>{group.totalStars}</span>
                    )}
                  </td>
                  <td className="cwl-lb-destruction">
                    {Math.round(group.totalDestruction).toLocaleString()}
                  </td>
                  <td className="cwl-lb-record">
                    <span className="cwl-lb-record-value">
                      <>
                        <span>({wins} win{wins !== 1 ? 's' : ''})</span>
                        <span className="cwl-record-separator"> - </span>
                        <span className="cwl-record-loss">({losses} lose{losses !== 1 ? 's' : ''})</span>
                      </>
                    </span>
                  </td>
                  <td className="cwl-lb-medals">
                    {leagueName && (
                      <div className="cwl-lb-medals-info">
                        {medalsPerMember !== null && (
                          <div className="cwl-lb-medals-per-member">
                            <span className="cwl-lb-medals-label">Medals:</span>
                            <span className="cwl-lb-medals-value">{medalsPerMember}</span>
                          </div>
                        )}
                        {bonusMedals !== null && (
                          <div className="cwl-lb-bonus-medals">
                            <span className="cwl-lb-medals-label">Bonus:</span>
                            <span className="cwl-lb-medals-value">{bonusMedals}</span>
                          </div>
                        )}
                        {totalBonuses !== null && (
                          <div className="cwl-lb-total-bonuses">
                            <span className="cwl-lb-medals-label">Bonuses:</span>
                            <span className="cwl-lb-medals-value">{totalBonuses}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* CWL Members by Group - Only show when expanded */}
      {cwlGroupData.group.clans.some(clan => {
        const clanTag = normalizeTag(clan.tag) || clan.tag
        return clan.members && clan.members.length > 0 && (expandedClans.has(clan.tag) || expandedClans.has(clanTag))
      }) && (
        <div className="cwl-members-by-clan">
          {cwlGroupData.group.clans.map((cwlClan, idx) => {
            const clanTag = normalizeTag(cwlClan.tag) || cwlClan.tag
            const isExpanded = expandedClans.has(cwlClan.tag) || expandedClans.has(clanTag)

            if (!cwlClan.members || cwlClan.members.length === 0 || !isExpanded) {
              return null
            }

            return (
              <div key={idx} className="cwl-clan-members">
                <div className="cwl-members-section-header">
                  <div className="cwl-members-section-title">{cwlClan.name} - Members ({cwlClan.members.length})</div>
                </div>
                <div className="cwl-members-cards-grid">
                  {sortMembersByTH(cwlClan.members).map((member, mIdx) => {
                    const thLevel = member.townHallLevel || member.townhallLevel || 0
                    const thImage = thImages[thLevel]
                    return (
                      <div key={mIdx} className="cwl-member-card">
                        <div className="cwl-member-card-number">#{mIdx + 1}</div>
                        <div className="cwl-member-card-content">
                          <div className="cwl-member-card-name">{member.name}</div>
                          <div className="cwl-member-card-tag">{member.tag}</div>
                          <div className="cwl-member-card-th">
                            {thImage && (
                              <img
                                src={thImage}
                                alt={`TH${thLevel}`}
                                className="cwl-member-th-image"
                              />
                            )}
                            <span className="cwl-member-th-value">{thLevel}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

