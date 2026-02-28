import React from 'react'
import { sortMembersByPosition } from '../../../utils/cwlUtils'
import { thImages } from '../../../constants/thImages'

/**
 * Component to display war members table
 */
export const WarMembersTable = ({ members, title, sortBy = 'position', opponentMembers = [], isAdmin = false }) => {
  if (!members || members.length === 0) return null

  const sortedMembers = sortBy === 'position' 
    ? sortMembersByPosition(members)
    : members

  // Sort opponent members by position to calculate sequential positions
  const sortedOpponentMembers = sortMembersByPosition(opponentMembers)

  // Helper function to find defender by tag
  const findDefender = (defenderTag) => {
    return opponentMembers.find(m => {
      const normalizedDefenderTag = defenderTag?.replace('#', '').toUpperCase()
      const normalizedMemberTag = m.tag?.replace('#', '').toUpperCase()
      return normalizedMemberTag === normalizedDefenderTag
    })
  }

  // Helper function to get sequential position (1-based) in sorted array
  const getSequentialPosition = (member, sortedArray) => {
    const index = sortedArray.findIndex(m => m.tag === member.tag)
    return index >= 0 ? index + 1 : null
  }

  return (
    <div className="cwl-war-members-section">
      <div className="cwl-table-wrapper">
        <table className="cwl-table">
          <thead>
            <tr>
              <th>Position</th>
              <th>Attacker</th>
              <th>Stars</th>
              <th>Destruction</th>
              <th>Target</th>
            </tr>
          </thead>
          <tbody>
            {sortedMembers.map((member, idx) => {
              const attacks = member.attacks || []
              
              // Check if any attack is a mirror bonus attack (only in admin mode)
              // Backend now calculates isMirrorAttack flag, so we just check it
              let hasMirrorBonusRule = false
              if (isAdmin) {
                hasMirrorBonusRule = attacks.some(attack => attack.isMirrorAttack === true)
              }
              
              return (
                <tr key={idx} className={hasMirrorBonusRule ? 'mirror-bonus-rule-row' : ''}>
                  <td className="cwl-table-value">{member.mapPosition}</td>
                  <td className="cwl-table-value">
                    <div className="cwl-attacker-info">
                      {thImages[member.townHallLevel || member.townhallLevel] && (
                        <img
                          src={thImages[member.townHallLevel || member.townhallLevel]}
                          alt={`TH${member.townHallLevel || member.townhallLevel}`}
                          className="cwl-attacker-th-image"
                        />
                      )}
                      <div className="cwl-attacker-details">
                        <div className="cwl-attacker-name">{member.name}</div>
                        <div className="cwl-attacker-tag">{member.tag}</div>
                      </div>
                    </div>
                  </td>
                  <td className="cwl-table-value">
                    {attacks.length > 0 ? (
                      <div className="cwl-attack-stars">
                        {attacks.map((attack, aIdx) => (
                          <span key={aIdx} className="cwl-star-entry">
                            {'⭐'.repeat(attack.stars || 0)}
                            <span className="cwl-star-count">{attack.stars || 0}</span>
                            {aIdx < attacks.length - 1 ? ' / ' : ''}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="cwl-no-attacks">No attacks</span>
                    )}
                  </td>
                  <td className="cwl-table-value">
                    {attacks.length > 0 ? (
                      <div className="cwl-attack-destruction">
                        {attacks.map((attack, aIdx) => (
                          <span key={aIdx} className="cwl-destruction-entry">
                            {(attack.destructionPercentage || 0).toFixed(1)}%
                            {aIdx < attacks.length - 1 ? ' / ' : ''}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="cwl-no-attacks">-</span>
                    )}
                  </td>
                  <td className="cwl-table-value">
                    {attacks.length > 0 ? (
                      <div className="cwl-attack-targets">
                        {attacks.map((attack, aIdx) => {
                          const defender = findDefender(attack.defenderTag)
                          return (
                            <div key={aIdx} className="cwl-target-entry">
                              {defender ? (
                                <div className="cwl-target-info">
                                  <span className="cwl-target-position">#{defender.mapPosition}</span>
                                  {thImages[defender.townHallLevel || defender.townhallLevel] && (
                                    <img
                                      src={thImages[defender.townHallLevel || defender.townhallLevel]}
                                      alt={`TH${defender.townHallLevel || defender.townhallLevel}`}
                                      className="cwl-target-th-image"
                                    />
                                  )}
                                  <span className="cwl-target-name">{defender.name}</span>
                                </div>
                              ) : (
                                <span className="cwl-target-unknown">-</span>
                              )}
                              {aIdx < attacks.length - 1 ? <span className="cwl-target-separator"> / </span> : null}
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <span className="cwl-no-attacks">-</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
