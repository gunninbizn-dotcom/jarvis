/**
 * lib/screen.js
 *
 * Live Screen Understanding module for JARVIS.
 *
 * Capabilities:
 *   - Capture the active screen
 *   - Analyze the current application
 *   - Read visible text
 *   - Identify buttons
 *   - Help navigate software
 *   - Explain IDE errors
 *   - Guide the user through interfaces
 *
 * Optimized for low CPU usage.
 */

import { analyzeImage } from '@/lib/vision'

// Cache for screen analysis
let lastCapture = null
let lastAnalysis = null
let lastCaptureTime = 0
const CACHE_TTL = 5000 // 5 seconds

/**
 * Capture the current screen.
 * Uses native Node.js APIs on Windows.
 *
 * @returns {Promise<{success:boolean, image:string, timestamp:number}>}
 */
export async function captureScreen() {
  // On Windows, we can use PowerShell to capture the screen
  if (process.platform === 'win32') {
    try {
      const { exec } = require('child_process')
      const { promisify } = require('util')
      const execAsync = promisify(exec)

      // Use PowerShell to capture screen
      const psScript = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$screen = [System.Windows.Forms.Screen]::AllScreens
$bounds = $screen.Bounds
$bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($bounds.X, $bounds.Y, 0, 0, $bitmap.Size)
$bitmap.Save("$env:TEMP\\jarvis_screenshot.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bitmap.Dispose()
$graphics.Dispose()
[Convert]::ToBase64String([System.IO.File]::ReadAllBytes("$env:TEMP\\jarvis_screenshot.png"))
`

      const { stdout } = await execAsync(`powershell -Command "${psScript}"`)
      const image = stdout.trim()

      return {
        success: true,
        image,
        timestamp: Date.now(),
      }
    } catch (error) {
      throw new Error(`Screen capture failed: ${error.message}`)
    }
  }

  // Fallback: return placeholder
  return {
    success: false,
    message: 'Screen capture only supported on Windows.',
  }
}

/**
 * Analyze the current screen with caching.
 *
 * @param {string} prompt — what to look for
 * @param {object} options — { force: boolean } to bypass cache
 * @returns {Promise<{success:boolean, analysis:string, cached:boolean}>}
 */
export async function analyzeCurrentScreen(prompt, options = {}) {
  const now = Date.now()

  // Use cache if available and not expired
  if (!options.force && lastCapture && now - lastCaptureTime < CACHE_TTL) {
    return {
      success: true,
      analysis: lastAnalysis,
      cached: true,
    }
  }

  // Capture and analyze
  const capture = await captureScreen()
  if (!capture.success) {
    return capture
  }

  const analysis = await analyzeImage(capture.image, prompt)

  // Update cache
  lastCapture = capture.image
  lastAnalysis = analysis.analysis
  lastCaptureTime = now

  return {
    success: true,
    analysis: analysis.analysis,
    cached: false,
  }
}

/**
 * Identify the current application.
 *
 * @returns {Promise<{success:boolean, app:string}>}
 */
export async function identifyCurrentApp() {
  if (process.platform === 'win32') {
    try {
      const { exec } = require('child_process')
      const { promisify } = require('util')
      const execAsync = promisify(exec)

      const psScript = `
$process = Get-Process | Where-Object { $_.MainWindowHandle -ne 0 } | Sort-Object StartTime -Descending | Select-Object -First 1
$process.ProcessName
`
      const { stdout } = await execAsync(`powershell -Command "${psScript}"`)
      return {
        success: true,
        app: stdout.trim(),
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      }
    }
  }

  return {
    success: false,
    message: 'Application detection only supported on Windows.',
  }
}

/**
 * Read visible text on screen.
 *
 * @returns {Promise<{success:boolean, text:string}>}
 */
export async function readVisibleText() {
  const result = await analyzeCurrentScreen('Extract all visible text from this screen. Return as plain text.')
  if (result.success) {
    return {
      success: true,
      text: result.analysis,
    }
  }
  return result
}

/**
 * Identify buttons on screen.
 *
 * @returns {Promise<{success:boolean, buttons:Array}>}
 */
export async function identifyButtons() {
  const result = await analyzeCurrentScreen('Identify all clickable buttons on this screen. Return as JSON array with {name, x, y, description}.')
  if (result.success) {
    try {
      const buttons = JSON.parse(result.analysis)
      return {
        success: true,
        buttons,
      }
    } catch {
      return {
        success: true,
        buttons: [],
        raw: result.analysis,
      }
    }
  }
  return result
}

/**
 * Guide user through an interface.
 *
 * @param {string} goal — what the user wants to accomplish
 * @returns {Promise<{success:boolean, steps:Array}>}
 */
export async function guideUser(goal) {
  const result = await analyzeCurrentScreen(`The user wants to: "${goal}". Provide step-by-step instructions based on what you see on screen.`)
  if (result.success) {
    return {
      success: true,
      steps: result.analysis.split('\n').filter(s => s.trim()),
    }
  }
  return result
}

/**
 * Explain IDE errors.
 *
 * @returns {Promise<{success:boolean, explanation:string}>}
 */
export async function explainIDEError() {
  const result = await analyzeCurrentScreen('This appears to be an IDE. Identify any error messages, warnings, or issues. Explain what they mean and how to fix them.')
  if (result.success) {
    return {
      success: true,
      explanation: result.analysis,
    }
  }
  return result
}

export { CACHE_TTL }