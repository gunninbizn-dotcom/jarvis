/**
 * lib/wakeword.js
 *
 * Wake word detection for JARVIS.
 *
 * Preferred: OpenWakeWord (offline, low CPU)
 * Fallback: Web Speech API keyword spotting (browser-based)
 *
 * Wake phrase: "Open Jarvis"
 *
 * Setup (OpenWakeWord):
 *   1. Install: pip install openwakeup
 *   2. Download model: python -c "import openwakeup; openwakeup.download('hey_jarvis')"
 *   3. Start server: python lib/wakeword_server.py
 *   4. Set WAKEWORD_SERVER_URL=http://localhost:5001 in .env
 *
 * The VoiceController will automatically use OpenWakeWord if the server is
 * available, otherwise falls back to Web Speech API keyword spotting.
 */

const WAKEWORD_SERVER_URL = process.env.WAKEWORD_SERVER_URL || 'http://localhost:5001'
const WAKE_PHRASE = 'open jarvis'

/**
 * Check if the OpenWakeWord server is available.
 * @returns {Promise<boolean>}
 */
export async function isWakeWordServerAvailable() {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 2000)
    const response = await fetch(`${WAKEWORD_SERVER_URL}/health`, {
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    return response.ok
  } catch {
    return false
  }
}

/**
 * Start wake word detection using the Web Speech API.
 * Listens continuously for the phrase "Open Jarvis".
 *
 * @param {function} onWakeWordDetected — callback when wake word is detected
 * @returns {{ stop: function } | null}
 */
export function startWakeWordDetection(onWakeWordDetected) {
  if (typeof window === 'undefined' || !window.SpeechRecognition) {
    return null
  }

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  const recognizer = new SR()
  recognizer.lang = 'en-US'
  recognizer.interimResults = false
  recognizer.continuous = true
  recognizer.maxAlternatives = 3

  let isRunning = true

  recognizer.onresult = (event) => {
    if (!isRunning) return
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript.toLowerCase().trim()
      if (transcript.includes(WAKE_PHRASE)) {
        onWakeWordDetected()
      }
    }
  }

  recognizer.onerror = () => {
    // Ignore errors — keep listening
  }

  recognizer.start()

  return {
    stop: () => {
      isRunning = false
      try { recognizer.stop() } catch {}
    },
  }
}

/**
 * Start wake word detection using OpenWakeWord server.
 * Streams audio from the microphone to the server for detection.
 *
 * @param {function} onWakeWordDetected — callback when wake word is detected
 * @returns {Promise<{ stop: function } | null>}
 */
export async function startWakeWordServerDetection(onWakeWordDetected) {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return null
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  })

  const audioContext = new (window.AudioContext || window.webkitAudioContext)({
    sampleRate: 16000,
  })
  const source = audioContext.createMediaStreamSource(stream)
  const processor = audioContext.createScriptProcessor(1024, 1, 1)

  source.connect(processor)
  processor.connect(audioContext.destination)

  let isRunning = true
  let isProcessing = false

  processor.onaudioprocess = (event) => {
    if (!isRunning || isProcessing) return
    isProcessing = true

    const input = event.inputBuffer.getChannelData(0)
    const audioData = Array.from(input)

    fetch(`${WAKEWORD_SERVER_URL}/detect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio: audioData }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.detected && isRunning) {
          onWakeWordDetected()
        }
      })
      .catch(() => {})
      .finally(() => {
        isProcessing = false
      })
  }

  return {
    stop: () => {
      isRunning = false
      try { processor.disconnect() } catch {}
      try { source.disconnect() } catch {}
      try { audioContext.close() } catch {}
      stream.getTracks().forEach((track) => track.stop())
    },
  }
}

export { WAKE_PHRASE, WAKEWORD_SERVER_URL }
