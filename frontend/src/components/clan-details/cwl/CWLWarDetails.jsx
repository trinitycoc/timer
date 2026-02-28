import React, { useState } from 'react'
import { getValidWarTags, filterWarsForDay, normalizeTag } from '../../../utils/cwlUtils'
import { WarMembersTable } from '../wars/WarMembersTable'

export const CWLWarDetails = ({
  selectedDay,
  cwlGroupData,
  clanTag,
  fetchedWarsForDay,
  loadingFetchedWars,
  isAdmin = false
}) => {
  const [activeViews, setActiveViews] = useState({}) // Track view state per war index

  if (!selectedDay || !cwlGroupData?.group?.rounds) {
    return null
  }

  const getActiveView = (warIdx) => {
    // Always default to 'ourClan' - don't auto-switch to warEvents when admin mode is enabled
    return activeViews[warIdx] || 'ourClan'
  }

  const setActiveView = (warIdx, view) => {
    setActiveViews(prev => ({
      ...prev,
      [warIdx]: view
    }))
  }

  const selectedRound = cwlGroupData.group.rounds.find(r => r.round === selectedDay)
  if (!selectedRound || !selectedRound.warTags) {
    return <div className="cwl-no-wars">No wars found for Day {selectedDay}</div>
  }

  const validWarTags = getValidWarTags(selectedRound.warTags)
  if (validWarTags.length === 0) {
    return <div className="cwl-no-wars">No wars found for Day {selectedDay}</div>
  }

  // Find wars from loaded data
  // Priority: 1. warsByRound (from /all endpoint), 2. allWars, 3. currentWars, 4. fetchedWarsForDay
  let warsForDay = []

  // First check warsByRound - this is populated when using /all endpoint
  if (cwlGroupData.warsByRound && cwlGroupData.warsByRound[selectedDay]) {
    warsForDay = cwlGroupData.warsByRound[selectedDay]
  }

  // If not found, check allWars (flat array)
  if (warsForDay.length === 0 && cwlGroupData.allWars && cwlGroupData.allWars.length > 0) {
    warsForDay = filterWarsForDay(
      cwlGroupData.allWars,
      selectedRound.warTags
    )
  }

  // If no wars found in allWars, try currentWars as fallback
  if (warsForDay.length === 0 && cwlGroupData.currentWars && cwlGroupData.currentWars.length > 0) {
    warsForDay = filterWarsForDay(
      cwlGroupData.currentWars,
      selectedRound.warTags
    )
  }

  // If still no wars found, use automatically fetched wars (shouldn't happen if /all endpoint was used)
  if (warsForDay.length === 0) {
    if (loadingFetchedWars) {
      return (
        <div className="cwl-details-loading">
          <div className="spinner"></div>
          <p>Loading war details...</p>
        </div>
      )
    }
    if (fetchedWarsForDay.length > 0) {
      warsForDay = fetchedWarsForDay
    } else {
      return <div className="cwl-no-wars">No wars found for Day {selectedDay}</div>
    }
  }

  if (warsForDay.length === 0) {
    return <div className="cwl-no-wars">No wars found for Day {selectedDay}</div>
  }

  // Helper function to determine which clan is "our clan" and which is "opponent"
  const getOurClanAndOpponent = (war) => {
    if (!war.clan || !war.opponent || !clanTag) {
      return { ourClan: war.clan, opponentClan: war.opponent }
    }

    const normalizedOurTag = normalizeTag(clanTag) || clanTag
    const normalizedWarClanTag = normalizeTag(war.clan.tag) || war.clan.tag

    // If war.clan.tag matches our clanTag, then war.clan is our clan
    if (normalizedWarClanTag === normalizedOurTag) {
      return { ourClan: war.clan, opponentClan: war.opponent }
    } else {
      // Otherwise, war.opponent is our clan
      return { ourClan: war.opponent, opponentClan: war.clan }
    }
  }

  return (
    <div className="cwl-day-wars">
      {warsForDay.map((war, idx) => {
        const { ourClan, opponentClan } = getOurClanAndOpponent(war)

        return (
          <div key={idx} className="cwl-war-section">
            <div className="cwl-war-header">
              {ourClan && opponentClan ? (
                <div className="cwl-war-title-section">
                  <h4>{ourClan.name || 'Our Clan'} vs {opponentClan.name || 'Opponent Clan'}</h4>
                </div>
              ) : (
                <div className="cwl-war-title-section">
                  <h4>War {idx + 1}</h4>
                </div>
              )}
            </div>

            {/* Toggle Buttons */}
            <div className="cwl-members-view-toggle">
              <button
                className={`cwl-toggle-btn ${getActiveView(idx) === 'ourClan' ? 'active' : ''}`}
                onClick={() => setActiveView(idx, 'ourClan')}
              >
                Our Attacks
              </button>
              <button
                className={`cwl-toggle-btn ${getActiveView(idx) === 'opponent' ? 'active' : ''}`}
                onClick={() => setActiveView(idx, 'opponent')}
              >
                Opponent Attacks
              </button>
              {isAdmin && (
                <button
                  className={`cwl-toggle-btn ${getActiveView(idx) === 'warEvents' ? 'active' : ''}`}
                  onClick={() => setActiveView(idx, 'warEvents')}
                >
                  📜 War Events
                </button>
              )}
            </div>

            {/* War Events Timeline - Show when warEvents is selected (admin only) */}
            {isAdmin && getActiveView(idx) === 'warEvents' && (
              <div className="war-events-timeline">
                <h4 className="timeline-header">
                  📜 Attack Timeline ({(() => {
                    const allAttacks = []
                    ourClan?.members?.forEach(member => {
                      member.attacks?.forEach(attack => allAttacks.push({ ...attack, isOurClan: true, attacker: member }))
                    })
                    opponentClan?.members?.forEach(member => {
                      member.attacks?.forEach(attack => allAttacks.push({ ...attack, isOurClan: false, attacker: member }))
                    })
                    return allAttacks.length
                  })()})
                </h4>
                {(() => {
                  // Collect all attacks from both clans
                  const allAttacks = []

                  // Add our clan's attacks
                  ourClan?.members?.forEach(member => {
                    member.attacks?.forEach(attack => {
                      // Find defender
                      const defender = opponentClan?.members?.find(m => {
                        const normalizedDefenderTag = (attack.defenderTag || '').replace('#', '').toUpperCase()
                        const normalizedMemberTag = (m.tag || '').replace('#', '').toUpperCase()
                        return normalizedMemberTag === normalizedDefenderTag
                      })
                      allAttacks.push({
                        ...attack,
                        attacker: member,
                        defender: defender,
                        attackerClan: ourClan,
                        defenderClan: opponentClan,
                        isOurAttack: true
                      })
                    })
                  })

                  // Add opponent's attacks
                  opponentClan?.members?.forEach(member => {
                    member.attacks?.forEach(attack => {
                      // Find defender
                      const defender = ourClan?.members?.find(m => {
                        const normalizedDefenderTag = (attack.defenderTag || '').replace('#', '').toUpperCase()
                        const normalizedMemberTag = (m.tag || '').replace('#', '').toUpperCase()
                        return normalizedMemberTag === normalizedDefenderTag
                      })
                      allAttacks.push({
                        ...attack,
                        attacker: member,
                        defender: defender,
                        attackerClan: opponentClan,
                        defenderClan: ourClan,
                        isOurAttack: false
                      })
                    })
                  })

                  // Sort by attack order (descending - newest first)
                  allAttacks.sort((a, b) => (b.order || 0) - (a.order || 0))

                  return allAttacks.length > 0 ? (
                    <div className="events-list">
                      {allAttacks.map((attack, index) => {
                        // For defenses, swap attacker and defender positions
                        const leftPlayer = attack.isOurAttack ? attack.attacker : attack.defender
                        const rightPlayer = attack.isOurAttack ? attack.defender : attack.attacker

                        return (
                          <div key={index} className={`event-item ${attack.isOurAttack ? 'our-attack' : 'our-defense'}`}>
                            <div className="event-order">#{attack.order}</div>

                            <div className="event-attacker">
                              <div className="player-position">#{leftPlayer?.mapPosition || '?'}</div>
                              <div className="player-info">
                                <div className="player-name">{leftPlayer?.name || 'Unknown'}</div>
                                <div className="player-th">TH{leftPlayer?.townHallLevel || leftPlayer?.townhallLevel || '?'}</div>
                              </div>
                            </div>

                            <div className="event-arrow">{attack.isOurAttack ? '→' : '←'}</div>

                            <div className="event-result">
                              <div className="result-stars">
                                {'⭐'.repeat(attack.stars || 0)}
                                {'☆'.repeat(3 - (attack.stars || 0))}
                              </div>
                              <div className="result-destruction">
                                {(attack.destructionPercentage || attack.destruction || 0).toFixed(0)}%
                              </div>
                            </div>

                            <div className="event-arrow">{attack.isOurAttack ? '→' : '←'}</div>

                            <div className="event-defender">
                              <div className="player-position">#{rightPlayer?.mapPosition || '?'}</div>
                              <div className="player-info">
                                <div className="player-name">{rightPlayer?.name || 'Unknown'}</div>
                                <div className="player-th">TH{rightPlayer?.townHallLevel || rightPlayer?.townhallLevel || '?'}</div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="no-events">No attacks have been made yet</div>
                  )
                })()}
              </div>
            )}

            {/* Our Clan Members - Show when ourClan is selected */}
            {getActiveView(idx) === 'ourClan' && ourClan?.members?.length > 0 && (
              <WarMembersTable
                members={ourClan.members}
                title="Our Clan Members"
                opponentMembers={opponentClan?.members || []}
                isAdmin={isAdmin}
              />
            )}

            {/* Opponent Members - Show when opponent is selected */}
            {getActiveView(idx) === 'opponent' && opponentClan?.members?.length > 0 && (
              <WarMembersTable
                members={opponentClan.members}
                title="Opponent Members"
                opponentMembers={ourClan?.members || []}
                isAdmin={isAdmin}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

