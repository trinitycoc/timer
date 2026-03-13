import express from 'express'
import { authenticate, requireRoot, requireAdmin } from '../middleware/auth.js'
import logger from '../utils/logger.js'
import {
  getGFLClans,
  getGFLClanByTag,
  createGFLClan,
  updateGFLClan,
  deleteGFLClan,
  getFollowingClans,
  getFollowingClanByTag,
} from '../services/clanManagementService.js'
import { syncGFLClansFromSheet } from '../services/gflSheetSyncService.js'
import { syncFollowingClansFromSheet } from '../services/followingSheetSyncService.js'
import { getSyncTime, setSyncTime, getTrackSettings, setTrackSettings } from '../services/settingsService.js'

const router = express.Router()

// All routes require authentication
router.use(authenticate)

// Handler factories to reduce duplication
const handleGetClanList = (getClans, errorLabel) => async (req, res) => {
  try {
    const filters = req.query.status ? { status: req.query.status } : {}
    const clans = await getClans(filters)
    res.json({ clans, count: clans.length })
  } catch (error) {
    logger.error(`Error fetching ${errorLabel}:`, error.message)
    res.status(500).json({ error: `Failed to fetch ${errorLabel}`, message: error.message })
  }
}

const handleForceSync = (syncFn, logLabel, successMessage, errorLabel) => async (req, res) => {
  logger.info(`Force resync request for ${logLabel}`)
  try {
    const result = await syncFn()
    logger.info(`${logLabel} force sync completed: ${result.synced} upserted, ${result.skipped} skipped, ${result.errors?.length ?? 0} errors`)
    res.json({ success: true, message: successMessage(result), ...result })
  } catch (error) {
    logger.error(`Error syncing ${errorLabel}:`, error.message)
    res.status(500).json({ error: 'Failed to sync from sheet', message: error.message })
  }
}

// ============================================
// GFL CLANS ENDPOINTS
// ============================================

/**
 * GET /api/admin/gfl-clans
 * Get all GFL clans (admin can read, root can read)
 */
router.get('/gfl-clans', requireAdmin, handleGetClanList(getGFLClans, 'GFL clans'))

/**
 * POST /api/admin/gfl-clans/sync
 * Force sync GFL clans from Google Sheet (admin only)
 */
router.post('/gfl-clans/sync', requireAdmin, handleForceSync(syncGFLClansFromSheet, 'GFL clans', (r) => `Synced ${r.synced} clans from sheet`, 'GFL clans from sheet'))

/**
 * GET /api/admin/gfl-clans/:tag
 * Get a specific GFL clan by tag (admin can read, root can read)
 */
router.get('/gfl-clans/:tag', requireAdmin, async (req, res) => {
  try {
    const { tag } = req.params
    const clan = await getGFLClanByTag(tag)
    if (!clan) {
      return res.status(404).json({
        error: 'Clan not found',
        message: `No GFL clan found with tag: ${tag}`
      })
    }
    res.json({ clan })
  } catch (error) {
    logger.error('Error fetching GFL clan:', error.message)
    res.status(500).json({
      error: 'Failed to fetch GFL clan',
      message: error.message
    })
  }
})

/**
 * POST /api/admin/gfl-clans
 * Create a new GFL clan (root only)
 */
router.post('/gfl-clans', requireRoot, async (req, res) => {
  try {
    const { tag, status, name } = req.body
    
    if (!tag) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Clan tag is required'
      })
    }
    
    const clan = await createGFLClan({ 
      tag, 
      status: status || 'Active',
      name: name || ''
    })
    res.status(201).json({ clan, message: 'GFL clan created successfully' })
  } catch (error) {
    logger.error('Error creating GFL clan:', error.message)
    const statusCode = error.message.includes('already exists') ? 409 : 500
    res.status(statusCode).json({
      error: 'Failed to create GFL clan',
      message: error.message
    })
  }
})

/**
 * PUT /api/admin/gfl-clans/:tag
 * Update a GFL clan (root only)
 */
router.put('/gfl-clans/:tag', requireRoot, async (req, res) => {
  try {
    const { tag } = req.params
    const updates = req.body
    
    const clan = await updateGFLClan(tag, updates)
    res.json({ clan, message: 'GFL clan updated successfully' })
  } catch (error) {
    logger.error('Error updating GFL clan:', error.message)
    const statusCode = error.message.includes('not found') ? 404 : 500
    res.status(statusCode).json({
      error: 'Failed to update GFL clan',
      message: error.message
    })
  }
})

/**
 * DELETE /api/admin/gfl-clans/:tag
 * Delete a GFL clan (root only)
 */
router.delete('/gfl-clans/:tag', requireRoot, async (req, res) => {
  try {
    const { tag } = req.params
    const deleted = await deleteGFLClan(tag)
    if (!deleted) {
      return res.status(404).json({
        error: 'Clan not found',
        message: `No GFL clan found with tag: ${tag}`
      })
    }
    res.json({ message: 'GFL clan deleted successfully' })
  } catch (error) {
    logger.error('Error deleting GFL clan:', error.message)
    res.status(500).json({
      error: 'Failed to delete GFL clan',
      message: error.message
    })
  }
})

// ============================================
// FOLLOWING CLANS ENDPOINTS (sheet: D=tag, E=name, G=status; no vary)
// ============================================

/**
 * GET /api/admin/following-clans
 * Get all following clans
 */
router.get('/following-clans', requireAdmin, handleGetClanList(getFollowingClans, 'following clans'))

/**
 * POST /api/admin/following-clans/sync
 * Force sync following clans from Google Sheet (columns D, E, G)
 */
router.post('/following-clans/sync', requireAdmin, handleForceSync(syncFollowingClansFromSheet, 'Following clans', (r) => `Synced ${r.synced} following clans from sheet`, 'following clans from sheet'))

/**
 * GET /api/admin/following-clans/:tag
 * Get a specific following clan by tag
 */
router.get('/following-clans/:tag', requireAdmin, async (req, res) => {
  try {
    const { tag } = req.params
    const clan = await getFollowingClanByTag(tag)
    if (!clan) {
      return res.status(404).json({
        error: 'Clan not found',
        message: `No following clan found with tag: ${tag}`
      })
    }
    res.json({ clan })
  } catch (error) {
    logger.error('Error fetching following clan:', error.message)
    res.status(500).json({
      error: 'Failed to fetch following clan',
      message: error.message
    })
  }
})

// ============================================
// SETTINGS (sync time stored in DB)
// ============================================

/**
 * GET /api/admin/settings/sync-time
 * Get current sync date/time (syncAt as ISO string)
 */
router.get('/settings/sync-time', requireAdmin, async (req, res) => {
  try {
    const settings = await getSyncTime()
    res.json(settings)
  } catch (error) {
    logger.error('Error fetching sync time:', error.message)
    res.status(500).json({
      error: 'Failed to fetch sync time',
      message: error.message
    })
  }
})

/**
 * PUT /api/admin/settings/sync-time
 * Set sync date/time (body: { syncAt: 'ISO string' })
 */
router.put('/settings/sync-time', requireAdmin, async (req, res) => {
  try {
    const { syncAt } = req.body
    if (!syncAt || typeof syncAt !== 'string') {
      return res.status(400).json({
        error: 'Validation error',
        message: 'syncAt (ISO date/time) is required'
      })
    }
    const saved = await setSyncTime(syncAt)
    res.json({ syncAt: saved, message: 'Sync date/time updated' })
  } catch (error) {
    logger.error('Error saving sync time:', error.message)
    const statusCode = error.message.includes('Invalid') ? 400 : 500
    res.status(statusCode).json({
      error: 'Failed to save sync time',
      message: error.message
    })
  }
})

/**
 * GET /api/admin/settings/track-clans
 * Get track-clans settings (trackAllGFL, trackVaryClans, trackFollowingClans)
 */
router.get('/settings/track-clans', requireAdmin, async (req, res) => {
  try {
    const settings = await getTrackSettings()
    res.json(settings)
  } catch (error) {
    logger.error('Error fetching track settings:', error.message)
    res.status(500).json({
      error: 'Failed to fetch track settings',
      message: error.message
    })
  }
})

/**
 * PUT /api/admin/settings/track-clans
 * Set track-clans settings (body: { trackAllGFL?, trackVaryClans?, trackFollowingClans? })
 */
router.put('/settings/track-clans', requireAdmin, async (req, res) => {
  try {
    const { trackAllGFL, trackVaryClans, trackFollowingClans } = req.body
    const saved = await setTrackSettings({
      trackAllGFL,
      trackVaryClans,
      trackFollowingClans
    })
    res.json({ ...saved, message: 'Track settings updated' })
  } catch (error) {
    logger.error('Error saving track settings:', error.message)
    res.status(500).json({
      error: 'Failed to save track settings',
      message: error.message
    })
  }
})

export default router

