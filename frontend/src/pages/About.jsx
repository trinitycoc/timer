import React from 'react'
import { Link } from 'react-router-dom'
import SectionTitle from '../components/SectionTitle'
import useTrinityClansPreview from '../hooks/useTrinityClansPreview'

function About() {
  const { clanCount, loading } = useTrinityClansPreview(0)
  const clanCountLabel = loading ? '...' : clanCount

  return (
    <section className="about">
      <SectionTitle>About Trinity</SectionTitle>

      <div className="about-hero">
        <div className="about-intro">
          {/* <h3>Trinity Family of Clans</h3> */}
          <p>
            Led by Hell Raiser, Trinity is a thriving community of {clanCountLabel} clans united by passion,
            strategy, and excellence.
          </p>
        </div>
      </div>

      <div className="about-description">
        <p>
          Trinity is more than a collection of clans—we're a collaborative family focused on growth,
          mentorship, and delivering a premium Clash of Clans experience. From structured CWL play to
          automated tools that keep every member engaged, Trinity continues to evolve with the needs of
          our community.
        </p>
        <p>
          Below you'll find a deeper look at the perks, culture, and systems that make Trinity one of the
          most organized and supportive clans in the game.
        </p>
      </div>

      <div className="about-perks">
        <h3 className="perks-title">Why Join Trinity?</h3>
        <div className="perks-grid">
          <div className="perk-item">
            <div className="perk-icon">🎯</div>
            <h5>Max Clan Games</h5>
            <p>Always reach maximum rewards every clan games event</p>
          </div>

          <div className="perk-item">
            <div className="perk-icon">💰</div>
            <h5>1500+ Capital Medals</h5>
            <p>High capital raid medals every weekend for all members</p>
          </div>

          <div className="perk-item">
            <div className="perk-icon">🤝</div>
            <h5>Friendly Behaviour</h5>
            <p>Welcoming and supportive community atmosphere</p>
          </div>

          <div className="perk-item">
            <div className="perk-icon">🗣️</div>
            <h5>English Chat</h5>
            <p>Clear communication in English across all clans</p>
          </div>

          <div className="perk-item">
            <div className="perk-icon">🏅</div>
            <h5>High CWL Leagues</h5>
            <p>Competitive CWL clans in top leagues</p>
          </div>

          <div className="perk-item">
            <div className="perk-icon">🎮</div>
            <h5>Active Community</h5>
            <p>Engaged players and regular clan activities</p>
          </div>

          <div className="perk-item">
            <div className="perk-icon">🤖</div>
            <h5>Discord Bot</h5>
            <p>Track attacks, donations, and clan stats with our Discord bot</p>
          </div>

          <div className="perk-item">
            <div className="perk-icon">📲</div>
            <h5>WhatsApp Bot</h5>
            <p>Get updates and manage clan activities through WhatsApp</p>
          </div>

          <div className="perk-item">
            <div className="perk-icon">⏰</div>
            <h5>War Reminders</h5>
            <p>Automated reminders to never miss your attacks</p>
          </div>
        </div>
      </div>

      <div className="about-cta">
        <p>
          Explore our clans in the{' '}
          <Link to="/clans">
            <strong>Clans</strong>
          </Link>{' '}
          section and find CWL opportunities in the{' '}
          <Link to="/cwl">
            <strong>CWL</strong>
          </Link>{' '}
          section.
        </p>
      </div>
    </section>
  )
}

export default About

