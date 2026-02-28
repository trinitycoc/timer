import React, { useState, useEffect, useCallback } from 'react'
import { fetchCWLWarByTag } from '../../../services/api'
import { useCWLStatus, useCWLGroup, useCWLDailyWars } from '../../../hooks/useCWLData'
import { useCWLWarNames } from '../../../hooks/useCWLWarNames'
import { CWLLeaderboard } from './CWLLeaderboard'
import { CWLRoundsTable } from './CWLRoundsTable'
import { CWLWarDetails } from './CWLWarDetails'
import { CWLMembersSummary } from './CWLMembersSummary'
import { WarStatsTable } from '../wars/WarStatsTable'
import { WarMembersTable } from '../wars/WarMembersTable'

function CWLDetails({ clanTag, showDetails: showDetailsProp = false, leagueName, isAdmin = false }) {
  // Start with showAllDetails = true if showDetailsProp is true, to avoid unnecessary fetches
  const [showAllDetails, setShowAllDetails] = useState(showDetailsProp)
  const [showDetails, setShowDetails] = useState(showDetailsProp)
  const [selectedDay, setSelectedDay] = useState(null)
  const [selectedWarTag, setSelectedWarTag] = useState(null)
  const [warDetails, setWarDetails] = useState(null)
  const [loadingWar, setLoadingWar] = useState(false)
  const [warError, setWarError] = useState(null)
  const [expandedClans, setExpandedClans] = useState(new Set())

  // State for member summary sorting
  const [memberSummarySortBy, setMemberSummarySortBy] = useState('total')
  
  // Memoize sort change handler to prevent unnecessary re-renders
  const handleSortChange = useCallback((newSortBy) => {
    setMemberSummarySortBy(newSortBy)
  }, [])

  // Use custom hooks for data fetching
  const { cwlStatus, loading: loadingStatus } = useCWLStatus(clanTag)
  // Pass showAllDetails as includeAllWars: use /current endpoint when false, /all when true
  // Always fetch with 'total' sort - client-side sorting handles the rest to avoid refetch and scroll jump
  const { cwlGroupData, loading: loadingGroup } = useCWLGroup(clanTag, true, leagueName, showAllDetails, 'total')
  const { fetchedWarsForDay, fetchedWarsByRound, loading: loadingFetchedWars } = useCWLDailyWars(
    selectedDay,
    cwlGroupData,
    clanTag,
    showAllDetails // Pass showAllDetails to prevent individual fetches when using /all endpoint
  )
  const dayWarNames = useCWLWarNames(cwlGroupData, clanTag, loadingGroup, showAllDetails)

  // Update showDetails when prop changes
  useEffect(() => {
    setShowDetails(showDetailsProp)
    if (showDetailsProp) {
      setShowAllDetails(true)
    }
  }, [showDetailsProp])

  // Fetch war details when war tag is selected
  // First try to find war in already loaded data from /all endpoint
  useEffect(() => {
    if (selectedWarTag && clanTag) {
      // Check if we already have this war in loaded data
      let foundWar = null

      // Check allWars array
      if (cwlGroupData?.allWars && cwlGroupData.allWars.length > 0) {
        foundWar = cwlGroupData.allWars.find(war =>
          (war.warTag || war.tag || '').replace('#', '').toUpperCase() === selectedWarTag.replace('#', '').toUpperCase()
        )
      }

      // Check warsByRound
      if (!foundWar && cwlGroupData?.warsByRound) {
        for (const roundNum in cwlGroupData.warsByRound) {
          const roundWars = cwlGroupData.warsByRound[roundNum]
          foundWar = roundWars.find(war =>
            (war.warTag || war.tag || '').replace('#', '').toUpperCase() === selectedWarTag.replace('#', '').toUpperCase()
          )
          if (foundWar) break
        }
      }

      // Check fetchedWarsByRound
      if (!foundWar && fetchedWarsByRound) {
        for (const roundNum in fetchedWarsByRound) {
          const roundWars = fetchedWarsByRound[roundNum]
          foundWar = roundWars.find(war =>
            (war.warTag || war.tag || '').replace('#', '').toUpperCase() === selectedWarTag.replace('#', '').toUpperCase()
          )
          if (foundWar) break
        }
      }

      if (foundWar) {
        // Use war from loaded data
        setWarDetails(foundWar)
        setWarError(null)
        setLoadingWar(false)
      } else {
        // Only fetch if not found in loaded data
        const fetchWarDetails = async () => {
          setLoadingWar(true)
          setWarError(null)
          try {
            const war = await fetchCWLWarByTag(selectedWarTag, clanTag)
            setWarDetails(war)
          } catch (err) {
            console.error('Error fetching war details:', err)
            setWarError(err.message)
            setWarDetails(null)
          } finally {
            setLoadingWar(false)
          }
        }
        fetchWarDetails()
      }
    } else {
      setWarDetails(null)
      setWarError(null)
      setLoadingWar(false)
    }
  }, [selectedWarTag, clanTag, cwlGroupData, fetchedWarsByRound])

  if (loadingStatus) {
    return (
      <div className="cwl-details-section">
        <div className="cwl-details-loading cwl-loading-center">
          <div className="spinner"></div>
          <p>Loading CWL status...</p>
        </div>
      </div>
    )
  }

  if (!cwlStatus || cwlStatus.error) {
    return null
  }

  return (
    <div className="cwl-details-section">
      {showDetails && (
        <>
          {/* Full CWL Group Data */}
          {showAllDetails && (
            <>
              {loadingGroup ? (
                <div className="cwl-details-loading cwl-loading-center">
                  <div className="spinner"></div>
                  <p>Calculating CWL Stats...</p>
                </div>
              ) : cwlGroupData?.error ? (
                <div className="cwl-details-error">Error: {cwlGroupData.error}</div>
              ) : cwlGroupData ? (
                <>
                  {/* CWL Leaderboard */}
                  {cwlGroupData.group && (
                    <>
                      {/* Leaderboard Card */}
                      <div className="cwl-card-container">
                        <CWLLeaderboard
                          cwlGroupData={cwlGroupData}
                          expandedClans={expandedClans}
                          setExpandedClans={setExpandedClans}
                          leagueName={leagueName}
                        />
                      </div>

                      {/* Rounds Card */}
                      <div className="cwl-card-container">
                        <CWLRoundsTable
                          cwlGroupData={cwlGroupData}
                          clanTag={clanTag}
                          selectedDay={selectedDay}
                          setSelectedDay={setSelectedDay}
                          fetchedWarsByRound={fetchedWarsByRound}
                          fetchedWarsForDay={fetchedWarsForDay}
                          loadingFetchedWars={loadingFetchedWars}
                          isAdmin={isAdmin}
                        />
                      </div>

                      {/* CWL Members Summary */}
                      <div className="cwl-card-container">
                        <CWLMembersSummary
                          cwlGroupData={cwlGroupData}
                          clanTag={clanTag}
                          leagueName={leagueName}
                          sortBy={memberSummarySortBy}
                          onSortChange={handleSortChange}
                        />
                      </div>
                    </>
                  )}

                  {/* War Details Modal/Section */}
                  {selectedWarTag && (
                    <div className="cwl-war-details-modal">
                      <div className="cwl-war-details-header">
                        <h3>War Details: {selectedWarTag}</h3>
                        <button
                          className="cwl-close-button"
                          onClick={() => {
                            setSelectedWarTag(null)
                            setWarDetails(null)
                            setWarError(null)
                          }}
                        >
                          ✕
                        </button>
                      </div>

                      {loadingWar ? (
                        <div className="cwl-details-loading">
                          <div className="spinner"></div>
                          <p>Loading war details...</p>
                        </div>
                      ) : warError ? (
                        <div className="cwl-details-error">Error: {warError}</div>
                      ) : warDetails ? (
                        <div className="cwl-war-details-content">
                          {/* War Stats */}
                          {warDetails.clan && warDetails.opponent && (
                            <WarStatsTable clan={warDetails.clan} opponent={warDetails.opponent} />
                          )}

                          {/* Clan Members */}
                          {warDetails.clan?.members?.length > 0 && (
                            <WarMembersTable
                              members={warDetails.clan.members}
                              title="Our Clan Members"
                              opponentMembers={warDetails.opponent?.members || []}
                            />
                          )}

                          {/* Opponent Members */}
                          {warDetails.opponent?.members?.length > 0 && (
                            <WarMembersTable
                              members={warDetails.opponent.members}
                              title="Opponent Members"
                              opponentMembers={warDetails.clan?.members || []}
                            />
                          )}
                        </div>
                      ) : null}
                    </div>
                  )}
                </>
              ) : (
                <div className="cwl-details-placeholder">Click to load full CWL group data</div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

export default CWLDetails

