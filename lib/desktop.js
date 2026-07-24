/**
 * lib/desktop.js
 *
 * Desktop Automation module for JARVIS.
 *
 * Supports commands such as:
 *   - Open Chrome, Edge, Firefox, VS Code, Cursor, ChatGPT, Calculator, Notepad, File Explorer, Terminal, Spotify, Discord
 *   - Lock Screen, Sleep, Restart, Shutdown (with confirmation)
 *
 * Windows first. Designed for Linux/macOS extension.
 */

import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

// Windows app paths (can be extended)
const WINDOWS_APPS = {
  chrome: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  edge: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  firefox: 'C:\\Program Files\\Mozilla Firefox\\firefox.exe',
  vscode: 'C:\\Users\\%USERNAME%\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe',
  cursor: 'C:\\Users\\%USERNAME%\\AppData\\Local\\Programs\\Cursor\\Cursor.exe',
  chatgpt: 'C:\\Users\\%USERNAME%\\AppData\\Local\\Programs\\ChatGPT\\ChatGPT.exe',
  calculator: 'calc:',
  notepad: 'notepad:',
  explorer: 'explorer:',
  terminal: 'cmd:',
  powershell: 'powershell:',
  spotify: 'spotify:',
  discord: 'discord:',
}

// Desktop command handlers
const DESKTOP_HANDLERS = {
  open: async (app) => {
    if (!app) throw new Error('No application specified')
    const appKey = app.toLowerCase().replace(/\s/g, '')
    const appPath = WINDOWS_APPS[appKey]

    if (!appPath) {
      // Try to open via shell: URL or start menu
      try {
        await execAsync(`start ${app}`)
        return { success: true, message: `Opened ${app}` }
      } catch (error) {
        throw new Error(`Could not open ${app}`)
      }
    }

    try {
      await execAsync(`start "" "${appPath}"`)
      return { success: true, message: `Opened ${app}` }
    } catch (error) {
      throw new Error(`Failed to open ${app}: ${error.message}`)
    }
  },

  lock_screen: async () => {
    try {
      await execAsync('rundll32.exe user32.dll,LockWorkStation')
      return { success: true, message: 'Screen locked' }
    } catch (error) {
      throw new Error(`Failed to lock screen: ${error.message}`)
    }
  },

  sleep: async () => {
    try {
      await execAsync('rundll32.exe powrprof.dll,SetSuspendState 0,1,0')
      return { success: true, message: 'System entering sleep mode' }
    } catch (error) {
      throw new Error(`Failed to sleep: ${error.message}`)
    }
  },

  restart: async () => {
    try {
      await execAsync('shutdown /r /t 5')
      return { success: true, message: 'System will restart in 5 seconds' }
    } catch (error) {
      throw new Error(`Failed to restart: ${error.message}`)
    }
  },

  shutdown: async () => {
    try {
      await execAsync('shutdown /s /t 5')
      return { success: true, message: 'System will shut down in 5 seconds' }
    } catch (error) {
      throw new Error(`Failed to shut down: ${error.message}`)
    }
  },
}

/**
 * Execute a desktop command.
 *
 * @param {string} action — the action to perform (open, lock_screen, sleep, restart, shutdown)
 * @param {string} app — the application to open (for 'open' action)
 * @param {object} options — { confirm: boolean } for destructive actions
 * @returns {Promise<{success:boolean, message:string}>}
 */
export async function executeDesktopCommand(action, app, options = {}) {
  const handler = DESKTOP_HANDLERS[action]
  if (!handler) {
    throw new Error(`Unknown desktop action: ${action}`)
  }

  // Require confirmation for destructive actions
  if (['restart', 'shutdown', 'sleep'].includes(action) && !options.confirm) {
    return {
      success: false,
      message: `This action requires confirmation. Please say "yes" to confirm ${action}.`,
      requiresConfirmation: true,
    }
  }

  return handler(app)
}

/**
 * Get list of available desktop applications.
 * @returns {string[]}
 */
export function getAvailableApps() {
  return Object.keys(WINDOWS_APPS)
}

/**
 * Check if running on Windows.
 * @returns {boolean}
 */
export function isWindows() {
  return process.platform === 'win32'
}

export { WINDOWS_APPS, DESKTOP_HANDLERS }
