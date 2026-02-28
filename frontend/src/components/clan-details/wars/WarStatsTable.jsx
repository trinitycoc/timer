import React from 'react'
import { formatDestruction } from '../../../utils/cwlUtils'

/**
 * Component to display war statistics comparison table
 */
export const WarStatsTable = ({ clan, opponent, title = 'War Stats' }) => {
  if (!clan || !opponent) return null

  return (
    <div className="cwl-war-comparison">
      <h3 className="cwl-war-stats-title">{title}</h3>
      <div className="cwl-table-wrapper">
        <table className="cwl-table">
          <thead>
            <tr>
              <th></th>
              <th>Our Clan ({clan.name})</th>
              <th>Opponent ({opponent.name})</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="cwl-table-label">Tag</td>
              <td className="cwl-table-value">{clan.tag}</td>
              <td className="cwl-table-value">{opponent.tag}</td>
            </tr>
            <tr>
              <td className="cwl-table-label">Clan Level</td>
              <td className="cwl-table-value">{clan.clanLevel}</td>
              <td className="cwl-table-value">{opponent.clanLevel}</td>
            </tr>
            <tr>
              <td className="cwl-table-label">Stars</td>
              <td className="cwl-table-value">{clan.stars}</td>
              <td className="cwl-table-value">{opponent.stars}</td>
            </tr>
            <tr>
              <td className="cwl-table-label">Attacks</td>
              <td className="cwl-table-value">{clan.attacks}</td>
              <td className="cwl-table-value">{opponent.attacks}</td>
            </tr>
            <tr>
              <td className="cwl-table-label">Destruction %</td>
              <td className="cwl-table-value">{formatDestruction(clan.destructionPercentage)}%</td>
              <td className="cwl-table-value">{formatDestruction(opponent.destructionPercentage)}%</td>
            </tr>
            <tr>
              <td className="cwl-table-label">XP Earned</td>
              <td className="cwl-table-value">{clan.expEarned}</td>
              <td className="cwl-table-value">{opponent.expEarned}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
