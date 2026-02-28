import React, { useMemo, useCallback, memo } from 'react'
import { thImages } from '../../../constants/thImages'

export const CWLMembersSummary = ({ cwlGroupData, clanTag, leagueName, sortBy = 'total', onSortChange }) => {
  // Get base member summary data (unsorted or sorted by total)
  const baseSummaryData = useMemo(() => {
    if (!cwlGroupData) {
      return []
    }

    // Backend provides pre-calculated memberSummary from /all endpoint
    if (cwlGroupData.memberSummary && Array.isArray(cwlGroupData.memberSummary) && cwlGroupData.memberSummary.length > 0) {
      return cwlGroupData.memberSummary
    }

    // Fallback: If backend doesn't provide memberSummary (e.g., using /current endpoint), return empty
    return []
  }, [cwlGroupData])

  // Sort the data client-side based on sortBy to avoid refetch and scroll jump
  const summaryData = useMemo(() => {
    if (baseSummaryData.length === 0) {
      return []
    }

    // If sorting by total, use data as-is (already sorted by total from backend)
    if (sortBy === 'total') {
      return baseSummaryData
    }

    // For round-specific sorting, sort client-side
    const roundNum = parseInt(sortBy)
    if (isNaN(roundNum)) {
      return baseSummaryData
    }

    // Create a copy and sort
    const sorted = [...baseSummaryData].sort((a, b) => {
      const aRoundData = a.rounds[roundNum]
      const bRoundData = b.rounds[roundNum]
      
      // Members without data for this round go to the bottom
      if (!aRoundData && !bRoundData) return 0
      if (!aRoundData) return 1
      if (!bRoundData) return -1
      
      // Sort by stars first (descending)
      if (bRoundData.stars !== aRoundData.stars) {
        return bRoundData.stars - aRoundData.stars
      }
      // Then by destruction (descending)
      return bRoundData.destruction - aRoundData.destruction
    })

    return sorted
  }, [baseSummaryData, sortBy])

  if (summaryData.length === 0) {
    return null
  }

  // Determine which rounds have actually occurred or are in progress
  // Optimized: Check roundStats first (fastest, already computed), then memberSummary
  // Use baseSummaryData instead of summaryData to avoid recalculation on sort changes
  const validRounds = useMemo(() => {
    const roundsWithData = new Set()
    
    // Priority 1: Check roundStats first (fastest, pre-calculated by backend)
    if (cwlGroupData?.roundStats) {
      Object.keys(cwlGroupData.roundStats).forEach(roundNum => {
        const round = parseInt(roundNum)
        if (!isNaN(round) && round >= 1 && round <= 7) {
          roundsWithData.add(round)
        }
      })
    }
    
    // Priority 2: Check which rounds have data in memberSummary (any member has round data)
    // Use baseSummaryData to avoid recalculation when only sort changes
    if (baseSummaryData.length > 0) {
      baseSummaryData.forEach(memberData => {
        if (memberData.rounds) {
          Object.keys(memberData.rounds).forEach(roundNum => {
            const round = parseInt(roundNum)
            if (!isNaN(round) && round >= 1 && round <= 7) {
              roundsWithData.add(round)
            }
          })
        }
      })
    }
    
    // Priority 3: Check rounds array (for rounds in progress but no stats yet)
    // Only check if we don't have many rounds already (optimization)
    if (roundsWithData.size < 3 && cwlGroupData?.rounds && Array.isArray(cwlGroupData.rounds)) {
      cwlGroupData.rounds.forEach(round => {
        if (round.round && round.round >= 1 && round.round <= 7) {
          roundsWithData.add(round.round)
        }
      })
    }
    
    // Convert to sorted array
    return Array.from(roundsWithData).sort((a, b) => a - b)
  }, [baseSummaryData, cwlGroupData])

  // If no valid rounds found, show all rounds (fallback)
  const rounds = useMemo(() => 
    validRounds.length > 0 ? validRounds : [1, 2, 3, 4, 5, 6, 7],
    [validRounds]
  )

  // Memoize the onChange handler to prevent unnecessary re-renders
  const handleSortChange = useCallback((e) => {
    if (onSortChange) {
      onSortChange(e.target.value)
    }
  }, [onSortChange])

  // Memoize row component to prevent unnecessary re-renders
  // Only re-render if member data, index, or rounds array reference changes
  const MemberRow = memo(({ memberData, idx, rounds: roundNumbers }) => {
    const rowClasses = []
    if (memberData.hasMirrorBonusRule) {
      rowClasses.push('mirror-bonus-rule-row')
    }
    if (memberData.isBonusEligible) {
      rowClasses.push('bonus-eligible-row')
    }
    
    return (
      <tr className={rowClasses.join(' ')}>
        <td className="cwl-summary-srno-cell">
          {idx + 1}
        </td>
        <td className="cwl-summary-member-cell">
          <div className="cwl-summary-member-info">
            {thImages[memberData.member.townHallLevel || memberData.member.townhallLevel] && (
              <img
                src={thImages[memberData.member.townHallLevel || memberData.member.townhallLevel]}
                alt={`TH${memberData.member.townHallLevel || memberData.member.townhallLevel}`}
                className="cwl-summary-th-image"
              />
            )}
            <div className="cwl-summary-member-details">
              <div className="cwl-summary-member-name">
                {memberData.member.name}
                {memberData.isBonusEligible && (
                  <span className="bonus-indicator" title="Bonus Eligible">🏅</span>
                )}
              </div>
              <div className="cwl-summary-member-tag">{memberData.member.tag}</div>
            </div>
          </div>
        </td>
        {roundNumbers.map(roundNum => {
          const roundData = memberData.rounds[roundNum]
          return (
            <td key={roundNum} className="cwl-summary-round-cell">
              {roundData ? (
                <div className="cwl-summary-round-content">
                  <div className="cwl-summary-stars">{roundData.stars}⭐</div>
                  <div className="cwl-summary-destruction">{roundData.destruction.toFixed(1)}%</div>
                </div>
              ) : (
                <div className="cwl-summary-no-data">-</div>
              )}
            </td>
          )
        })}
        <td className="cwl-summary-total-cell">
          <div className="cwl-summary-total-content">
            <div className="cwl-summary-total-stars">{memberData.totals.stars}⭐</div>
            <div className="cwl-summary-total-destruction">{memberData.totals.destruction.toFixed(1)}%</div>
          </div>
        </td>
      </tr>
    )
  })

  MemberRow.displayName = 'MemberRow'

  return (
    <div className="cwl-members-summary-section">
      <div className="cwl-summary-header">
        <h3 className="cwl-summary-title">📊 CWL Members Summary</h3>
        <div className="cwl-summary-sort-control">
          <label htmlFor="cwl-sort-select">Sort by:</label>
          <select
            id="cwl-sort-select"
            value={sortBy}
            onChange={handleSortChange}
            className="cwl-summary-sort-select"
          >
            <option value="total">Total (Stars & Destruction)</option>
            {rounds.map(roundNum => (
              <option key={roundNum} value={roundNum.toString()}>
                Round {roundNum}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="cwl-summary-table-wrapper">
        <table className="cwl-summary-table">
          <thead>
            <tr>
              <th className="cwl-summary-col-srno">Sr. No</th>
              <th className="cwl-summary-col-member">Member</th>
              {rounds.map(roundNum => (
                <th key={roundNum} className="cwl-summary-col-round">
                  <div>Round {roundNum}</div>
                  <div className="cwl-summary-subheaders">
                    <span>⭐</span>
                    <span>💥</span>
                  </div>
                </th>
              ))}
              <th className="cwl-summary-col-total">
                <div>Total</div>
                <div className="cwl-summary-subheaders">
                  <span>⭐</span>
                  <span>💥</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {summaryData.map((memberData, idx) => (
              <MemberRow
                key={memberData.member.tag || idx}
                memberData={memberData}
                idx={idx}
                rounds={rounds}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
