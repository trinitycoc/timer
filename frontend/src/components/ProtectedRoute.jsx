import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

/**
 * ProtectedRoute component - redirects to login if not authenticated
 * Optionally requires admin role
 */
function ProtectedRoute({ children, requireAdmin = false, requireRoot = false }) {
  const { isAuthenticated, isAdmin, isRoot, loading } = useAuth()

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />
  }

  if (requireRoot && !isRoot) {
    return <Navigate to="/" replace />
  }

  return children
}

export default ProtectedRoute

