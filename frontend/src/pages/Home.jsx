import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import gflLogo from '/Trinity_Logo.png'
import { fetchClan } from '../services/api'

function Home() {
  const [clanTag, setClanTag] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState(null)
  const navigate = useNavigate()

  const normalizeTag = (tag) => tag.trim().toUpperCase().replace(/^#+/, '')

  const handleSearch = async () => {
    if (!clanTag.trim() || isSearching) return

    const normalizedTag = normalizeTag(clanTag)

    if (!normalizedTag) return

    try {
      setIsSearching(true)
      setSearchError(null)
      await fetchClan(normalizedTag).catch((err) => {
        // If the fetch fails we'll still navigate, but surface the error
        setSearchError(err.message || 'Unable to fetch clan data.')
      })
      navigate(`/clans/${normalizedTag}`)
    } finally {
      setIsSearching(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSearch()
    }
  }

  return (
    <>
      <section className="hero">
        <div className="hero-content">
          <h2 className="hero-title">Welcome to GFL</h2>
          <p className="hero-subtitle">
            Join the GFL family - A community of Clash of Clans players united by passion and excellence
          </p>
          <div className="hero-search">
            <input
              type="text"
              className="clan-search-input"
              placeholder="Enter clan tag (e.g., #J9UGCPR2)"
              value={clanTag}
              onChange={(e) => setClanTag(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              className="clan-search-button"
              onClick={handleSearch}
              disabled={!clanTag.trim() || isSearching}
            >
              {isSearching ? 'Searching…' : 'Search'}
            </button>
          </div>
          {searchError && (
            <p className="search-error" role="alert">
              {searchError}
            </p>
          )}
        </div>
        <div className="hero-image">
          <div className="geometric-shape"></div>
          <img
            src={gflLogo}
            alt="GFL emblem"
            className="hero-bubble-logo"
            loading="lazy"
          />
        </div>
      </section>
    </>
  )
}

export default Home

