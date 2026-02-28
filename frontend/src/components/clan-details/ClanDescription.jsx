import React from 'react'

function ClanDescription({ description }) {
  return (
    <div className="detail-section">
      <h3>📝 Description</h3>
      <p className="clan-description-full">{description}</p>
    </div>
  )
}

export default ClanDescription

