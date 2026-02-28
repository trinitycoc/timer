import React from 'react'

/**
 * Component to display attack details inline
 */
export const AttackDetails = ({ attacks }) => {
  if (!attacks || attacks.length === 0) {
    return <span className="cwl-no-attacks">No attacks</span>
  }

  return (
    <span className="cwl-attack-details-inline">
      {attacks.map((attack, idx) => (
        <span key={idx} className="cwl-attack-item">
          {attack.stars}⭐ {attack.destructionPercentage}%
          {idx < attacks.length - 1 ? ', ' : ''}
        </span>
      ))}
    </span>
  )
}

