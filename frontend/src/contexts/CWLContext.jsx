import React, { createContext, useContext, useState, useEffect } from 'react'
import { fetchCWLClansFromSheet } from '../services/api'

const CWLContext = createContext()

export const useCWL = () => {
  const context = useContext(CWLContext)
  if (!context) {
    throw new Error('useCWL must be used within a CWLProvider')
  }
  return context
}

export const CWLProvider = ({ children }) => {
  const [cwlClanTags, setCwlClanTags] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchCWLTags = async () => {
      try {
        setLoading(true)
        const tags = await fetchCWLClansFromSheet()
        setCwlClanTags(tags)
        setError(null)
      } catch (err) {
        console.error('Error fetching CWL clan tags:', err)
        setError(err.message)
        // Set empty array on error so app can still function
        setCwlClanTags([])
      } finally {
        setLoading(false)
      }
    }

    fetchCWLTags()
  }, [])

  const isCWLClan = (clanTag) => {
    return cwlClanTags.includes(clanTag)
  }

  const value = {
    cwlClanTags,
    loading,
    error,
    isCWLClan
  }

  return <CWLContext.Provider value={value}>{children}</CWLContext.Provider>
}

