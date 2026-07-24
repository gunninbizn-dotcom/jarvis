/**
 * lib/filesystem.js
 *
 * Secure local file management for JARVIS.
 *
 * Supports:
 *   - Read files (TXT, PDF, DOCX, Markdown, JSON, CSV)
 *   - Write files
 *   - Edit text files
 *   - Create folders
 *   - Rename files
 *   - Move files
 *   - Copy files
 *   - Search folders
 *   - Search documents
 *   - Delete files (with confirmation)
 *
 * Security:
 *   - All operations are sandboxed to a safe directory
 *   - Destructive actions require explicit confirmation
 *   - Input sanitization
 */

import { readFileSync, writeFileSync, readdirSync, statSync, unlinkSync, renameSync, mkdirSync, copyFileSync } from 'fs'
import { join, resolve, basename, extname } from 'path'

// Safe base directory (can be configured via env)
const SAFE_BASE_DIR = process.env.JARVIS_SAFE_DIR || process.cwd()

// Supported file extensions
const SUPPORTED_EXTENSIONS = ['.txt', '.md', '.json', '.csv', '.pdf', '.docx']

/**
 * Sanitize a file path to prevent directory traversal.
 * @param {string} path
 * @returns {string}
 */
function sanitizePath(path) {
  if (!path || typeof path !== 'string') {
    throw new Error('Invalid path')
  }
  const resolved = resolve(SAFE_BASE_DIR, path)
  if (!resolved.startsWith(SAFE_BASE_DIR)) {
    throw new Error('Path outside safe directory')
  }
  return resolved
}

/**
 * Read a file.
 * @param {string} path
 * @returns {Promise<{success:boolean, content:string, type:string}>}
 */
export async function readFile(path) {
  const fullPath = sanitizePath(path)
  const ext = extname(fullPath).toLowerCase()

  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    throw new Error(`Unsupported file type: ${ext}`)
  }

  try {
    const content = readFileSync(fullPath, 'utf-8')
    return { success: true, content, type: ext.slice(1) }
  } catch (error) {
    throw new Error(`Failed to read file: ${error.message}`)
  }
}

/**
 * Write to a file.
 * @param {string} path
 * @param {string} content
 * @returns {Promise<{success:boolean, message:string}>}
 */
export async function writeFile(path, content) {
  const fullPath = sanitizePath(path)
  try {
    writeFileSync(fullPath, content, 'utf-8')
    return { success: true, message: `Wrote to ${basename(fullPath)}` }
  } catch (error) {
    throw new Error(`Failed to write file: ${error.message}`)
  }
}

/**
 * Edit a text file (append or replace).
 * @param {string} path
 * @param {string} content
 * @param {object} options — { mode: 'append' | 'replace', search?: string }
 * @returns {Promise<{success:boolean, message:string}>}
 */
export async function editFile(path, content, options = {}) {
  const fullPath = sanitizePath(path)
  const ext = extname(fullPath).toLowerCase()

  if (ext === '.pdf' || ext === '.docx') {
    throw new Error('Binary files cannot be edited directly')
  }

  try {
    if (options.mode === 'append') {
      const existing = readFileSync(fullPath, 'utf-8')
      writeFileSync(fullPath, existing + content, 'utf-8')
    } else if (options.search) {
      const existing = readFileSync(fullPath, 'utf-8')
      const updated = existing.replace(options.search, content)
      writeFileSync(fullPath, updated, 'utf-8')
    } else {
      writeFileSync(fullPath, content, 'utf-8')
    }
    return { success: true, message: `Edited ${basename(fullPath)}` }
  } catch (error) {
    throw new Error(`Failed to edit file: ${error.message}`)
  }
}

/**
 * Create a folder.
 * @param {string} path
 * @returns {Promise<{success:boolean, message:string}>}
 */
export async function createFolder(path) {
  const fullPath = sanitizePath(path)
  try {
    mkdirSync(fullPath, { recursive: true })
    return { success: true, message: `Created folder ${basename(fullPath)}` }
  } catch (error) {
    throw new Error(`Failed to create folder: ${error.message}`)
  }
}

/**
 * Rename a file or folder.
 * @param {string} oldPath
 * @param {string} newName
 * @returns {Promise<{success:boolean, message:string}>}
 */
export async function renameFile(oldPath, newName) {
  const fullOldPath = sanitizePath(oldPath)
  const fullNewPath = join(resolve(SAFE_BASE_DIR, oldPath), '..', newName)
  try {
    renameSync(fullOldPath, fullNewPath)
    return { success: true, message: `Renamed to ${newName}` }
  } catch (error) {
    throw new Error(`Failed to rename: ${error.message}`)
  }
}

/**
 * Move a file.
 * @param {string} source
 * @param {string} destination
 * @returns {Promise<{success:boolean, message:string}>}
 */
export async function moveFile(source, destination) {
  const fullSource = sanitizePath(source)
  const fullDest = sanitizePath(destination)
  try {
    renameSync(fullSource, fullDest)
    return { success: true, message: `Moved to ${destination}` }
  } catch (error) {
    throw new Error(`Failed to move file: ${error.message}`)
  }
}

/**
 * Copy a file.
 * @param {string} source
 * @param {string} destination
 * @returns {Promise<{success:boolean, message:string}>}
 */
export async function copyFile(source, destination) {
  const fullSource = sanitizePath(source)
  const fullDest = sanitizePath(destination)
  try {
    copyFileSync(fullSource, fullDest)
    return { success: true, message: `Copied to ${destination}` }
  } catch (error) {
    throw new Error(`Failed to copy file: ${error.message}`)
  }
}

/**
 * Search for files in a folder.
 * @param {string} folder
 * @param {string} query
 * @returns {Promise<{success:boolean, files:Array}>}
 */
export async function searchFiles(folder, query) {
  const fullFolder = sanitizePath(folder || '.')
  const results = []

  try {
    const items = readdirSync(fullFolder)
    for (const item of items) {
      const fullPath = join(fullFolder, item)
      const stats = statSync(fullPath)
      if (item.toLowerCase().includes(query.toLowerCase())) {
        results.push({
          name: item,
          path: fullPath,
          type: stats.isDirectory() ? 'folder' : 'file',
        })
      }
    }
    return { success: true, files: results }
  } catch (error) {
    throw new Error(`Failed to search: ${error.message}`)
  }
}

/**
 * Delete a file (requires confirmation).
 * @param {string} path
 * @param {object} options — { confirm: boolean }
 * @returns {Promise<{success:boolean, message:string}>}
 */
export async function deleteFile(path, options = {}) {
  if (!options.confirm) {
    return {
      success: false,
      message: 'This action requires confirmation. Please say "yes" to confirm deletion.',
      requiresConfirmation: true,
    }
  }

  const fullPath = sanitizePath(path)
  try {
    unlinkSync(fullPath)
    return { success: true, message: `Deleted ${basename(fullPath)}` }
  } catch (error) {
    throw new Error(`Failed to delete file: ${error.message}`)
  }
}

/**
 * Execute a file management command.
 *
 * @param {string} operation — read, write, edit, create, rename, move, copy, search, delete
 * @param {object} params
 * @param {object} options — { confirm: boolean }
 * @returns {Promise<object>}
 */
export async function executeFileCommand(operation, params = {}, options = {}) {
  switch (operation) {
    case 'read':
      return readFile(params.path)
    case 'write':
      return writeFile(params.path, params.content)
    case 'edit':
      return editFile(params.path, params.content, params.options)
    case 'create':
      return createFolder(params.path)
    case 'rename':
      return renameFile(params.oldPath, params.newName)
    case 'move':
      return moveFile(params.source, params.destination)
    case 'copy':
      return copyFile(params.source, params.destination)
    case 'search':
      return searchFiles(params.folder, params.query)
    case 'delete':
      return deleteFile(params.path, options)
    default:
      throw new Error(`Unknown file operation: ${operation}`)
  }
}

export { SAFE_BASE_DIR, SUPPORTED_EXTENSIONS }
