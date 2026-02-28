import React, { useState, useEffect } from 'react'
import SectionTitle from '../components/SectionTitle'
import { fetchBaseLayouts } from '../services/api'

function FarmingBaseLayouts() {
  const [baseLayouts, setBaseLayouts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const loadBaseLayouts = async () => {
      try {
        setLoading(true)
        setError(null)
        const layouts = await fetchBaseLayouts()
        // Sort by townHallLevel descending (highest first)
        const sortedLayouts = layouts.sort((a, b) => b.townHallLevel - a.townHallLevel)
        setBaseLayouts(sortedLayouts)
      } catch (err) {
        console.error('Error loading base layouts:', err)
        setError(err.message || 'Failed to load base layouts')
      } finally {
        setLoading(false)
      }
    }

    loadBaseLayouts()
  }, [])

  const getImageForTH = (layout) => {
    // Images are stored in public folder as /th-{level}.png (e.g., /th-17.png, /th-18.png)
    return `/th-${layout.townHallLevel}.png`
  }

  return (
    <section className="farming-page">
      <SectionTitle>Farming Base Layout Rules</SectionTitle>
      <div className="page-content">
        <p className="page-description">
          A typical farming base consists of 5 sections. Follow these rules to create an effective farming base.
        </p>

        <div className="rules-list">
          {/* TH Section */}
          <div className="rule-section">
            <h3 className="section-title">🏛️ TH Section</h3>
            <ul>
              <li><strong>TownHall</strong> (Must not overlap any other building)</li>
              <li>For <strong>TH 12 to TH 16</strong> there must be <strong>5 Tiles Gap</strong></li>
              <li>For <strong>TH 17</strong> must be <strong>6 tiles Gap</strong></li>
            </ul>
          </div>

          {/* Storage Section */}
          <div className="rule-section">
            <h3 className="section-title">💰 Storage Section</h3>
            <ul>
              <li>Eagle Artillery</li>
              <li>Air Defence</li>
              <li>Spell Towers (Must be set to <strong>Rage Mode</strong>)</li>
              <li>Air Sweeper</li>
              <li>Storages and Collectors</li>
              <li>All other Non-Defensive Buildings</li>
              <li>CC can be included (Either Storage or King Section)</li>
            </ul>
          </div>

          {/* King Section */}
          <div className="rule-section">
            <h3 className="section-title">👑 King Section</h3>
            <ul>
              <li>King Only</li>
              <li>Cannons</li>
              <li>Mortars</li>
              <li>Bomb Towers</li>
              <li>X-Bow (Must be on <strong>ground mode</strong>)</li>
              <li>CC can be included (Either Storage or King Section)</li>
              <li>Fire Spitter (Must be <strong>facing away from edge</strong>)</li>
            </ul>
          </div>

          {/* Queen Section */}
          <div className="rule-section">
            <h3 className="section-title">👸 Queen Section</h3>
            <ul>
              <li>Remaining 3 Heroes (Out of 4)</li>
              <li>Archer Towers</li>
              <li>Wizard Tower</li>
              <li>Hidden Tesla</li>
              <li>Inferno Tower (Must be on <strong>Single Target Mode</strong>)</li>
              <li>Scatter Shots</li>
              <li>Monolith</li>
              <li>Fire Spitter (Must be <strong>facing edge</strong>)</li>
              <li>Multi-Gear Tower (<strong>Long range mode</strong>)</li>
              <li>Crafting Station must be on <strong>Crusher Mode</strong> or <strong>No Defence</strong></li>
            </ul>
          </div>

          {/* Traps & Walls */}
          <div className="rule-section">
            <h3 className="section-title">🧱 Traps & Walls</h3>
            <ul>
              <li>All the walls must be placed <strong>together</strong> keeping space for traps in between.</li>
              <li>Traps must be <strong>enclosed in the walls</strong>.</li>
              <li>Skeleton traps can be on either <strong>Ground or Air</strong>.</li>
            </ul>
          </div>
        </div>

        {/* Base Layout Links */}
        <div className="base-links-section">
          <h3 className="links-title">📋 Copy Farm War Layouts</h3>
          <p className="links-description">
            The links below allow you to directly copy a farm war layout for any TH level!
          </p>
          
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <p>Loading base layouts...</p>
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#fca5a5' }}>
              <p>Error: {error}</p>
            </div>
          ) : baseLayouts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <p>No base layouts available. Please add layouts from the Dashboard.</p>
            </div>
          ) : (
            <div className="base-links-grid">
              {baseLayouts.map((layout) => {
                const imageSrc = getImageForTH(layout)
                return (
                  <a
                    key={layout.townHallLevel}
                    href={layout.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="base-link-card"
                  >
                    {imageSrc && (
                      <img 
                        src={imageSrc} 
                        alt={`TH${layout.townHallLevel}`} 
                        className="base-link-image"
                        onError={(e) => {
                          // Fallback if image fails to load
                          e.target.style.display = 'none'
                        }}
                      />
                    )}
                    <span className="base-link-th">TH{layout.townHallLevel}</span>
                  </a>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </section>
  )
}

export default FarmingBaseLayouts

