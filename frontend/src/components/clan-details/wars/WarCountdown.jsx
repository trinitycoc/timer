import React from 'react'
import { useCountdown } from '../../../hooks/useCountdown'

export const WarCountdown = ({ war }) => {
  if (!war) return null

  const isPreparation = war.state === 'preparation'
  const isInWar = war.state === 'inWar'
  const targetTime = isPreparation ? war.startTime : (isInWar ? war.endTime : null)
  const countdown = useCountdown(targetTime)

  if (!targetTime || !countdown) return null

  const label = isPreparation ? 'Preparation Day Ends in' : 'Battle Day Ends in'

  return (
    <div className="cwl-war-countdown">
      <span className="cwl-countdown-label">{label}:</span>
      <span className="cwl-countdown-time">{countdown}</span>
    </div>
  )
}
