import express from 'express'
import {
  registerUser,
  loginUser,
  getUserByIdentifier,
  getAllUsers,
  deleteUser,
  updateUser,
  changePassword,
  getRootUserConfig
} from '../services/authService.js'
import { authenticate, requireAdmin, requireRoot } from '../middleware/auth.js'
import logger from '../utils/logger.js'

const router = express.Router()

/**
 * POST /api/auth/register
 * Register a new admin user
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, username } = req.body
    
    // Validate input
    if (!email || !password || !username) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Email, password, and username are required'
      })
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid email format'
      })
    }
    
    // Validate password strength (minimum 8 characters)
    if (password.length < 8) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Password must be at least 8 characters long'
      })
    }
    
    // Validate username (alphanumeric and underscore, 3-20 chars)
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/
    if (!usernameRegex.test(username)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Username must be 3-20 characters and contain only letters, numbers, and underscores'
      })
    }
    
    // Register user
    const user = await registerUser(email, password, username)
    
    res.status(201).json({
      message: 'User registered successfully',
      user
    })
  } catch (error) {
    logger.error('Registration error:', error.message)
    res.status(400).json({
      error: 'Registration failed',
      message: error.message
    })
  }
})

/**
 * POST /api/auth/login
 * Login and get JWT token
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Email and password are required'
      })
    }
    
    // Login user
    const { user, token } = await loginUser(email, password)
    
    res.json({
      message: 'Login successful',
      user,
      token
    })
  } catch (error) {
    logger.error('Login error:', error.message)
    res.status(401).json({
      error: 'Login failed',
      message: error.message || 'Invalid credentials'
    })
  }
})

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    res.json({
      user: req.user
    })
  } catch (error) {
    logger.error('Get current user error:', error.message)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get user information'
    })
  }
})

/**
 * POST /api/auth/change-password
 * Change user password (authenticated users only)
 */
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body
    
    // Validate input
    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Old password and new password are required'
      })
    }
    
    // Validate new password strength
    if (newPassword.length < 8) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'New password must be at least 8 characters long'
      })
    }
    
    // Get user identifier
    const identifier = req.user._id || req.user.id || req.user.email
    
    // Change password
    await changePassword(identifier, oldPassword, newPassword)
    
    res.json({
      message: 'Password changed successfully'
    })
  } catch (error) {
    logger.error('Change password error:', error.message)
    res.status(400).json({
      error: 'Failed to change password',
      message: error.message
    })
  }
})

/**
 * GET /api/auth/users
 * Get all users (admin only)
 */
router.get('/users', authenticate, requireAdmin, async (req, res) => {
  try {
    const users = await getAllUsers()
    res.json({
      count: users.length,
      users
    })
  } catch (error) {
    logger.error('Get users error:', error.message)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get users'
    })
  }
})

/**
 * GET /api/auth/users/:identifier
 * Get user by ID or email (admin only)
 */
router.get('/users/:identifier', authenticate, requireAdmin, async (req, res) => {
  try {
    const { identifier } = req.params
    const user = await getUserByIdentifier(identifier)
    
    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      })
    }
    
    res.json({ user })
  } catch (error) {
    logger.error('Get user error:', error.message)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get user'
    })
  }
})

/**
 * PUT /api/auth/users/:identifier
 * Update user (admin only, cannot update root user)
 * Only root user can update roles
 */
router.put('/users/:identifier', authenticate, requireAdmin, async (req, res) => {
  try {
    const { identifier } = req.params
    const updates = req.body
    
    // Prevent password updates via this endpoint
    if (updates.password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Use /change-password endpoint to change password'
      })
    }
    
    // If role is being updated, only root can do this
    if (updates.role !== undefined) {
      const rootConfig = getRootUserConfig()
      const isRoot = req.user.isRoot || req.user.role === 'root' || req.user.email?.toLowerCase() === rootConfig.email.toLowerCase()
      
      if (!isRoot) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Only root user can update roles'
        })
      }
      
      // Validate role value (only 'user' and 'admin' are allowed)
      if (!['user', 'admin'].includes(updates.role)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: "Role must be 'user' or 'admin'"
        })
      }
    }
    
    // Update user
    const user = await updateUser(identifier, updates)
    
    res.json({
      message: 'User updated successfully',
      user
    })
  } catch (error) {
    logger.error('Update user error:', error.message)
    res.status(400).json({
      error: 'Failed to update user',
      message: error.message
    })
  }
})

/**
 * DELETE /api/auth/users/:identifier
 * Delete user (admin only, cannot delete root user)
 */
router.delete('/users/:identifier', authenticate, requireAdmin, async (req, res) => {
  try {
    const { identifier } = req.params
    
    // Prevent deleting self
    const currentUserId = req.user._id || req.user.id || req.user.email
    if (identifier === currentUserId || 
        identifier.toLowerCase() === currentUserId.toLowerCase()) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Cannot delete your own account'
      })
    }
    
    // Delete user
    await deleteUser(identifier)
    
    res.json({
      message: 'User deleted successfully'
    })
  } catch (error) {
    logger.error('Delete user error:', error.message)
    res.status(400).json({
      error: 'Failed to delete user',
      message: error.message
    })
  }
})

export default router

