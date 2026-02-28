import { verifyToken, getUserByIdentifier, getRootUserConfig, isRootUser } from '../services/authService.js'

/**
 * Authentication middleware
 * Validates JWT token and attaches user to request
 */
export const authenticate = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No token provided'
      })
    }
    
    const token = authHeader.substring(7) // Remove 'Bearer ' prefix
    
    // Verify token
    const decoded = verifyToken(token)
    if (!decoded) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token'
      })
    }
    
    // Check if root user
    const rootConfig = getRootUserConfig()
    if (decoded.id === 'root' || isRootUser(decoded.email) || decoded.email?.toLowerCase() === rootConfig.email.toLowerCase()) {
      // Get root user from database
      const rootUser = await getUserByIdentifier('root')
      if (rootUser) {
        req.user = rootUser
        req.userToken = decoded
        return next()
      }
      // Fallback if root user not in DB
      req.user = {
        _id: 'root',
        email: rootConfig.email,
        username: rootConfig.username,
        role: 'root',
        isRoot: true
      }
      req.userToken = decoded
      return next()
    }
    
    // Get user from database
    const user = await getUserByIdentifier(decoded.id || decoded.email)
    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not found'
      })
    }
    
    // Attach user to request
    req.user = user
    req.userToken = decoded
    next()
  } catch (error) {
    logger.error('Authentication error:', error.message)
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication failed'
    })
  }
}

/**
 * Admin middleware (requires authentication)
 * Checks if user is admin or root
 */
export const requireAdmin = async (req, res, next) => {
  try {
    // First check authentication
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      })
    }
    
    // Check if user is admin or root
    const isAdmin = req.user.role === 'admin' || req.user.role === 'root' || req.user.isRoot
    if (!isAdmin) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required'
      })
    }
    
    next()
  } catch (error) {
    console.error('Admin check error:', error)
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Admin access required'
    })
  }
}

/**
 * Root user middleware (requires root access)
 * Only root user can access these routes
 */
export const requireRoot = async (req, res, next) => {
  try {
    // First check authentication
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      })
    }
    
    // Check if user is root
    const rootConfig = getRootUserConfig()
    const isRoot = req.user.isRoot || req.user.role === 'root' || req.user.email?.toLowerCase() === rootConfig.email.toLowerCase()
    if (!isRoot) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Root access required'
      })
    }
    
    next()
  } catch (error) {
    logger.error('Root check error:', error.message)
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Root access required'
    })
  }
}

