import React, { createContext, useContext, useState, useEffect } from 'react'
import { getCurrentUser, login as loginAPI, register as registerAPI, logout as logoutAPI } from '../services/api'

const AuthContext = createContext(null)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Check if user is authenticated on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('auth_token')
        if (token) {
          const currentUser = await getCurrentUser()
          setUser(currentUser)
        }
      } catch (err) {
        // Token invalid or expired, clear it
        localStorage.removeItem('auth_token')
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [])

  const login = async (email, password) => {
    try {
      setError(null)
      const data = await loginAPI(email, password)
      setUser(data.user)
      return data
    } catch (err) {
      setError(err.message || 'Login failed')
      throw err
    }
  }

  const register = async (email, password, username) => {
    try {
      setError(null)
      const data = await registerAPI(email, password, username)
      setUser(data.user)
      return data
    } catch (err) {
      setError(err.message || 'Registration failed')
      throw err
    }
  }

  const logout = () => {
    logoutAPI()
    setUser(null)
    setError(null)
  }

  const isAuthenticated = !!user
  const isAdmin = user && (user.role === 'admin' || user.role === 'root' || user.isRoot)
  const isRoot = user && (user.role === 'root' || user.isRoot)

  const value = {
    user,
    loading,
    error,
    login,
    isRoot,
    register,
    logout,
    isAuthenticated,
    isAdmin,
    setError
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

