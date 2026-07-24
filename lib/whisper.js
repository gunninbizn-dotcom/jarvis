/**
 * lib/whisper.js
 *
 * Whisper.cpp fallback for speech recognition.
 *
 * Used when the Web Speech API is unavailable (e.g., Firefox, Safari).
 * Requires a local whisper.cpp server running on localhost:8080.
 *
 * Setup:
 *   1. Clone https://github.com/ggerganov/whisper.cpp
 *   2. Build with: make
 *   3. Run server: ./examples/server/whisper-server -m models/ggml-base.en.bin --port 8080
 *   4. Set WHISPER_SERVER_URL=http://localhost:8080 in .env
 *
 * The VoiceController will automatically use this fallback when
 * window.SpeechRecognition is not available.
 */

const WHISPER_SERVER_URL = process.env.WHISPER_SERVER_URL || 'http://localhost:8080'

/**
 * Check if the Whisper.cpp server is available.
 * @returns {Promise<boolean>}
 */
export async function isWhisperAvailable() {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3000)
    const response = await fetch(`${WHISPER_SERVER_URL}/health`, {
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    return response.ok
  } catch {
    return false
  }
}

/**
 * Send an audio blob to the Whisper.cpp server for transcription.
 * @param {Blob} audioBlob — WAV audio data
 * @returns {Promise<string>} — transcribed text
 */
export async function transcribeWithWhisper(audioBlob) {
  if (!audioBlob || audioBlob.size === 0) {
    throw new Error('No audio data provided')
  }

  const formData = new FormData()
  formData.append('file', audioBlob, 'audio.wav')
  formData.append('language', 'en')
  formData.append('task', 'transcribe')

  const response = await fetch(`${WHISPER_SERVER_URL}/inference`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Whisper server error ${response.status}: ${errorText}`)
  }

  const data = await response.json()
  const text = data?.text || data?.transcription || ''
  return text.trim()
}

/**
 * Record audio from the microphone and transcribe it using Whisper.cpp.
 * This is a fallback for browsers without Web Speech API support.
 *
 * @param {number} maxDurationMs — maximum recording duration (default: 15000ms)
 * @returns {Promise<string>} — transcribed text
 */
export async function recordAndTranscribe(maxDurationMs = 15000) {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('Microphone not available')
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  })

  const mediaRecorder = new MediaRecorder(stream)
  const chunks = []

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data)
    }
  }

  const audioContext = new (window.AudioContext || window.webkitAudioContext)()
  const source = audioContext.createMediaStreamSource(stream)
  const analyser = audioContext.createAnalyser()
  analyser.fftSize = 512
  source.connect(analyser)

  const startPromise = new Promise((resolve) => {
    mediaRecorder.start()
    resolve()
  })

  await startPromise

  const audioBlob = await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      mediaRecorder.ondataavailable = null
      resolve(new Blob(chunks, { type: 'audio/wav' }))
    }, maxDurationMs)

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data)
      }
    }

    mediaRecorder.onstop = () => {
      clearTimeout(timeout)
      resolve(new Blob(chunks, { type: 'audio/wav' }))
    }
  })

  mediaRecorder.stop()
  stream.getTracks().forEach((track) => track.stop())
  audioContext.close()

  return transcribeWithWhisper(audioBlob)
}

export { WHISPER_SERVER_URL }
