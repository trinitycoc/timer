/**
 * Simple logging utility
 * In production, only logs errors and warnings
 * In development, logs everything
 */

const isProduction = process.env.NODE_ENV === 'production'

const logger = {
  error: (...args) => {
    console.error(...args)
  },
  
  warn: (...args) => {
    if (!isProduction) {
      console.warn(...args)
    } else {
      console.error(...args) // Warnings become errors in production
    }
  },
  
  info: (...args) => {
    if (!isProduction) {
      console.log(...args)
    }
  },
  
  log: (...args) => {
    if (!isProduction) {
      console.log(...args)
    }
  },
  
  debug: (...args) => {
    if (!isProduction) {
      console.log('[DEBUG]', ...args)
    }
  }
}

export default logger

