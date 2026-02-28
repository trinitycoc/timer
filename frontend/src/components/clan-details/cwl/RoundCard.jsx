import React from 'react'
import { useCountdown } from '../../../hooks/useCountdown'
import { CWLWarDetails } from './CWLWarDetails'

export const RoundCard = ({
    day,
    stats,
    roundWars,
    ourAttacks,
    opponentAttacks,
    maxAttacks,
    teamSize,
    isExpanded,
    onToggle,
    getResultText,
    getResultClass,
    getRoundCardClass,
    cwlGroupData,
    clanTag,
    selectedDay,
    fetchedWarsForDay,
    fetchedWarsByRound,
    loadingFetchedWars,
    isAdmin = false
}) => {
    // Find active war for countdown display (priority: inWar > preparation)
    const activeWar = roundWars.find(war =>
        war.state === 'inWar'
    ) || roundWars.find(war =>
        war.state === 'preparation'
    ) || null

    // Determine target time based on war state
    const isPreparation = activeWar?.state === 'preparation'
    const isInWar = activeWar?.state === 'inWar'
    const targetTime = isPreparation ? activeWar?.startTime : (isInWar ? activeWar?.endTime : null)
    const countdown = useCountdown(targetTime)

    // Format countdown message
    const getCountdownMessage = () => {
        if (!activeWar || !targetTime || !countdown || countdown === 'Ended') return null

        if (isPreparation) {
            return `Battle starts in ${countdown}`
        } else if (isInWar) {
            return `Battle ends in ${countdown}`
        }
        return null
    }

    const countdownMessage = getCountdownMessage()
    const ourTeamSize = teamSize ?? stats.teamSize ?? stats.ourTeamSize ?? 'N/A'
    const opponentTeamSize = stats.opponentTeamSize ?? teamSize ?? stats.teamSize ?? 'N/A'

    const formatPercentage = value => {
        if (typeof value === 'number') {
            return `${value.toFixed(2)}%`
        }
        if (value === null || value === undefined || value === '') {
            return 'N/A'
        }
        return value
    }

    const formatAttacks = value => {
        if (value === null || value === undefined) {
            return 'N/A'
        }
        return value
    }

    const statComparisons = [
        {
            key: 'stars',
            label: 'Stars',
            ourValue: stats.ourStars ?? 'N/A',
            opponentValue: stats.opponentStars ?? 'N/A'
        },
        {
            key: 'destruction',
            label: 'Destruction',
            ourValue: formatPercentage(stats.ourDestruction),
            opponentValue: formatPercentage(stats.opponentDestruction)
        },
        {
            key: 'attacks',
            label: 'Attacks Used',
            ourValue: `${formatAttacks(ourAttacks)}`,
            opponentValue: `${formatAttacks(opponentAttacks)}`
        },
        {
            key: 'team-size',
            label: 'Team Size',
            ourValue: ourTeamSize,
            opponentValue: opponentTeamSize
        }
    ]

    // Calculate dynamic gradient for in-progress cards based on star comparison
    const getInProgressGradient = () => {
        const isInProgress = stats.status?.toLowerCase() === 'in progress' || stats.status?.toLowerCase().includes('progress')
        if (!isInProgress) return null

        const ourStars = stats.ourStars || 0
        const opponentStars = stats.opponentStars || 0
        const totalStars = ourStars + opponentStars

        // Calculate green percentage based on our stars
        // Clamp between 20% and 80% for visual effect (never fully green or red)
        let greenPercentage = 50 // Default 50/50 split
        if (totalStars > 0) {
            greenPercentage = (ourStars / totalStars) * 100
            greenPercentage = Math.max(20, Math.min(80, greenPercentage))
        }

        // Calculate border color based on star comparison
        // More green if we're winning, more red if we're losing
        let borderColor = 'rgba(102, 126, 234, 0.3)' // Default neutral
        if (totalStars > 0) {
            if (ourStars > opponentStars) {
                borderColor = 'rgba(74, 222, 128, 0.6)' // Green when winning
            } else if (ourStars < opponentStars) {
                borderColor = 'rgba(239, 68, 68, 0.6)' // Red when losing
            }
        }

        return {
            '--gradient-stop': `${greenPercentage}%`,
            'borderLeftColor': borderColor
        }
    }

    const inProgressStyle = getInProgressGradient()

    return (
        <div
            className={`current-war cwl-round-card ${isExpanded ? 'expanded' : ''} ${getRoundCardClass(stats.result, stats.status)}`}
            style={inProgressStyle || {}}
        >
            {/* Round Header - 3 Column Layout */}
            <div className="cwl-round-card-header">
                {/* Column 1: Round Info */}
                <div className="cwl-round-header-col-1">
                    <div className="cwl-round-badge-header">
                        <div className="cwl-round-badge">R{day}</div>
                        <div className="cwl-round-header-text">
                            <div className="cwl-round-title">Round {day}</div>
                            <div className="cwl-round-status">{stats.status}</div>
                        </div>
                    </div>
                </div>
                
                {/* Column 2: Countdown Timer */}
                <div className="cwl-round-header-col-2">
                    {countdownMessage && (
                        <div className="cwl-round-countdown-inline">
                            <span className="cwl-round-countdown-message">{countdownMessage}</span>
                        </div>
                    )}
                </div>
                
                {/* Column 3: Result Button */}
                <div className="cwl-round-header-col-3">
                    <button
                        className={`cwl-result-button ${getResultClass(stats.result)}`}
                    >
                        <span className="cwl-result-text">{getResultText(stats.result)}</span>
                    </button>
                </div>
            </div>

            {/* War Summary - Comparison Layout */}
            <div className="war-summary-grid">
                <div className="war-summary-col clan-overview our-clan">
                    {stats.ourClanBadge && (
                        <img
                            src={stats.ourClanBadge.medium || stats.ourClanBadge.small || stats.ourClanBadge.large || stats.ourClanBadge.url}
                            alt={stats.ourClanName}
                            className="war-clan-badge"
                        />
                    )}
                    <div className="clan-overview-text">
                        <h4>{stats.ourClanName}</h4>
                        <p>{stats.ourClanTag || 'N/A'}</p>
                    </div>
                </div>
                <div className="war-summary-col stats-comparison">
                    {statComparisons.map(item => (
                        <div className="stats-row" key={`comparison-${item.key}`}>
                            <span className="stat-value our-value">{item.ourValue}</span>
                            <span className="stat-label">{item.label}</span>
                            <span className="stat-value opponent-value">{item.opponentValue}</span>
                        </div>
                    ))}
                </div>
                <div className="war-summary-col clan-overview opponent-clan">
                    {stats.opponentClanBadge && (
                        <img
                            src={stats.opponentClanBadge.medium || stats.opponentClanBadge.small || stats.opponentClanBadge.large || stats.opponentClanBadge.url}
                            alt={stats.opponentClanName}
                            className="war-clan-badge"
                        />
                    )}
                    <div className="clan-overview-text">
                        <h4>{stats.opponentClanName}</h4>
                        <p>{stats.opponentClanTag || 'N/A'}</p>
                    </div>
                </div>
            </div>

            {/* Show/Hide Attacks Button */}
            <div className="cwl-attacks-toggle-container">
                <button
                    className="cwl-show-attacks-btn"
                    onClick={onToggle}
                >
                    {isExpanded ? 'Hide Attacks' : 'Show Attacks'}
                    <span className={`cwl-attacks-chevron ${isExpanded ? 'expanded' : ''}`}>▼</span>
                </button>
            </div>

            {/* War Details - Show under this specific round card when expanded */}
            {isExpanded && (
                <CWLWarDetails
                    selectedDay={day}
                    cwlGroupData={cwlGroupData}
                    clanTag={clanTag}
                    fetchedWarsForDay={
                        day === selectedDay
                            ? fetchedWarsForDay
                            : (fetchedWarsByRound[day] || [])
                    }
                    loadingFetchedWars={day === selectedDay ? loadingFetchedWars : false}
                    isAdmin={isAdmin}
                />
            )}
        </div>
    )
}

