import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import trinityLogo from '/Trinity_Logo.png'
import SectionTitle from '../components/SectionTitle'
import { fetchClan } from '../services/api'
import useTrinityClansPreview from '../hooks/useTrinityClansPreview'

function Home() {
  const [clanTag, setClanTag] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState(null)
  const navigate = useNavigate()
  const {
    clanCount,
    clans: homeClans,
    loading: loadingClans,
    error: clansError,
  } = useTrinityClansPreview(4)

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
          <h2 className="hero-title">Welcome to Trinity</h2>
          <p className="hero-subtitle">
            Join the Trinity family - A community of Clash of Clans players united by passion and excellence
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
            src={trinityLogo}
            alt="Trinity emblem"
            className="hero-bubble-logo"
            loading="lazy"
          />
        </div>
      </section>

      <section className="home-about about">
        <SectionTitle>About Trinity</SectionTitle>

        <div className="about-features">
          <div className="about-card">
            <div className="card-icon">👥</div>
            <h4>{clanCount || '0'} Clans</h4>
            <p>A diverse family of clans welcoming players of all skill levels and Town Hall tiers.</p>
          </div>

          <div className="about-card">
            <div className="card-icon">🌍</div>
            <h4>GFL Member</h4>
            <p>Proud member of the Global Farming League (GFL), competing at the highest level.</p>
          </div>

          <div className="about-card">
            <div className="card-icon">⚔️</div>
            <h4>50 vs 50 Wars</h4>
            <p>Regular large-scale wars bringing our entire community together for epic battles.</p>
          </div>

          <div className="about-card">
            <div className="card-icon">🏆</div>
            <h4>CWL Organization</h4>
            <p>Organized CWL in satellite clans, offering high leagues for competitive and casual players.</p>
          </div>
        </div>

        <div className="home-section-footer">
          <Link to="/about" className="home-outline-button">
            Know More
          </Link>
        </div>
      </section>

      <section className="home-clans">
        <SectionTitle>Trinity Family Clans</SectionTitle>

        {loadingClans ? (
          <p className="home-clans-loading">Loading clans...</p>
        ) : clansError ? (
          <p className="home-clans-error">{clansError}</p>
        ) : (
          <div className="home-clans-grid">
            {homeClans.map((clan) => (
              <div key={clan.tag} className="home-clan-card">
                <div className="home-clan-badge">
                  <img
                    src={clan.badgeUrls?.medium || clan.badgeUrls?.small || trinityLogo}
                    alt={`${clan.name} badge`}
                    loading="lazy"
                  />
                </div>
                <p className="home-clan-name">{clan.name}</p>
              </div>
            ))}
          </div>
        )}
        <div className="home-section-footer">
          <Link to="/clans" className="home-outline-button">
            Explore Trinity Clans
          </Link>
        </div>
      </section>

      <section className="home-partner">
        <div className="partner-banner">
          <div className="partner-content">
            <div className="partner-icon">🗺️</div>
            <div className="partner-text">
              <h3 className="partner-title">Explore the Clash of Clans World</h3>
              <p className="partner-description">
                Discover ClashAtlas - Your comprehensive guide to Clash of Clans
              </p>
            </div>
            <a
              href="https://clashatlas.vercel.app/"
              className="partner-button"
              target="_blank"
              rel="noopener noreferrer"
            >
              Visit ClashAtlas
            </a>
          </div>
        </div>
      </section>
    </>
  )
}

export default Home

