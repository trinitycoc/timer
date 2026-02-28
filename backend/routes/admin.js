import express from 'express'
import { authenticate, requireRoot, requireAdmin } from '../middleware/auth.js'
import logger from '../utils/logger.js'
import {
  // Trinity clans
  getTrinityClans,
  getTrinityClanByTag,
  createTrinityClan,
  updateTrinityClan,
  deleteTrinityClan,
  // CWL clans
  getCWLClans,
  getCWLClanByTag,
  createCWLClan,
  updateCWLClan,
  deleteCWLClan,
  // Base layouts
  getBaseLayouts,
  getBaseLayoutByTH,
  createBaseLayout,
  updateBaseLayout,
  deleteBaseLayout
} from '../services/clanManagementService.js'

const router = express.Router()

// All routes require authentication
router.use(authenticate)

// ============================================
// TRINITY CLANS ENDPOINTS
// ============================================

/**
 * GET /api/admin/trinity-clans
 * Get all Trinity clans (admin can read, root can read)
 */
router.get('/trinity-clans', requireAdmin, async (req, res) => {
  try {
    const { status } = req.query
    const filters = status ? { status } : {}
    const clans = await getTrinityClans(filters)
    res.json({ clans, count: clans.length })
  } catch (error) {
    logger.error('Error fetching Trinity clans:', error.message)
    res.status(500).json({
      error: 'Failed to fetch Trinity clans',
      message: error.message
    })
  }
})

/**
 * GET /api/admin/trinity-clans/:tag
 * Get a specific Trinity clan by tag (admin can read, root can read)
 */
router.get('/trinity-clans/:tag', requireAdmin, async (req, res) => {
  try {
    const { tag } = req.params
    const clan = await getTrinityClanByTag(tag)
    if (!clan) {
      return res.status(404).json({
        error: 'Clan not found',
        message: `No Trinity clan found with tag: ${tag}`
      })
    }
    res.json({ clan })
  } catch (error) {
    logger.error('Error fetching Trinity clan:', error.message)
    res.status(500).json({
      error: 'Failed to fetch Trinity clan',
      message: error.message
    })
  }
})

/**
 * POST /api/admin/trinity-clans
 * Create a new Trinity clan (root only)
 */
router.post('/trinity-clans', requireRoot, async (req, res) => {
  try {
    const { tag, status, name } = req.body
    
    if (!tag) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Clan tag is required'
      })
    }
    
    const clan = await createTrinityClan({ 
      tag, 
      status: status || 'Active',
      name: name || ''
    })
    res.status(201).json({ clan, message: 'Trinity clan created successfully' })
  } catch (error) {
    logger.error('Error creating Trinity clan:', error.message)
    const statusCode = error.message.includes('already exists') ? 409 : 500
    res.status(statusCode).json({
      error: 'Failed to create Trinity clan',
      message: error.message
    })
  }
})

/**
 * PUT /api/admin/trinity-clans/:tag
 * Update a Trinity clan (root only)
 */
router.put('/trinity-clans/:tag', requireRoot, async (req, res) => {
  try {
    const { tag } = req.params
    const updates = req.body
    
    const clan = await updateTrinityClan(tag, updates)
    res.json({ clan, message: 'Trinity clan updated successfully' })
  } catch (error) {
    logger.error('Error updating Trinity clan:', error.message)
    const statusCode = error.message.includes('not found') ? 404 : 500
    res.status(statusCode).json({
      error: 'Failed to update Trinity clan',
      message: error.message
    })
  }
})

/**
 * DELETE /api/admin/trinity-clans/:tag
 * Delete a Trinity clan (root only)
 */
router.delete('/trinity-clans/:tag', requireRoot, async (req, res) => {
  try {
    const { tag } = req.params
    const deleted = await deleteTrinityClan(tag)
    if (!deleted) {
      return res.status(404).json({
        error: 'Clan not found',
        message: `No Trinity clan found with tag: ${tag}`
      })
    }
    res.json({ message: 'Trinity clan deleted successfully' })
  } catch (error) {
    logger.error('Error deleting Trinity clan:', error.message)
    res.status(500).json({
      error: 'Failed to delete Trinity clan',
      message: error.message
    })
  }
})

// ============================================
// CWL CLANS ENDPOINTS
// ============================================

/**
 * GET /api/admin/cwl-clans
 * Get all CWL clans (admin can read, root can read)
 */
router.get('/cwl-clans', requireAdmin, async (req, res) => {
  try {
    const clans = await getCWLClans()
    res.json({ clans, count: clans.length })
  } catch (error) {
    logger.error('Error fetching CWL clans:', error.message)
    res.status(500).json({
      error: 'Failed to fetch CWL clans',
      message: error.message
    })
  }
})

/**
 * GET /api/admin/cwl-clans/:tag
 * Get a specific CWL clan by tag (admin can read, root can read)
 */
router.get('/cwl-clans/:tag', requireAdmin, async (req, res) => {
  try {
    const { tag } = req.params
    const clan = await getCWLClanByTag(tag)
    if (!clan) {
      return res.status(404).json({
        error: 'CWL clan not found',
        message: `No CWL clan found with tag: ${tag}`
      })
    }
    res.json({ clan })
  } catch (error) {
    logger.error('Error fetching CWL clan:', error.message)
    res.status(500).json({
      error: 'Failed to fetch CWL clan',
      message: error.message
    })
  }
})

/**
 * POST /api/admin/cwl-clans
 * Create a new CWL clan (root only)
 */
router.post('/cwl-clans', requireRoot, async (req, res) => {
  try {
    const { tag, inUse, name, format, members, townHall, weight, league, status } = req.body
    
    if (!tag || inUse === undefined) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Clan tag and inUse are required'
      })
    }
    
    const clan = await createCWLClan({
      tag,
      inUse,
      name: name || '',
      format: format || '',
      members: members || '',
      townHall: townHall || '',
      weight: weight || '',
      league: league || '',
      status: status || 'Active'
    })
    res.status(201).json({ clan, message: 'CWL clan created successfully' })
  } catch (error) {
    logger.error('Error creating CWL clan:', error.message)
    const statusCode = error.message.includes('already exists') ? 409 : 500
    res.status(statusCode).json({
      error: 'Failed to create CWL clan',
      message: error.message
    })
  }
})

/**
 * PUT /api/admin/cwl-clans/:tag
 * Update a CWL clan (root only)
 */
router.put('/cwl-clans/:tag', requireRoot, async (req, res) => {
  try {
    const { tag } = req.params
    const updates = req.body
    
    const clan = await updateCWLClan(tag, updates)
    res.json({ clan, message: 'CWL clan updated successfully' })
  } catch (error) {
    logger.error('Error updating CWL clan:', error.message)
    const statusCode = error.message.includes('not found') ? 404 : 
                      error.message.includes('already exists') ? 409 : 500
    res.status(statusCode).json({
      error: 'Failed to update CWL clan',
      message: error.message
    })
  }
})

/**
 * DELETE /api/admin/cwl-clans/:tag
 * Delete a CWL clan (root only)
 */
router.delete('/cwl-clans/:tag', requireRoot, async (req, res) => {
  try {
    const { tag } = req.params
    const deleted = await deleteCWLClan(tag)
    if (!deleted) {
      return res.status(404).json({
        error: 'CWL clan not found',
        message: `No CWL clan found with tag: ${tag}`
      })
    }
    res.json({ message: 'CWL clan deleted successfully' })
  } catch (error) {
    logger.error('Error deleting CWL clan:', error.message)
    res.status(500).json({
      error: 'Failed to delete CWL clan',
      message: error.message
    })
  }
})

// ============================================
// BASE LAYOUTS ENDPOINTS
// ============================================

/**
 * GET /api/admin/base-layouts
 * Get all base layouts (admin can read, root can read)
 */
router.get('/base-layouts', requireAdmin, async (req, res) => {
  try {
    const layouts = await getBaseLayouts()
    res.json({ layouts, count: layouts.length })
  } catch (error) {
    logger.error('Error fetching base layouts:', error.message)
    res.status(500).json({
      error: 'Failed to fetch base layouts',
      message: error.message
    })
  }
})

/**
 * GET /api/admin/base-layouts/:townHallLevel
 * Get a specific base layout by town hall level (admin can read, root can read)
 */
router.get('/base-layouts/:townHallLevel', requireAdmin, async (req, res) => {
  try {
    const { townHallLevel } = req.params
    const layout = await getBaseLayoutByTH(townHallLevel)
    if (!layout) {
      return res.status(404).json({
        error: 'Base layout not found',
        message: `No base layout found for TH${townHallLevel}`
      })
    }
    res.json({ layout })
  } catch (error) {
    logger.error('Error fetching base layout:', error.message)
    res.status(500).json({
      error: 'Failed to fetch base layout',
      message: error.message
    })
  }
})

/**
 * POST /api/admin/base-layouts
 * Create a new base layout (admin and root can create)
 */
router.post('/base-layouts', requireAdmin, async (req, res) => {
  try {
    const { townHallLevel, link, imagePath } = req.body
    
    if (!townHallLevel || !link) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Town hall level and link are required'
      })
    }
    
    const layout = await createBaseLayout({
      townHallLevel,
      link,
      imagePath: imagePath || ''
    })
    res.status(201).json({ layout, message: 'Base layout created successfully' })
  } catch (error) {
    logger.error('Error creating base layout:', error.message)
    const statusCode = error.message.includes('already exists') ? 409 : 500
    res.status(statusCode).json({
      error: 'Failed to create base layout',
      message: error.message
    })
  }
})

/**
 * PUT /api/admin/base-layouts/:townHallLevel
 * Update a base layout (admin and root can update)
 */
router.put('/base-layouts/:townHallLevel', requireAdmin, async (req, res) => {
  try {
    const { townHallLevel } = req.params
    const updates = req.body
    
    const layout = await updateBaseLayout(townHallLevel, updates)
    res.json({ layout, message: 'Base layout updated successfully' })
  } catch (error) {
    logger.error('Error updating base layout:', error.message)
    const statusCode = error.message.includes('not found') ? 404 : 500
    res.status(statusCode).json({
      error: 'Failed to update base layout',
      message: error.message
    })
  }
})

/**
 * DELETE /api/admin/base-layouts/:townHallLevel
 * Delete a base layout (admin and root can delete)
 */
router.delete('/base-layouts/:townHallLevel', requireAdmin, async (req, res) => {
  try {
    const { townHallLevel } = req.params
    const deleted = await deleteBaseLayout(townHallLevel)
    if (!deleted) {
      return res.status(404).json({
        error: 'Base layout not found',
        message: `No base layout found for TH${townHallLevel}`
      })
    }
    res.json({ message: 'Base layout deleted successfully' })
  } catch (error) {
    logger.error('Error deleting base layout:', error.message)
    res.status(500).json({
      error: 'Failed to delete base layout',
      message: error.message
    })
  }
})

export default router

