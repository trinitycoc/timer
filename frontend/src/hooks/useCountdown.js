import { useState, useEffect } from 'react'

/**
 * Custom hook for countdown timer
 */
export function useCountdown(targetTime) {
  const [timeRemaining, setTimeRemaining] = useState('')

  useEffect(() => {
    if (!targetTime) {
      setTimeRemaining('')
      return () => {}
    }

    let interval = null
    
    const updateCountdown = () => {
      const now = new Date().getTime()
      const target = new Date(targetTime).getTime()
      const difference = target - now

      if (difference <= 0) {
        setTimeRemaining('Ended')
        if (interval) {
          clearInterval(interval)
        }
        return
      }

      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((difference % (1000 * 60)) / 1000)

      setTimeRemaining(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`)
    }

    updateCountdown()
    interval = setInterval(updateCountdown, 1000)

    return () => {
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [targetTime])

  return timeRemaining
}

