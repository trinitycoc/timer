import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import SectionTitle from '../components/SectionTitle'

function Features() {
  const [activeFeature, setActiveFeature] = useState(null)
  useEffect(() => {
    if (activeFeature) {
      const previousOverflow = document.body.style.overflow
      const previousPaddingRight = document.body.style.paddingRight
      const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth

      document.body.style.overflow = 'hidden'
      if (scrollBarWidth > 0) {
        document.body.style.paddingRight = `${scrollBarWidth}px`
      }

      const handleKeyDown = (event) => {
        if (event.key === 'Escape') {
          setActiveFeature(null)
        }
      }

      window.addEventListener('keydown', handleKeyDown)

      return () => {
        document.body.style.overflow = previousOverflow
        document.body.style.paddingRight = previousPaddingRight
        window.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [activeFeature])

  const features = [
    {
      icon: '🏆',
      title: 'CWL Tracking & Analysis',
      description: 'Comprehensive CWL (Clan War League) tracking and analysis for all Trinity clans.',
      details: [
        'View detailed CWL leaderboard with clan rankings, stars, and destruction',
        'Track round-by-round performance across all 7 CWL rounds',
        'See detailed war statistics for each round',
        'Monitor promotion and demotion zones',
        'View CWL medals and rewards per league',
        'Access real-time CWL status and group information'
      ], 
    },
    {
      icon: '🎯',
      title: 'Mirror Bonus Rule Tracking',
      description: 'Advanced tracking system for mirror bonus rule compliance in CWL.',
      details: [
        'Automatic detection of mirror attacks (attacking your corresponding position)',
        'Track mirror bonus rule compliance per round',
        'Highlight members who followed the mirror bonus rule in all rounds',
        'Consider attack order in mutual mirror attacks for bonus eligibility',
        'Visual indicators (green highlighting) for compliant members',
        'Round-by-round compliance tracking'
      ],
    },
    {
      icon: '🏅',
      title: 'Bonus Eligibility System',
      description: 'Automated bonus eligibility calculation based on performance and mirror bonus rule compliance.',
      details: [
        'Calculate total bonuses available (base bonuses + wins)',
        'Only members who followed mirror bonus rule are eligible',
        'Top performers among eligible members get bonuses',
        'Visual indicators (golden highlighting & medal icon) for bonus-eligible members',
        'Automatic sorting by stars and destruction',
        'Real-time bonus eligibility updates'
      ],
    },
    {
      icon: '👥',
      title: 'Clan Details & Analytics',
      description: 'Comprehensive clan information and detailed analytics for all Trinity clans.',
      details: [
        'View complete clan information and member lists',
        'Track current wars and war history',
        'See town hall composition and member statistics',
        'Access war logs and performance metrics',
        'View clan badges and detailed member profiles',
        'Search clans by tag or name'
      ],
    },
    {
      icon: '⚔️',
      title: 'War Statistics',
      description: 'Detailed war statistics and member performance tracking.',
      details: [
        'View attack summary for each member',
        'Track stars and destruction per attack',
        'See opponent information and war details',
        'Monitor war performance across rounds',
        'Access historical war data',
        'Compare performance between clans'
      ],
    },
    {
      icon: '📊',
      title: 'CWL Members Summary',
      description: 'Comprehensive summary of all member performance across the entire CWL season.',
      details: [
        'Round-by-round performance breakdown',
        'Total stars and destruction per member',
        'Attack count tracking',
        'Mirror bonus rule compliance indicators',
        'Bonus eligibility markers',
        'Sorted by performance (stars, then destruction)'
      ],
    },
    {
      icon: '🏗️',
      title: 'Farming Base Layouts',
      description: 'Collection of farming base layouts for efficient resource protection.',
      details: [
        'Browse various farming base designs',
        'Suitable for different town hall levels',
        'Optimized for resource protection',
        'Easy-to-follow layout guides'
      ],
    },
    {
      icon: '🔍',
      title: 'Clan Search',
      description: 'Quick and easy clan search functionality.',
      details: [
        'Search clans by tag or name',
        'Instant navigation to clan details',
        'Support for clan tag with or without #',
        'Direct access to clan analytics'
      ],
    },
    // {
    //   icon: '📱',
    //   title: 'Responsive Design',
    //   description: 'Fully responsive website that works on all devices.',
    //   details: [
    //     'Optimized for desktop, tablet, and mobile',
    //     'Smooth navigation and user experience',
    //     'Fast loading times',
    //     'Modern and intuitive interface'
    //   ]
    // },
    {
      icon: '⚡',
      title: 'Real-Time Updates',
      description: 'Get real-time updates on wars, CWL, and clan activities.',
      details: [
        'Live war status updates',
        'Real-time CWL tracking',
        'Current war information',
        'Instant data refresh'
      ]
    },
    {
      icon: '🎨',
      title: 'Visual Indicators',
      description: 'Color-coded visual indicators for easy identification.',
      details: [
        'Green highlighting for mirror bonus rule compliance',
        'Golden highlighting for bonus-eligible members',
        'Gradient highlighting for members with both',
        'Promotion/demotion zone indicators',
        'Animated badges and icons'
      ]
    },
    {
      icon: '🔐',
      title: 'Admin Mode',
      description: 'Advanced admin features for detailed war analysis.',
      details: [
        'View detailed war events and attack order',
        'Advanced mirror bonus rule analysis',
        'Chronological attack tracking',
        'Enhanced war statistics',
        'Access to detailed attack logs'
      ]
    }
  ]

  return (
    <section className="features">
      <SectionTitle>Features</SectionTitle>

      <div className="features-grid">
        {features.map((feature, index) => (
          <button
            key={index}
            className="feature-card"
            onClick={() => setActiveFeature(feature)}
            type="button"
          >
            <div className="feature-icon">{feature.icon}</div>
            <h4 className="feature-title">{feature.title}</h4>
          </button>
        ))}
      </div>

      {activeFeature && (
        <div className="feature-modal" role="dialog" aria-modal="true">
          <div className="feature-modal-content">
            <button
              className="feature-modal-close"
              onClick={() => setActiveFeature(null)}
              aria-label="Close"
              type="button"
            >
              ✕
            </button>
            <h3 className="feature-modal-title">{activeFeature.title}</h3>
            <p className="feature-modal-description">{activeFeature.description}</p>
            <h5>Key Features:</h5>
            <ul>
              {activeFeature.details.map((detail, idx) => (
                <li key={idx}>{detail}</li>
              ))}
            </ul>
          </div>
          <div className="feature-modal-backdrop" onClick={() => setActiveFeature(null)}></div>
        </div>
      )}

    </section>
  )
}

export default Features

