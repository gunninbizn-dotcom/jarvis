/**
 * lib/piper.js
 *
 * Piper TTS service module.
 *
 * Preferred text-to-speech engine for JARVIS. Runs locally via a Piper TTS server.
 * Falls back to browser SpeechSynthesis API when Piper is unavailable.
 *
 * Setup:
 *   1. Install Piper: pip install piper-tts
 *   2. Download a model: piper --download en_US-less-medium.onnx
 *   3. Start server: python -m piper import --model en_US-less-medium.onnx --port 5000
 *   4. Set PIPER_SERVER_URL=http://localhost:5000 in .env
 *
 * API:
 *   - isPiperAvailable() → check if Piper server is running
 *   - speakPiper(text, options) → play text via Piper (returns Promise<void>)
 *   - stopPiper() → stop current speech
 */

const PIPER_SERVER_URL = process.env.PIPER_SERVER_URL || 'http://localhost:5000'

let audioContext = null
let currentSource = null
let currentBuffer = null

/**
 * Check if the Piper TTS server is available.
 * @returns {Promise<boolean>}
 */
export async function isPiperAvailable() {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 2000)
    const response = await fetch(`${PIPER_SERVER_URL}/`, {
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    return response.ok
  } catch {
    return false
  }
}

/**
 * Send text to the Piper TTS server and play the resulting audio.
 *
 * @param {string} text — text to speak
 * @param {object} options — { rate: number, voice: string }
 * @returns {Promise<void>}
 */
export async function speakPiper(text, options = {}) {
  if (!text || !text.trim()) return

  const { rate = 1.0, voice = 'default' } = options

  // Stop any currently playing audio
  stopPiper()

  const response = await fetch(`${PIPER_SERVER_URL}/api/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      voice,
      rate,
      length_scale: 1.0 / rate,
    }),
  })

  if (!response.ok) {
    throw new Error(`Piper TTS error ${response.status}`)
  }

  // The response is raw WAV audio
  const arrayBuffer = await response.arrayBuffer()

  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)()
  }

  currentBuffer = await audioContext.decodeAudioData(arrayBuffer)
  currentSource = audioContext.createBufferSource()
  currentSource.buffer = currentBuffer

  const gainNode = audioContext.createGain()
  gainNode.gain.value = 1.0

  currentSource.connect(gainNode)
  gainNode.connect(audioContext.destination)

  currentSource.start(0)
}

/**
 * Stop the currently playing Piper speech.
 */
export function stopPiper() {
  if (currentSource) {
    try {
      currentSource.stop()
    } catch {}
    currentSource = null
  }
  if (currentBuffer) {
    currentBuffer = null
  }
}

/**
 * Get available Piper voices.
 * @returns {Promise<string[]>}
 */
export async function getPiperVoices() {
  try {
    const response = await fetch(`${PIPER_SERVER_URL}/api/voices`)
    if (!response.ok) return []
    const data = await response.json()
    return data?.voices || []
  } catch {
    return []
  }
}

export { PIPER_SERVER_URL }
