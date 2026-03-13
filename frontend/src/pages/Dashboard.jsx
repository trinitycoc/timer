import React, { useState, useEffect } from 'react'
import SectionTitle from '../components/SectionTitle'
import { useAuth } from '../contexts/AuthContext'
import {
  getGFLClans,
  forceSyncGFLClansFromSheet,
  getFollowingClans,
  forceSyncFollowingClansFromSheet,
  getSyncTime,
  setSyncTime as saveSyncTime,
  getTrackSettings,
  setTrackSettings as saveTrackSettings,
  getAllUsers,
  updateUser,
  deleteUser
} from '../services/api'

function Dashboard() {
  const { isRoot, isAdmin } = useAuth()
  // Admin users default to 'gfl' tab, root users default to 'gfl'
  const [activeTab, setActiveTab] = useState('gfl')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  
  // GFL clans state
  const [gflClans, setGflClans] = useState([])
  const [gflClanFilter, setGflClanFilter] = useState('active') // 'active' | 'ex-gfl'
  const [syncing, setSyncing] = useState(false)

  // Following clans state
  const [followingClans, setFollowingClans] = useState([])
  const [syncingFollowing, setSyncingFollowing] = useState(false)

  // Users state (only for root users)
  const [users, setUsers] = useState([])
  const [editingUserRole, setEditingUserRole] = useState({})

  // Track Clans state (which clan groups to track)
  const [trackAllGFL, setTrackAllGFL] = useState(false)
  const [trackVaryClans, setTrackVaryClans] = useState(false)
  const [trackFollowingClans, setTrackFollowingClans] = useState(false)

  // Settings: sync date and time
  const [syncDate, setSyncDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().slice(0, 10)
  })
  const [syncTime, setSyncTime] = useState('02:00')
  const [savingSyncTime, setSavingSyncTime] = useState(false)

  // Load saved preferences from DB on mount (so user doesn't have to set them every time)
  useEffect(() => {
    if (!isAdmin) return
    const loadPreferences = async () => {
      try {
        const [track, sync] = await Promise.all([getTrackSettings(), getSyncTime()])
        setTrackAllGFL(track.trackAllGFL ?? false)
        setTrackVaryClans(track.trackVaryClans ?? false)
        setTrackFollowingClans(track.trackFollowingClans ?? false)
        if (sync?.syncAt) {
          const d = new Date(sync.syncAt)
          setSyncDate(d.toLocaleDateString('en-CA'))
          setSyncTime(String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'))
        }
      } catch {
        // ignore - use defaults if not yet set or API error
      }
    }
    loadPreferences()
  }, [isAdmin])

  useEffect(() => {
    if (!isRoot && activeTab === 'users') {
      setActiveTab('gfl')
    } else {
      loadData()
    }
  }, [activeTab, isRoot])

  const loadData = async () => {
    // Track Clans and Settings use preferences already loaded on mount — skip redundant fetch
    if ((activeTab === 'track-clans' || activeTab === 'settings') && isAdmin) {
      return
    }
    setLoading(true)
    setError(null)
    try {
      if (activeTab === 'gfl' && isAdmin) {
        const clans = await getGFLClans()
        setGflClans(clans)
      } else if (activeTab === 'following' && isAdmin) {
        const clans = await getFollowingClans()
        setFollowingClans(clans)
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

  const runSync = async (syncFn, setSyncingState, getSuccessMessage, errorMessage) => {
    setSyncingState(true)
    setError(null)
    try {
      const result = await syncFn()
      showSuccess(result.message ?? getSuccessMessage(result))
      await loadData()
    } catch (err) {
      showError(err.message || errorMessage)
    } finally {
      setSyncingState(false)
    }
  }

  const handleForceSync = () =>
    runSync(
      forceSyncGFLClansFromSheet,
      setSyncing,
      (r) => `Synced ${r.synced} clans from sheet`,
      'Failed to sync from sheet'
    )

  const handleFollowingSync = () =>
    runSync(
      forceSyncFollowingClansFromSheet,
      setSyncingFollowing,
      (r) => `Synced ${r.synced} following clans from sheet`,
      'Failed to sync following clans from sheet'
    )

  const handleSaveSyncTime = async (e) => {
    e.preventDefault()
    setSavingSyncTime(true)
    setError(null)
    try {
      const localDate = new Date(syncDate + 'T' + syncTime)
      const syncAt = localDate.toISOString()
      await saveSyncTime(syncAt)
      showSuccess('War status check time saved. We will start checking at this date/time, then daily at the same time.')
    } catch (err) {
      showError(err.message || 'Failed to save sync time')
    } finally {
      setSavingSyncTime(false)
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

  // Normal users see nothing (route is admin-only; this is defense in depth)
  if (!isAdmin && !isRoot) {
    return null
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
              className={`dashboard-tab ${activeTab === 'gfl' ? 'active' : ''}`}
              onClick={() => setActiveTab('gfl')}
            >
              GFL Clans
            </button>
            <button
              className={`dashboard-tab ${activeTab === 'following' ? 'active' : ''}`}
              onClick={() => setActiveTab('following')}
            >
              Following Clans
            </button>
            <button
              className={`dashboard-tab ${activeTab === 'track-clans' ? 'active' : ''}`}
              onClick={() => setActiveTab('track-clans')}
            >
              Track Clans
            </button>
            <button
              className={`dashboard-tab ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              Sync Time
            </button>
          </>
        )}
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
        {loading && activeTab === 'gfl' && <div className="dashboard-loading">Loading...</div>}

        {activeTab === 'gfl' && isAdmin && (
          <div className="dashboard-section">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleForceSync}
                disabled={syncing || loading}
                className="dashboard-btn dashboard-btn--edit"
              >
                {syncing ? 'Syncing…' : 'Force sync GFL Clans from sheet'}
              </button>
              <span className="dashboard-hint" style={{ color: 'rgba(255,255,255,0.6)' }}>
                Updates the database from the Google Sheet. Sync also runs automatically every hour.
              </span>
            </div>

            {(() => {
              const activeClans = gflClans.filter((c) => c.status === 'Active')
              const exGflClans = gflClans.filter((c) => c.status !== 'Active')
              const filteredClans = gflClanFilter === 'active' ? activeClans : exGflClans
              return (
                <>
                  <div className="dashboard-tabs" style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>
                    <button
                      type="button"
                      className={`dashboard-tab ${gflClanFilter === 'active' ? 'active' : ''}`}
                      onClick={() => setGflClanFilter('active')}
                    >
                      Active ({activeClans.length})
                    </button>
                    <button
                      type="button"
                      className={`dashboard-tab ${gflClanFilter === 'ex-gfl' ? 'active' : ''}`}
                      onClick={() => setGflClanFilter('ex-gfl')}
                    >
                      Ex-GFL ({exGflClans.length})
                    </button>
                  </div>
                  <h3 className="dashboard-section-title">
                    {gflClanFilter === 'active' ? 'Active Clans' : 'Ex-GFL Clans'} ({filteredClans.length})
                  </h3>
                  <div className="dashboard-table-container">
                    <table className="dashboard-table">
                      <thead>
                        <tr>
                          <th>Sr. No.</th>
                          <th>Tag</th>
                          <th>Clan Name</th>
                          <th>Status</th>
                          <th>Vary</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredClans.map((clan, index) => (
                          <tr key={clan.tag}>
                            <td>{index + 1}</td>
                            <td>{clan.tag}</td>
                            <td>{clan.name || '-'}</td>
                            <td>{clan.status}</td>
                            <td>{clan.vary ?? '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )
            })()}
          </div>
        )}

        {loading && activeTab === 'following' && <div className="dashboard-loading">Loading...</div>}

        {activeTab === 'following' && isAdmin && (
          <div className="dashboard-section">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleFollowingSync}
                disabled={syncingFollowing || loading}
                className="dashboard-btn dashboard-btn--edit"
              >
                {syncingFollowing ? 'Syncing…' : 'Force sync Following Clans from sheet'}
              </button>
            </div>
            <h3 className="dashboard-section-title">Following Clans ({followingClans.length})</h3>
            <div className="dashboard-table-container">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Sr. No.</th>
                    <th>Tag</th>
                    <th>Clan Name</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {followingClans.map((clan, index) => (
                    <tr key={clan.tag}>
                      <td>{index + 1}</td>
                      <td>{clan.tag}</td>
                      <td>{clan.name || '-'}</td>
                      <td>{clan.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {loading && activeTab === 'track-clans' && <div className="dashboard-loading">Loading...</div>}

        {activeTab === 'track-clans' && isAdmin && (
          <div className="dashboard-section">
            <h3 className="dashboard-section-title">Track Clans</h3>
            <p className="dashboard-hint" style={{ marginBottom: '1rem' }}>
              Choose which clan groups to include in the war status check. Track all GFL = all active GFL clans. Track vary clans = active GFL clans that have a vary value (not 0 or empty). Track following = active following clans. Your choices are saved automatically.
            </p>
            <div className="dashboard-track-options">
              <label className="dashboard-checkbox-label">
                <input
                  type="checkbox"
                  checked={trackAllGFL}
                  onChange={async (e) => {
                    const v = e.target.checked
                    setTrackAllGFL(v)
                    try {
                      await saveTrackSettings({ trackAllGFL: v, trackVaryClans, trackFollowingClans })
                      showSuccess('Track settings saved')
                    } catch (err) {
                      setTrackAllGFL(!v)
                      showError(err.message)
                    }
                  }}
                />
                <span>Track all GFL clans</span>
              </label>
              <label className="dashboard-checkbox-label">
                <input
                  type="checkbox"
                  checked={trackVaryClans}
                  onChange={async (e) => {
                    const v = e.target.checked
                    setTrackVaryClans(v)
                    try {
                      await saveTrackSettings({ trackAllGFL, trackVaryClans: v, trackFollowingClans })
                      showSuccess('Track settings saved')
                    } catch (err) {
                      setTrackVaryClans(!v)
                      showError(err.message)
                    }
                  }}
                />
                <span>Track clans with vary</span>
              </label>
              <label className="dashboard-checkbox-label">
                <input
                  type="checkbox"
                  checked={trackFollowingClans}
                  onChange={async (e) => {
                    const v = e.target.checked
                    setTrackFollowingClans(v)
                    try {
                      await saveTrackSettings({ trackAllGFL, trackVaryClans, trackFollowingClans: v })
                      showSuccess('Track settings saved')
                    } catch (err) {
                      setTrackFollowingClans(!v)
                      showError(err.message)
                    }
                  }}
                />
                <span>Track following clans</span>
              </label>
            </div>
          </div>
        )}

        {loading && activeTab === 'settings' && <div className="dashboard-loading">Loading...</div>}

        {activeTab === 'settings' && isAdmin && (
          <div className="dashboard-section">
            <h3 className="dashboard-section-title">War status check time</h3>
            <p className="dashboard-hint" style={{ marginBottom: '1rem' }}>
              Sheet sync runs every hour and on force resync. War status check: from (sync time + min vary) to (sync time + max vary) we check each GFL clan at sync time + its vary; following clans at sync time. When a clan is &quot;not in war&quot; we record the timestamp and stop checking that clan until next day. Your sync time is saved automatically.
            </p>
            <form onSubmit={handleSaveSyncTime} className="dashboard-form">
              <div className="dashboard-form-row">
                <div className="dashboard-form-group">
                  <label htmlFor="sync-date">Date</label>
                  <input
                    id="sync-date"
                    type="date"
                    value={syncDate}
                    onChange={(e) => setSyncDate(e.target.value)}
                  />
                </div>
                <div className="dashboard-form-group">
                  <label htmlFor="sync-time">Time (24h)</label>
                  <input
                    id="sync-time"
                    type="time"
                    value={syncTime}
                    onChange={(e) => setSyncTime(e.target.value)}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={savingSyncTime || loading}
                className="dashboard-btn dashboard-btn--edit"
              >
                {savingSyncTime ? 'Saving…' : 'Save sync time'}
              </button>
            </form>
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

