import React, { useState, useEffect } from 'react'
import SectionTitle from '../components/SectionTitle'
import { useAuth } from '../contexts/AuthContext'
import {
  getTrinityClans,
  createTrinityClan,
  updateTrinityClan,
  deleteTrinityClan,
  getCWLClans,
  createCWLClan,
  updateCWLClan,
  deleteCWLClan,
  getBaseLayouts,
  createBaseLayout,
  updateBaseLayout,
  deleteBaseLayout,
  fetchClan,
  clearClanCache,
  getAllUsers,
  updateUser,
  deleteUser
} from '../services/api'

function Dashboard() {
  const { isRoot, isAdmin, user } = useAuth()
  // Admin users default to 'layouts' tab, root users default to 'trinity'
  const [activeTab, setActiveTab] = useState('layouts')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  
  // Set initial tab based on user role once user is loaded
  useEffect(() => {
    // Root users default to 'trinity' tab, admin users stay on 'layouts' (where they have edit access)
    if (user && isRoot && activeTab === 'layouts') {
      setActiveTab('trinity')
    }
  }, [user, isRoot])

  // Trinity clans state
  const [trinityClans, setTrinityClans] = useState([])
  const [trinityForm, setTrinityForm] = useState({ tag: '', status: 'Active', name: '' })
  const [editingTrinity, setEditingTrinity] = useState(null)
  const [fetchingTrinityClanName, setFetchingTrinityClanName] = useState(false)

  // CWL clans state
  const [cwlClans, setCwlClans] = useState([])
  const [cwlForm, setCwlForm] = useState({
    tag: '',
    inUse: '',
    format: '',
    members: '',
    townHall: [],
    weight: '',
    league: '',
    name: '',
    status: 'Active'
  })
  const [editingCwl, setEditingCwl] = useState(null)
  const [fetchingClanName, setFetchingClanName] = useState(false)

  // Format and members options
  const formatOptions = ['lazy', 'competitive']
  const membersOptions = ['5', '15', '30']

  // Town Hall levels (TH1 to TH18)
  const townHallLevels = Array.from({ length: 18 }, (_, i) => i + 1)

  // Base layouts state
  const [baseLayouts, setBaseLayouts] = useState([])
  const [layoutForm, setLayoutForm] = useState({ townHallLevel: '', link: '' })
  const [editingLayout, setEditingLayout] = useState(null)

  // Users state (only for root users)
  const [users, setUsers] = useState([])
  const [editingUserRole, setEditingUserRole] = useState({})

  useEffect(() => {
    // If admin user tries to access users tab, redirect to layouts
    if (!isRoot && activeTab === 'users') {
      setActiveTab('layouts')
    } else {
      loadData()
    }
  }, [activeTab, isRoot])

  // Auto-fetch clan name and league when tag is entered for CWL clans (only for new entries, not when editing)
  useEffect(() => {
    const fetchClanData = async () => {
      // Only fetch if we're not editing and tag is valid
      if (editingCwl || !cwlForm.tag || cwlForm.tag.length < 3) {
        return
      }

      const normalizedTag = cwlForm.tag.startsWith('#') ? cwlForm.tag : `#${cwlForm.tag}`

      // Only fetch if tag looks valid (at least 3 characters after #)
      if (normalizedTag.length < 4) {
        return
      }

      setFetchingClanName(true)
      try {
        const clanData = await fetchClan(normalizedTag)
        if (clanData) {
          const updates = {}
          
          // Fetch clan name
          if (clanData.name) {
            updates.name = clanData.name
          }
          
          // League parsing is now handled by backend when creating/updating CWL clans
          // Frontend no longer needs to parse it - backend will auto-fetch and parse if league is empty
          
          if (Object.keys(updates).length > 0) {
            setCwlForm(prev => ({ ...prev, ...updates }))
          }
        }
      } catch (err) {
        // Silently fail - clan data is optional
        console.warn('Could not fetch clan data:', err.message)
      } finally {
        setFetchingClanName(false)
      }
    }

    // Debounce the API call
    const timeoutId = setTimeout(() => {
      fetchClanData()
    }, 500) // Wait 500ms after user stops typing

    return () => clearTimeout(timeoutId)
  }, [cwlForm.tag, editingCwl])

  // Auto-fetch clan name when tag is entered for Trinity clans (only for new entries, not when editing)
  useEffect(() => {
    const fetchTrinityClanName = async () => {
      // Only fetch if we're not editing and tag is valid
      if (editingTrinity || !trinityForm.tag || trinityForm.tag.length < 3) {
        return
      }

      const normalizedTag = trinityForm.tag.startsWith('#') ? trinityForm.tag : `#${trinityForm.tag}`

      // Only fetch if tag looks valid (at least 3 characters after #)
      if (normalizedTag.length < 4) {
        return
      }

      setFetchingTrinityClanName(true)
      try {
        const clanData = await fetchClan(normalizedTag)
        if (clanData && clanData.name) {
          setTrinityForm(prev => ({ ...prev, name: clanData.name }))
        }
      } catch (err) {
        // Silently fail - clan name is optional
        console.warn('Could not fetch clan name:', err.message)
      } finally {
        setFetchingTrinityClanName(false)
      }
    }

    // Debounce the API call
    const timeoutId = setTimeout(() => {
      fetchTrinityClanName()
    }, 500) // Wait 500ms after user stops typing

    return () => clearTimeout(timeoutId)
  }, [trinityForm.tag, editingTrinity])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      if (activeTab === 'trinity' && isAdmin) {
        const clans = await getTrinityClans()
        setTrinityClans(clans)
      } else if (activeTab === 'cwl' && isAdmin) {
        const clans = await getCWLClans()
        setCwlClans(clans)
      } else if (activeTab === 'layouts') {
        const layouts = await getBaseLayouts()
        setBaseLayouts(layouts)
      } else if (activeTab === 'users' && isRoot) {
        const usersList = await getAllUsers()
        setUsers(usersList)
      }
    } catch (err) {
      setError(err.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const showSuccess = (message) => {
    setSuccess(message)
    setTimeout(() => setSuccess(null), 3000)
  }

  const showError = (message) => {
    setError(message)
    setTimeout(() => setError(null), 5000)
  }

  // Trinity clans handlers
  const handleTrinitySubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      if (editingTrinity) {
        await updateTrinityClan(editingTrinity.tag, trinityForm)
        showSuccess('Trinity clan updated successfully')
      } else {
        await createTrinityClan(trinityForm)
        showSuccess('Trinity clan created successfully')
      }
      // Clear frontend cache to ensure UI reflects changes immediately
      clearClanCache()
      setTrinityForm({ tag: '', status: 'Active', name: '' })
      setEditingTrinity(null)
      await loadData()
    } catch (err) {
      showError(err.message || 'Failed to save Trinity clan')
    } finally {
      setLoading(false)
    }
  }

  const handleTrinityEdit = (clan) => {
    setEditingTrinity(clan)
    setTrinityForm({ tag: clan.tag, status: clan.status, name: clan.name || '' })
  }

  const handleTrinityDelete = async (tag) => {
    if (!window.confirm(`Are you sure you want to delete clan ${tag}?`)) return
    setLoading(true)
    try {
      await deleteTrinityClan(tag)
      // Clear frontend cache to ensure UI reflects changes immediately
      clearClanCache()
      showSuccess('Trinity clan deleted successfully')
      await loadData()
    } catch (err) {
      showError(err.message || 'Failed to delete Trinity clan')
    } finally {
      setLoading(false)
    }
  }

  // CWL clans handlers
  const handleCwlSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      // Backend will handle normalization of tag, townHall array->string, and weight
      // We can send townHall as array and backend will normalize it
      const formData = {
        ...cwlForm,
        tag: cwlForm.tag, // Backend will normalize tag (add # if missing)
        name: cwlForm.name || '', // Backend will auto-fetch if empty
        townHall: cwlForm.townHall // Backend will normalize array to string
        // Backend will also normalize weight (strip non-digits)
      }

      if (editingCwl) {
        await updateCWLClan(editingCwl.tag, formData)
        showSuccess('CWL clan updated successfully')
      } else {
        await createCWLClan(formData)
        showSuccess('CWL clan created successfully')
      }
      // Clear frontend cache to ensure UI reflects changes immediately
      clearClanCache()
      setCwlForm({
        tag: '',
        inUse: '',
        format: '',
        members: '',
        townHall: [],
        weight: '',
        league: '',
        name: '',
        status: 'Active'
      })
      setEditingCwl(null)
      await loadData()
    } catch (err) {
      showError(err.message || 'Failed to save CWL clan')
    } finally {
      setLoading(false)
    }
  }

  const handleCwlEdit = (clan) => {
    setEditingCwl(clan)
    // Parse townHall if it's a string (comma-separated) or array
    let townHallArray = []
    if (clan.townHall) {
      if (Array.isArray(clan.townHall)) {
        townHallArray = clan.townHall
      } else if (typeof clan.townHall === 'string') {
        // Parse "TH17, TH16" or "17, 16" format
        townHallArray = clan.townHall
          .split(',')
          .map(th => {
            const match = th.trim().match(/TH?(\d+)/i)
            return match ? parseInt(match[1]) : null
          })
          .filter(th => th !== null && th >= 1 && th <= 18)
      }
    }

    // Weight is stored as-is in database
    const weightValue = clan.weight ? clan.weight.toString() : ''

    setCwlForm({
      tag: clan.tag,
      inUse: clan.inUse.toString(),
      format: clan.format || '',
      members: clan.members || '',
      townHall: townHallArray,
      weight: weightValue,
      league: clan.league || '',
      name: clan.name || '',
      status: clan.status || 'Active'
    })
  }

  const handleCwlDelete = async (tag) => {
    if (!window.confirm(`Are you sure you want to delete CWL clan ${tag}?`)) return
    setLoading(true)
    try {
      await deleteCWLClan(tag)
      // Clear frontend cache to ensure UI reflects changes immediately
      clearClanCache()
      showSuccess('CWL clan deleted successfully')
      await loadData()
    } catch (err) {
      showError(err.message || 'Failed to delete CWL clan')
    } finally {
      setLoading(false)
    }
  }

  // Base layouts handlers
  const handleLayoutSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      if (editingLayout) {
        await updateBaseLayout(editingLayout.townHallLevel, layoutForm)
        showSuccess('Base layout updated successfully')
      } else {
        await createBaseLayout(layoutForm)
        showSuccess('Base layout created successfully')
      }
      setLayoutForm({ townHallLevel: '', link: '' })
      setEditingLayout(null)
      await loadData()
    } catch (err) {
      showError(err.message || 'Failed to save base layout')
    } finally {
      setLoading(false)
    }
  }

  const handleLayoutEdit = (layout) => {
    setEditingLayout(layout)
    setLayoutForm({
      townHallLevel: layout.townHallLevel.toString(),
      link: layout.link || ''
    })
  }

  const handleLayoutDelete = async (townHallLevel) => {
    if (!window.confirm(`Are you sure you want to delete base layout for TH${townHallLevel}?`)) return
    setLoading(true)
    try {
      await deleteBaseLayout(townHallLevel)
      showSuccess('Base layout deleted successfully')
      await loadData()
    } catch (err) {
      showError(err.message || 'Failed to delete base layout')
    } finally {
      setLoading(false)
    }
  }

  // Users handlers (only for root users)
  const handleRoleChange = async (userId, newRole) => {
    if (!isRoot) return
    
    setLoading(true)
    setError(null)
    try {
      await updateUser(userId, { role: newRole })
      showSuccess('User role updated successfully')
      await loadData()
      setEditingUserRole({})
    } catch (err) {
      setError(err.message || 'Failed to update user role')
    } finally {
      setLoading(false)
    }
  }

  const handleUserDelete = async (userId, userEmail) => {
    if (!isRoot) return
    if (!window.confirm(`Are you sure you want to delete user ${userEmail}?`)) return
    setLoading(true)
    try {
      await deleteUser(userId)
      showSuccess('User deleted successfully')
      await loadData()
    } catch (err) {
      setError(err.message || 'Failed to delete user')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="dashboard">
      <SectionTitle>Admin Dashboard</SectionTitle>

      {error && (
        <div className="dashboard-message dashboard-message--error">
          {error}
        </div>
      )}

      {success && (
        <div className="dashboard-message dashboard-message--success">
          {success}
        </div>
      )}

      <div className="dashboard-tabs">
        {isAdmin && (
          <>
            <button
              className={`dashboard-tab ${activeTab === 'trinity' ? 'active' : ''}`}
              onClick={() => setActiveTab('trinity')}
            >
              Trinity Clans
            </button>
            <button
              className={`dashboard-tab ${activeTab === 'cwl' ? 'active' : ''}`}
              onClick={() => setActiveTab('cwl')}
            >
              CWL Clans
            </button>
          </>
        )}
        <button
          className={`dashboard-tab ${activeTab === 'layouts' ? 'active' : ''}`}
          onClick={() => setActiveTab('layouts')}
        >
          Base Layouts
        </button>
        {isRoot && (
          <button
            className={`dashboard-tab ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            Users
          </button>
        )}
      </div>

      <div className="dashboard-content">
        {loading && activeTab === 'trinity' && <div className="dashboard-loading">Loading...</div>}

        {activeTab === 'trinity' && isAdmin && (
          <div className="dashboard-section">
            {isRoot && (
              <>
                <h3 className="dashboard-section-title">
                  {editingTrinity ? 'Edit Trinity Clan' : 'Add New Trinity Clan'}
                </h3>
                <form onSubmit={handleTrinitySubmit} className="dashboard-form">
              <div className="dashboard-form-row dashboard-form-row--equal">
                <div className="dashboard-form-group">
                  <label>Clan Tag</label>
                  <div style={{ position: 'relative', width: '100%' }}>
                    <input
                      type="text"
                      value={trinityForm.tag}
                      onChange={(e) => setTrinityForm({ ...trinityForm, tag: e.target.value, name: '' })}
                      placeholder="#CLANTAG"
                      required
                      disabled={!!editingTrinity}
                      style={{ width: '100%' }}
                    />
                    {fetchingTrinityClanName && (
                      <small className="dashboard-hint" style={{ position: 'absolute', bottom: '-20px', left: 0 }}>
                        Fetching clan name...
                      </small>
                    )}
                  </div>
                </div>
                <div className="dashboard-form-group">
                  <label>Clan Name</label>
                  <input
                    type="text"
                    value={trinityForm.name || ''}
                    onChange={(e) => setTrinityForm({ ...trinityForm, name: e.target.value })}
                    placeholder="Clan name will be fetched automatically"
                    readOnly={!editingTrinity && fetchingTrinityClanName}
                    style={{
                      backgroundColor: !editingTrinity && fetchingTrinityClanName ? 'rgba(255, 255, 255, 0.05)' : undefined,
                      color: trinityForm.name ? 'rgba(34, 197, 94, 0.9)' : undefined
                    }}
                  />
                </div>
              </div>
              <div className="dashboard-form-group">
                <label>Status</label>
                <select
                  value={trinityForm.status}
                  onChange={(e) => setTrinityForm({ ...trinityForm, status: e.target.value })}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div className="dashboard-form-actions">
                <button type="submit" disabled={loading}>
                  {editingTrinity ? 'Update' : 'Create'}
                </button>
                {editingTrinity && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTrinity(null)
                      setTrinityForm({ tag: '', status: 'Active', name: '' })
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
              </>
            )}

            <h3 className="dashboard-section-title">Trinity Clans ({trinityClans.length})</h3>
            <div className="dashboard-table-container">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Sr. No.</th>
                    <th>Tag</th>
                    <th>Clan Name</th>
                    <th>Status</th>
                    {isRoot && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {trinityClans.map((clan, index) => (
                    <tr key={clan.tag}>
                      <td>{index + 1}</td>
                      <td>{clan.tag}</td>
                      <td>{clan.name || '-'}</td>
                      <td>{clan.status}</td>
                      {isRoot && (
                        <td>
                          <button
                            onClick={() => handleTrinityEdit(clan)}
                            className="dashboard-btn dashboard-btn--edit"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleTrinityDelete(clan.tag)}
                            className="dashboard-btn dashboard-btn--delete"
                          >
                            Delete
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {loading && activeTab === 'cwl' && <div className="dashboard-loading">Loading...</div>}

        {activeTab === 'cwl' && isAdmin && (
          <div className="dashboard-section">
            {isRoot && (
              <>
                <h3 className="dashboard-section-title">
                  {editingCwl ? 'Edit CWL Clan' : 'Add New CWL Clan'}
                </h3>
                <form onSubmit={handleCwlSubmit} className="dashboard-form">
              <div className="dashboard-form-row">
                <div className="dashboard-form-group">
                  <label>Clan Tag</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      value={cwlForm.tag}
                      onChange={(e) => setCwlForm({ ...cwlForm, tag: e.target.value, name: '', league: '' })}
                      placeholder="#CLANTAG"
                      required
                      disabled={!!editingCwl}
                    />
                    {fetchingClanName && (
                      <small className="dashboard-hint" style={{ position: 'absolute', bottom: '-20px', left: 0 }}>
                        Fetching clan name...
                      </small>
                    )}
                    {cwlForm.name && !fetchingClanName && (
                      <small className="dashboard-hint" style={{ position: 'absolute', bottom: '-20px', left: 0, color: 'rgba(34, 197, 94, 0.8)' }}>
                        Clan: {cwlForm.name}
                      </small>
                    )}
                  </div>
                </div>
                <div className="dashboard-form-group">
                  <label>In Use</label>
                  <input
                    type="number"
                    value={cwlForm.inUse}
                    onChange={(e) => setCwlForm({ ...cwlForm, inUse: e.target.value })}
                    placeholder="1"
                    required
                  />
                </div>
              </div>
              <div className="dashboard-form-row">
                <div className="dashboard-form-group">
                  <label>
                    League 
                    {cwlForm.league && !editingCwl && (
                      <span style={{ fontSize: '0.75rem', color: 'rgba(34, 197, 94, 0.8)', fontStyle: 'italic' }}>
                        {' '}(Auto-filled from API)
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={cwlForm.league || ''}
                    onChange={(e) => setCwlForm({ ...cwlForm, league: e.target.value })}
                    placeholder={editingCwl ? "Enter league manually (e.g., Master 1, Unranked)" : "League will be fetched automatically from API"}
                    readOnly={!editingCwl}
                    disabled={!editingCwl}
                    style={{
                      backgroundColor: !editingCwl ? 'rgba(16, 24, 46, 0.4)' : undefined,
                      color: cwlForm.league && !editingCwl ? 'rgba(34, 197, 94, 0.9)' : undefined,
                      cursor: !editingCwl ? 'not-allowed' : undefined
                    }}
                  />
                </div>
              </div>
              <div className="dashboard-form-row">
                <div className="dashboard-form-group">
                  <label>Format</label>
                  <select
                    value={cwlForm.format}
                    onChange={(e) => setCwlForm({ ...cwlForm, format: e.target.value })}
                  >
                    <option value="">Select Format</option>
                    {formatOptions.map(format => (
                      <option key={format} value={format}>{format.charAt(0).toUpperCase() + format.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div className="dashboard-form-group">
                  <label>Allowed Members</label>
                  <select
                    value={cwlForm.members}
                    onChange={(e) => setCwlForm({ ...cwlForm, members: e.target.value })}
                  >
                    <option value="">Select Allowed Members</option>
                    {membersOptions.map(members => (
                      <option key={members} value={members}>{members}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="dashboard-form-row">
                <div className="dashboard-form-group">
                  <label>Town Hall</label>
                  <div className="dashboard-checkbox-group">
                    {townHallLevels.map(th => (
                      <label key={th} className="dashboard-checkbox-label">
                        <input
                          type="checkbox"
                          checked={cwlForm.townHall.includes(th)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCwlForm({ ...cwlForm, townHall: [...cwlForm.townHall, th] })
                            } else {
                              setCwlForm({ ...cwlForm, townHall: cwlForm.townHall.filter(t => t !== th) })
                            }
                          }}
                        />
                        <span>TH{th}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="dashboard-form-group">
                  <label>Weight</label>
                  <input
                    type="text"
                    value={cwlForm.weight}
                    onChange={(e) => {
                      // Backend will sanitize to digits only, but we can still do basic validation for UX
                      setCwlForm({ ...cwlForm, weight: e.target.value })
                    }}
                    placeholder="Enter Minimum Weight"
                  />
                </div>
              </div>
              <div className="dashboard-form-group">
                <label>Status</label>
                <select
                  value={cwlForm.status}
                  onChange={(e) => setCwlForm({ ...cwlForm, status: e.target.value })}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div className="dashboard-form-actions">
                <button type="submit" disabled={loading}>
                  {editingCwl ? 'Update' : 'Create'}
                </button>
                {editingCwl && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCwl(null)
                      setCwlForm({
                        tag: '',
                        inUse: '',
                        format: '',
                        members: '',
                        townHall: [],
                        weight: '',
                        league: '',
                        name: '',
                        status: 'Active'
                      })
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
              </>
            )}

            <h3 className="dashboard-section-title">CWL Clans ({cwlClans.length})</h3>
            <div className="dashboard-table-container">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>In Use</th>
                    <th>Tag</th>
                    <th>Name</th>
                    <th>Status</th>
                    <th>League</th>
                    <th>Format</th>
                    <th>Allowed Members</th>
                    <th>Town Hall</th>
                    <th>Weight</th>
                    {isRoot && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {cwlClans.map((clan) => (
                    <tr key={clan.tag}>
                      <td>{clan.inUse}</td>
                      <td>{clan.tag}</td>
                      <td>{clan.name || '-'}</td>
                      <td>{clan.status || 'Active'}</td>
                      <td>{clan.league || '-'}</td>
                      <td>{clan.format || '-'}</td>
                      <td>{clan.members || '-'}</td>
                      <td>{clan.townHall || '-'}</td>
                      <td>{clan.weight || '-'}</td>
                      {isRoot && (
                        <td>
                          <button
                            onClick={() => handleCwlEdit(clan)}
                            className="dashboard-btn dashboard-btn--edit"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleCwlDelete(clan.tag)}
                            className="dashboard-btn dashboard-btn--delete"
                          >
                            Delete
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {loading && activeTab === 'layouts' && <div className="dashboard-loading">Loading...</div>}

        {activeTab === 'layouts' && (
          <div className="dashboard-section">
            <h3 className="dashboard-section-title">
              {editingLayout ? 'Edit Base Layout' : 'Add New Base Layout'}
            </h3>
            <form onSubmit={handleLayoutSubmit} className="dashboard-form">
              <div className="dashboard-form-row">
                <div className="dashboard-form-group">
                  <label>Town Hall Level</label>
                  <input
                    type="number"
                    value={layoutForm.townHallLevel}
                    onChange={(e) => setLayoutForm({ ...layoutForm, townHallLevel: e.target.value })}
                    placeholder="Th Level"
                    required
                    disabled={!!editingLayout}
                    min="1"
                    max="20"
                  />
                </div>
              </div>
              <div className="dashboard-form-group">
                <label>Layout Link</label>
                <input
                  type="url"
                  value={layoutForm.link}
                  onChange={(e) => setLayoutForm({ ...layoutForm, link: e.target.value })}
                  placeholder="Base Layout Link"
                  required
                />
              </div>
              <div className="dashboard-form-actions">
                <button type="submit" disabled={loading}>
                  {editingLayout ? 'Update' : 'Create'}
                </button>
                {editingLayout && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingLayout(null)
                      setLayoutForm({ townHallLevel: '', link: '' })
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>

            <h3 className="dashboard-section-title">Base Layouts ({baseLayouts.length})</h3>
            <div className="dashboard-table-container">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>TH Level</th>
                    <th>Link</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {baseLayouts.map((layout) => (
                    <tr key={layout.townHallLevel}>
                      <td>TH{layout.townHallLevel}</td>
                      <td>
                        <a href={layout.link} target="_blank" rel="noopener noreferrer">
                          View Layout
                        </a>
                      </td>
                      <td>
                        <button
                          onClick={() => handleLayoutEdit(layout)}
                          className="dashboard-btn dashboard-btn--edit"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleLayoutDelete(layout.townHallLevel)}
                          className="dashboard-btn dashboard-btn--delete"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {loading && activeTab === 'users' && <div className="dashboard-loading">Loading...</div>}

        {activeTab === 'users' && isRoot && (
          <div className="dashboard-section">
            <h3 className="dashboard-section-title">Users ({users.length})</h3>
            <div className="dashboard-table-container">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Username</th>
                    <th>Role</th>
                    <th>Created At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user._id || user.id || user.email}>
                      <td>{user.email}</td>
                      <td>{user.username}</td>
                      <td>
                        {user.isRoot || user.role === 'root' ? (
                          <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>root</span>
                        ) : (
                          <select
                            value={editingUserRole[user._id || user.id] !== undefined 
                              ? editingUserRole[user._id || user.id] 
                              : user.role || 'user'}
                            onChange={(e) => {
                              const newRole = e.target.value
                              const userId = user._id || user.id
                              setEditingUserRole({ ...editingUserRole, [userId]: newRole })
                              handleRoleChange(userId, newRole)
                            }}
                            className="dashboard-select"
                            disabled={loading}
                          >
                            <option value="user">user</option>
                            <option value="admin">admin</option>
                          </select>
                        )}
                      </td>
                      <td>
                        {user.createdAt 
                          ? new Date(user.createdAt).toLocaleDateString()
                          : '-'}
                      </td>
                      <td>
                        {!user.isRoot && user.role !== 'root' && (
                          <button
                            onClick={() => handleUserDelete(user._id || user.id, user.email)}
                            className="dashboard-btn dashboard-btn--delete"
                            disabled={loading}
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

export default Dashboard

