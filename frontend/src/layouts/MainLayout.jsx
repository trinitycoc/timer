import React from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'
import bgImage from '/trinity-bg.jpeg'
import trinityLogo from '/Trinity_Logo.png'

function MainLayout() {
  const location = useLocation()
  const isHome = location.pathname === '/' || location.pathname === ''

  return (
    <div className="app" style={{ '--bg-image-url': `url(${bgImage})` }}>
      <Header />
      <main className="main">
        {!isHome && (
          <div className="page-watermark" aria-hidden="true">
            <img src={trinityLogo} alt="" />
          </div>
        )}
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}

export default MainLayout

