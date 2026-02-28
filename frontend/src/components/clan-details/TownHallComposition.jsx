import React from 'react'
import { thImages } from '../../constants/thImages'

function TownHallComposition({ memberList, totalMembers, thComposition: backendThComposition }) {
  // Backend always provides thComposition - use it directly
  const thComposition = backendThComposition || {}

  return (
    <div className="detail-section">
      <h3>🏠 Town Hall Composition</h3>
      <div className="th-composition">
        {Object.keys(thComposition).sort((a, b) => b - a).map(th => {
          // Backend provides { count, percentage }, frontend fallback uses just count
          const thData = typeof thComposition[th] === 'object' ? thComposition[th] : { count: thComposition[th] }
          const count = thData.count || thComposition[th]
          const percentage = thData.percentage !== undefined ? thData.percentage : (totalMembers > 0 ? (count / totalMembers) * 100 : 0)
          const thImage = thImages[th]
          
          return (
            <div key={th} className="th-bar-container">
              <div className="th-label">
                {thImage && (
                  <img src={thImage} alt={`TH${th}`} className="th-icon" />
                )}
                <span className="th-level">TH{th}</span>
                <span className="th-count">{count} members</span>
              </div>
              <div className="th-bar">
                <div
                  className="th-bar-fill"
                  style={{ width: `${percentage}%` }}
                >
                  <span className="th-percentage">{percentage.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default TownHallComposition

