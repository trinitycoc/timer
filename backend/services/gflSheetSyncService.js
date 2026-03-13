/**
 * GFL Sheet Sync Service
 * Fetches GFL clan list from Google Sheets CSV and upserts into the database.
 * Columns: D = Clan Tag (index 3), E = Clan Name (4), G = Status (6), J = vary (9)
 */

import { upsertGFLClanFromSheet } from './clanManagementService.js'
import { isDatabaseConnected } from './databaseService.js'
import logger from '../utils/logger.js'

const COL_TAG = 3
const COL_NAME = 4
const COL_STATUS = 6
const COL_VARY = 9

/**
 * Parse a single CSV line respecting quoted fields
 */
function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if ((c === ',' && !inQuotes) || c === '\r') {
      result.push(current.trim())
      current = ''
    } else {
      current += c
    }
  }
  result.push(current.trim())
  return result
}

/**
 * Fetch CSV from Google Sheets and return raw text
 */
async function fetchSheetCSV() {
  const url = process.env.GFL_SHEET_CSV_URL
  if (!url || typeof url !== 'string' || !url.trim()) {
    throw new Error('GFL_SHEET_CSV_URL is not set. Add it to your .env file.')
  }
  const res = await fetch(url.trim(), {
    headers: { 'Accept': 'text/csv' }
  })
  if (!res.ok) {
    throw new Error(`Sheet fetch failed: ${res.status} ${res.statusText}`)
  }
  return res.text()
}

/**
 * Parse CSV text into rows (array of column arrays)
 */
function parseCSV(csvText) {
  const lines = csvText.split('\n').filter((line) => line.trim())
  if (lines.length < 2) return []
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i])
    rows.push(cols)
  }
  return rows
}

/**
 * Normalize clan tag: ensure # prefix and valid format
 */
function normalizeTag(value) {
  if (!value || typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed === '#VALUE!' || trimmed.toUpperCase() === '#VALUE!') return null
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`
}

/**
 * Run sync: fetch sheet, parse, upsert each row into gflClans
 */
export async function syncGFLClansFromSheet() {
  if (!isDatabaseConnected()) {
    logger.warn('GFL sheet sync skipped: database not connected')
    return { synced: 0, skipped: 0, errors: ['Database not connected'] }
  }

  logger.info('GFL sheet sync: fetching CSV from sheet...')
  let synced = 0
  let skipped = 0
  const errors = []

  try {
    const csvText = await fetchSheetCSV()
    const rows = parseCSV(csvText)
    logger.info(`GFL sheet sync: ${rows.length} rows from sheet, upserting to database...`)

    for (const row of rows) {
      const tag = normalizeTag(row[COL_TAG])
      if (!tag) {
        skipped++
        continue
      }
      const name = row[COL_NAME] != null ? String(row[COL_NAME]).trim() : ''
      const status = row[COL_STATUS] != null ? String(row[COL_STATUS]).trim() || 'Active' : 'Active'
      const vary = row[COL_VARY] != null ? String(row[COL_VARY]).trim() : ''

      try {
        await upsertGFLClanFromSheet({ tag, name, status, vary })
        synced++
      } catch (err) {
        errors.push(`${tag}: ${err.message}`)
        logger.warn(`GFL sheet sync row error [${tag}]:`, err.message)
      }
    }

    if (synced > 0 || errors.length > 0) {
      logger.info(`GFL sheet sync: ${synced} upserted, ${skipped} skipped, ${errors.length} errors`)
    }
  } catch (err) {
    logger.error('GFL sheet sync failed:', err.message)
    errors.push(err.message)
  }

  return { synced, skipped, errors }
}

export default { syncGFLClansFromSheet }
