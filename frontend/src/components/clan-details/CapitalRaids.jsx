import React from 'react'

function CapitalRaids({ capitalRaids }) {
  return (
    <>
      {capitalRaids.length > 0 && (
        <div className="detail-section">
          <h3>🏰 Capital Raids (Last {Math.min(capitalRaids.length, 10)} weekends)</h3>
          <div className="capital-raids">
            {capitalRaids.slice(0, 10).map((raid, index) => (
              <div key={index} className="capital-raid-item">
                <div className="raid-header">
                  <div className="raid-date">
                    📅 {raid.startTime ? new Date(raid.startTime).toLocaleDateString() : 'N/A'} - {raid.endTime ? new Date(raid.endTime).toLocaleDateString() : 'N/A'}
                  </div>
                  <div className="raid-state">
                    {raid.state || 'ended'}
                  </div>
                </div>
                <div className="raid-stats">
                  <div className="raid-stat">
                    <span className="stat-label">🎯 Total Loot</span>
                    <span className="stat-value">{raid.capitalTotalLoot?.toLocaleString() || 0}</span>
                  </div>
                  <div className="raid-stat">
                    <span className="stat-label">⚔️ Raids Completed</span>
                    <span className="stat-value">{raid.raidsCompleted || 0}</span>
                  </div>
                  <div className="raid-stat">
                    <span className="stat-label">⚡ Total Attacks</span>
                    <span className="stat-value">{raid.totalAttacks || 0}</span>
                  </div>
                  <div className="raid-stat">
                    <span className="stat-label">💥 Districts Destroyed</span>
                    <span className="stat-value">{raid.enemyDistrictsDestroyed || 0}</span>
                  </div>
                  <div className="raid-stat">
                    <span className="stat-label">🏆 Offensive Reward</span>
                    <span className="stat-value">{raid.offensiveReward?.toLocaleString() || 0}</span>
                  </div>
                  <div className="raid-stat">
                    <span className="stat-label">🛡️ Defensive Reward</span>
                    <span className="stat-value">{raid.defensiveReward?.toLocaleString() || 0}</span>
                  </div>
                </div>
                {raid.attackLog && raid.attackLog.length > 0 && (
                  <div className="raid-attacks">
                    <h5>⚔️ Attack Log ({raid.attackLog.length} attacks):</h5>
                    <div className="attack-log">
                      {raid.attackLog.slice(0, 5).map((attack, attackIndex) => (
                        <div key={attackIndex} className="attack-item">
                          <span>🏰 {attack.defender?.name || 'Unknown'}</span>
                          <span>⭐ {attack.stars || 0} stars</span>
                          <span>💥 {attack.destructionPercent || 0}%</span>
                        </div>
                      ))}
                      {raid.attackLog.length > 5 && (
                        <div className="attack-item">
                          <span>... and {raid.attackLog.length - 5} more attacks</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {raid.defenseLog && raid.defenseLog.length > 0 && (
                  <div className="raid-attacks">
                    <h5>🛡️ Defense Log ({raid.defenseLog.length} defenses):</h5>
                    <div className="attack-log">
                      {raid.defenseLog.slice(0, 5).map((defense, defenseIndex) => (
                        <div key={defenseIndex} className="attack-item">
                          <span>⚔️ {defense.attacker?.name || 'Unknown'}</span>
                          <span>⭐ {defense.stars || 0} stars</span>
                          <span>💥 {defense.destructionPercent || 0}%</span>
                        </div>
                      ))}
                      {raid.defenseLog.length > 5 && (
                        <div className="attack-item">
                          <span>... and {raid.defenseLog.length - 5} more defenses</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {capitalRaids.length === 0 && (
        <div className="detail-section">
          <h3>🏰 Capital Raids</h3>
          <p className="war-log-private">📊 No capital raid data available. The clan may not have participated in capital raids yet.</p>
        </div>
      )}
    </>
  )
}

export default CapitalRaids

