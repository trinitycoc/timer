import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { ObjectId } from 'mongodb'
import { databaseService } from './databaseService.js'

// Get environment variables (no fallbacks)
const getJWTSecret = () => {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required')
  }
  return secret
}

const getJWTExpiresIn = () => {
  const expiresIn = process.env.JWT_EXPIRES_IN || process.env.JWT_EXPIRE
  if (!expiresIn) {
    throw new Error('JWT_EXPIRES_IN or JWT_EXPIRE environment variable is required')
  }
  return expiresIn
}

const getRootEmail = () => {
  const email = process.env.ROOT_EMAIL
  if (!email) {
    throw new Error('ROOT_EMAIL environment variable is required')
  }
  return email
}

const getRootUsername = () => {
  const username = process.env.ROOT_USERNAME
  if (!username) {
    throw new Error('ROOT_USERNAME environment variable is required')
  }
  return username
}

const getRootPassword = () => {
  const password = process.env.ROOT_PASSWORD
  if (!password) {
    throw new Error('ROOT_PASSWORD environment variable is required')
  }
  return password
}

/**
 * Root user configuration (loaded from environment variables)
 * This user is created in the database on startup and cannot be deleted via API
 */
export const getRootUserConfig = () => ({
  email: getRootEmail().toLowerCase().trim(),
  username: getRootUsername().trim(),
  password: getRootPassword(),
  role: 'root',
  isRoot: true
})

/**
 * Initialize root user in database
 * Called on server startup to ensure root user exists
 */
export const initializeRootUser = async () => {
  try {
    const rootConfig = getRootUserConfig()
    
    // Check if root user already exists
    const existingUser = await databaseService.findOne('users', { email: rootConfig.email })
    
    if (existingUser) {
      // Update existing root user to ensure it has correct properties
      const hashedPassword = await hashPassword(rootConfig.password)
      await databaseService.update('users', { email: rootConfig.email }, {
        username: rootConfig.username,
        password: hashedPassword,
        role: 'root',
        isRoot: true,
        updatedAt: new Date()
      })
      console.log('✅ Root user updated in database')
      return
    }
    
    // Create root user
    const hashedPassword = await hashPassword(rootConfig.password)
    const rootUserData = {
      email: rootConfig.email,
      username: rootConfig.username,
      password: hashedPassword,
      role: 'root',
      isRoot: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    const insertResult = await databaseService.insert('users', rootUserData)
    
    if (insertResult) {
      console.log('✅ Root user created in database')
    } else {
      console.error('⚠️ Failed to create root user in database')
    }
  } catch (error) {
    console.error('❌ Error initializing root user:', error.message)
    // Don't throw - allow server to start even if root user creation fails
  }
}

/**
 * Hash a password using bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
export const hashPassword = async (password) => {
  const saltRounds = 10
  return await bcrypt.hash(password, saltRounds)
}

/**
 * Compare a plain password with a hashed password
 * @param {string} password - Plain text password
 * @param {string} hashedPassword - Hashed password
 * @returns {Promise<boolean>} True if passwords match
 */
export const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword)
}

/**
 * Generate JWT token for a user
 * @param {Object} user - User object
 * @returns {string} JWT token
 */
export const generateToken = (user) => {
  const payload = {
    id: user._id || user.id,
    email: user.email,
    username: user.username,
    role: user.role
  }
  return jwt.sign(payload, getJWTSecret(), { expiresIn: getJWTExpiresIn() })
}

/**
 * Verify JWT token
 * @param {string} token - JWT token
 * @returns {Object|null} Decoded token payload or null if invalid
 */
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, getJWTSecret())
  } catch (error) {
    return null
  }
}

/**
 * Check if email matches root user
 * @param {string} email - Email to check
 * @returns {boolean} True if email matches root user
 */
export const isRootUser = (email) => {
  const rootConfig = getRootUserConfig()
  return email.toLowerCase() === rootConfig.email.toLowerCase()
}

/**
 * Register a new user
 * @param {string} email - User email
 * @param {string} password - Plain text password
 * @param {string} username - Username
 * @returns {Promise<Object>} Created user object (without password)
 */
export const registerUser = async (email, password, username) => {
  const normalizedEmail = email.toLowerCase().trim()
  const rootConfig = getRootUserConfig()
  
  // Check if root user email is being used
  if (isRootUser(normalizedEmail) || normalizedEmail === rootConfig.email.toLowerCase()) {
    throw new Error('This email is reserved for root user')
  }
  
  // Check if username matches root username
  if (username.trim().toLowerCase() === rootConfig.username.toLowerCase()) {
    throw new Error('This username is reserved for root user')
  }
  
  // Check if user already exists
  const existingUser = await databaseService.findOne('users', { email: normalizedEmail })
  if (existingUser) {
    throw new Error('User with this email already exists')
  }
  
  // Check if username already exists
  const existingUsername = await databaseService.findOne('users', { username: username.trim() })
  if (existingUsername) {
    throw new Error('Username already taken')
  }
  
  // Hash password
  const hashedPassword = await hashPassword(password)
  
  // Create user object
  const userData = {
    email: normalizedEmail,
    username: username.trim(),
    password: hashedPassword,
    role: 'user', // New users get 'user' role by default, root can update to 'admin'
    createdAt: new Date(),
    updatedAt: new Date(),
    isRoot: false
  }
  
  // Save to database
  const insertResult = await databaseService.insert('users', userData)
  
  if (!insertResult) {
    throw new Error('Failed to create user')
  }
  
  // Get the inserted user
  const insertedUser = await databaseService.findOne('users', { email: normalizedEmail })
  
  if (!insertedUser) {
    throw new Error('Failed to retrieve created user')
  }
  
  // Return user without password
  const { password: _, ...userWithoutPassword } = insertedUser
  return userWithoutPassword
}

/**
 * Authenticate user (login)
 * @param {string} email - User email
 * @param {string} password - Plain text password
 * @returns {Promise<Object>} User object and token (without password)
 */
export const loginUser = async (email, password) => {
  const normalizedEmail = email.toLowerCase().trim()
  const rootConfig = getRootUserConfig()
  
  // Check if root user
  if (isRootUser(normalizedEmail)) {
    // Get root user from database
    const rootUserInDb = await databaseService.findOne('users', { email: rootConfig.email })
    
    if (!rootUserInDb) {
      throw new Error('Root user not found. Please restart the server to initialize root user.')
    }
    
    // Verify root user password
    const isPasswordValid = await comparePassword(password, rootUserInDb.password)
    
    if (!isPasswordValid) {
      throw new Error('Invalid credentials')
    }
    
    // Return root user object
    const rootUserForToken = {
      _id: rootUserInDb._id,
      id: rootUserInDb._id.toString(),
      email: rootUserInDb.email,
      username: rootUserInDb.username,
      role: rootUserInDb.role
    }
    
    const token = generateToken(rootUserForToken)
    
    // Update last login
    await databaseService.update('users', { _id: rootUserInDb._id }, { 
      lastLogin: new Date(),
      updatedAt: new Date()
    })
    
    // Return user without password
    const { password: _, ...userWithoutPassword } = rootUserInDb
    return {
      user: userWithoutPassword,
      token
    }
  }
  
  // Find user in database
  const user = await databaseService.findOne('users', { email: normalizedEmail })
  if (!user) {
    throw new Error('Invalid credentials')
  }
  
  // Verify password
  const isPasswordValid = await comparePassword(password, user.password)
  if (!isPasswordValid) {
    throw new Error('Invalid credentials')
  }
  
  // Update last login
  await databaseService.update('users', { email: normalizedEmail }, { 
    lastLogin: new Date(),
    updatedAt: new Date()
  })
  
  // Generate token
  const token = generateToken(user)
  
  // Return user without password
  const { password: _, ...userWithoutPassword } = user
  return {
    user: userWithoutPassword,
    token
  }
}

/**
 * Get user by ID or email
 * @param {string} identifier - User ID or email
 * @returns {Promise<Object|null>} User object or null
 */
export const getUserByIdentifier = async (identifier) => {
  const rootConfig = getRootUserConfig()
  
  // Check if root user
  if (identifier === 'root' || identifier.toLowerCase() === rootConfig.email.toLowerCase() || identifier.toLowerCase() === rootConfig.username.toLowerCase()) {
    const rootUser = await databaseService.findOne('users', { email: rootConfig.email })
    if (rootUser) {
      const { password: _, ...userWithoutPassword } = rootUser
      return userWithoutPassword
    }
    // Fallback if not in DB (shouldn't happen if initialization ran)
    return {
      _id: 'root',
      email: rootConfig.email,
      username: rootConfig.username,
      role: 'root',
      isRoot: true,
      createdAt: new Date()
    }
  }
  
  // Try to find by ID (convert to ObjectId if it's a valid MongoDB ObjectId string)
  let user = null
  try {
    if (ObjectId.isValid(identifier)) {
      user = await databaseService.findOne('users', { _id: new ObjectId(identifier) })
    }
  } catch (error) {
    // Not a valid ObjectId, continue to email lookup
  }
  
  // Try to find by email if not found by ID
  if (!user) {
    user = await databaseService.findOne('users', { email: identifier.toLowerCase() })
  }
  
  if (!user) {
    return null
  }
  
  // Return user without password
  const { password: _, ...userWithoutPassword } = user
  return userWithoutPassword
}

/**
 * Get all users (for admin management)
 * @returns {Promise<Array>} Array of users (without passwords)
 */
export const getAllUsers = async () => {
  const users = await databaseService.find('users', {})
  
  // Remove passwords
  const usersWithoutPasswords = users.map(({ password: _, ...user }) => user)
  
  // Sort to ensure root user is first
  return usersWithoutPasswords.sort((a, b) => {
    if (a.isRoot || a.role === 'root') return -1
    if (b.isRoot || b.role === 'root') return 1
    return 0
  })
}

/**
 * Delete a user by ID or email
 * @param {string} identifier - User ID or email
 * @returns {Promise<boolean>} True if deleted
 */
export const deleteUser = async (identifier) => {
  const rootConfig = getRootUserConfig()
  
  // Prevent deletion of root user
  if (identifier === 'root' || isRootUser(identifier) || identifier.toLowerCase() === rootConfig.username.toLowerCase()) {
    throw new Error('Root user cannot be deleted')
  }
  
  // Try to delete by ID first (convert to ObjectId if valid)
  let deleted = false
  try {
    if (ObjectId.isValid(identifier)) {
      // Check if it's the root user by ID
      const user = await databaseService.findOne('users', { _id: new ObjectId(identifier) })
      if (user && (user.isRoot || user.email === rootConfig.email)) {
        throw new Error('Root user cannot be deleted')
      }
      deleted = await databaseService.delete('users', { _id: new ObjectId(identifier) })
    }
  } catch (error) {
    if (error.message.includes('cannot be deleted')) {
      throw error
    }
    // Not a valid ObjectId, continue to email lookup
  }
  
  // Try to delete by email if not found by ID
  if (!deleted) {
    deleted = await databaseService.delete('users', { email: identifier.toLowerCase() })
  }
  
  return deleted
}

/**
 * Update user (cannot change root user)
 * @param {string} identifier - User ID or email
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated user (without password)
 */
export const updateUser = async (identifier, updates) => {
  const rootConfig = getRootUserConfig()
  
  // Prevent updating root user
  if (identifier === 'root' || isRootUser(identifier) || identifier.toLowerCase() === rootConfig.username.toLowerCase()) {
    throw new Error('Root user cannot be updated')
  }
  
  // Remove password from updates (password changes should use separate endpoint)
  const { password, ...safeUpdates } = updates
  safeUpdates.updatedAt = new Date()
  
  // Try to find user first (by ID or email)
  let user = null
  try {
    if (ObjectId.isValid(identifier)) {
      user = await databaseService.findOne('users', { _id: new ObjectId(identifier) })
      if (user && (user.isRoot || user.email === rootConfig.email)) {
        throw new Error('Root user cannot be updated')
      }
    }
  } catch (error) {
    if (error.message.includes('cannot be updated')) {
      throw error
    }
    // Not a valid ObjectId, continue to email lookup
  }
  
  if (!user) {
    user = await databaseService.findOne('users', { email: identifier.toLowerCase() })
    if (user && (user.isRoot || user.email === rootConfig.email)) {
      throw new Error('Root user cannot be updated')
    }
  }
  
  if (!user) {
    throw new Error('User not found')
  }
  
  // Update user
  const updateResult = await databaseService.update('users', { _id: user._id }, safeUpdates)
  
  if (!updateResult) {
    throw new Error('Failed to update user')
  }
  
  // Get updated user
  const updatedUser = await databaseService.findOne('users', { _id: user._id })
  
  if (!updatedUser) {
    throw new Error('Failed to update user')
  }
  
  // Return user without password
  const { password: _, ...userWithoutPassword } = updatedUser
  return userWithoutPassword
}

/**
 * Change user password
 * @param {string} identifier - User ID or email
 * @param {string} oldPassword - Current password
 * @param {string} newPassword - New password
 * @returns {Promise<boolean>} True if password changed
 */
export const changePassword = async (identifier, oldPassword, newPassword) => {
  const rootConfig = getRootUserConfig()
  
  // Root user password is managed via environment variable
  if (identifier === 'root' || isRootUser(identifier) || identifier.toLowerCase() === rootConfig.username.toLowerCase()) {
    throw new Error('Root user password must be changed via environment variable (ROOT_PASSWORD)')
  }
  
  // Find user (by ID or email)
  let user = null
  try {
    if (ObjectId.isValid(identifier)) {
      user = await databaseService.findOne('users', { _id: new ObjectId(identifier) })
    }
  } catch (error) {
    // Not a valid ObjectId, continue to email lookup
  }
  
  if (!user) {
    user = await databaseService.findOne('users', { email: identifier.toLowerCase() })
  }
  
  if (!user) {
    throw new Error('User not found')
  }
  
  // Verify old password
  const isPasswordValid = await comparePassword(oldPassword, user.password)
  if (!isPasswordValid) {
    throw new Error('Current password is incorrect')
  }
  
  // Hash new password
  const hashedNewPassword = await hashPassword(newPassword)
  
  // Update password
  const updateResult = await databaseService.update('users', 
    { _id: user._id },
    { password: hashedNewPassword }
  )
  
  if (!updateResult) {
    throw new Error('Failed to update password')
  }
  
  return true
}
