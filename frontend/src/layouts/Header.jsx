import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import gflLogo from '/Trinity_Logo.png'

function Header() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, user, logout, isRoot, isAdmin } = useAuth()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/' || location.pathname === ''
    }
    return location.pathname.startsWith(path)
  }

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setIsMenuOpen(false)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleToggleMenu = () => setIsMenuOpen((prev) => !prev)
  const handleLinkClick = () => setIsMenuOpen(false)

  const handleLogout = () => {
    logout()
    setIsMenuOpen(false)
    navigate('/')
  }

  return (
    <header className="header">
      <nav className="nav">
        <Link to="/" className="logo">
          <img src={gflLogo} alt="GFL Logo" className="logo-image" />
          <h1 className="logo-text">GFL</h1>
        </Link>
        <button
          type="button"
          className={`nav-toggle${isMenuOpen ? ' open' : ''}`}
          onClick={handleToggleMenu}
          aria-expanded={isMenuOpen}
          aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
        >
          <span className="hamburger-bar" />
          <span className="hamburger-bar" />
          <span className="hamburger-bar" />
        </button>
        <ul className={`nav-links${isMenuOpen ? ' open' : ''}`}>
          <li><Link to="/" onClick={handleLinkClick} className={isActive('/') ? 'active' : ''}>Home</Link></li>
          {(isAdmin || isRoot) && (
            <li><Link to="/clans" onClick={handleLinkClick} className={isActive('/clans') ? 'active' : ''}>Clans</Link></li>
          )}
          {isAuthenticated ? (
            <>
              {isAdmin && (
                <li>
                  <Link to="/dashboard" onClick={handleLinkClick} className={`nav-link-dashboard ${isActive('/dashboard') ? 'active' : ''}`}>
                    Dashboard
                  </Link>
                </li>
              )}
              <li className="nav-user">
                <span className="nav-user-name">{user?.username || user?.email}</span>
              </li>
              <li>
                <button onClick={handleLogout} className="nav-button nav-button--logout">
                  Logout
                </button>
              </li>
            </>
          ) : (
            <li>
              <Link to="/login" onClick={handleLinkClick} className="nav-button nav-button--login">
                Login
              </Link>
            </li>
          )}
        </ul>
      </nav>
    </header>
  )
}

export default Header

