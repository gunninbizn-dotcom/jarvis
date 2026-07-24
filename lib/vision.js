/**
 * lib/vision.js
 *
 * Vision module for JARVIS.
 *
 * Uses Gemini Vision for image understanding.
 *
 * Capabilities:
 *   - Screenshot analysis
 *   - Uploaded image analysis
 *   - OCR
 *   - Error message explanation
 *   - UI understanding
 *   - Chart interpretation
 *   - Code screenshot explanation
 */

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest'
const VISION_URL = `${GEMINI_BASE}/models/${MODEL}:generateContent`

/**
 * Analyze an image using Gemini Vision.
 *
 * @param {string} base64Image — base64-encoded image data (with or without data URL prefix)
 * @param {string} prompt — what to look for in the image
 * @returns {Promise<{success:boolean, analysis:string}>}
 */
export async function analyzeImage(base64Image, prompt = 'What is in this image?') {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY')
  }

  // Ensure base64 is properly formatted
  let imageData = base64Image
  if (base64Image.startsWith('data:')) {
    imageData = base64Image.split(',')[1]
  }

  const body = {
    system_instruction: {
      parts: [{
        text: 'You are a vision analysis assistant. Provide concise, accurate descriptions of images. Extract text, identify UI elements, explain charts, and help understand visual content.',
      }],
    },
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: 'image/jpeg',
              data: imageData,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 1000,
    },
  }

  const response = await fetch(`${VISION_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Vision API error ${response.status}: ${errorText}`)
  }

  const data = await response.json()
  const analysis = data?.candidates?.[0]?.content?.parts?.[0]?.text

  if (!analysis) {
    throw new Error('No analysis returned from Vision API')
  }

  return { success: true, analysis }
}

/**
 * Perform OCR on an image.
 *
 * @param {string} base64Image
 * @returns {Promise<{success:boolean, text:string}>}
 */
export async function performOCR(base64Image) {
  const result = await analyzeImage(base64Image, 'Extract all text from this image. Return only the extracted text, nothing else.')
  return { success: true, text: result.analysis }
}

/**
 * Explain an error message from a screenshot.
 *
 * @param {string} base64Image
 * @returns {Promise<{success:boolean, explanation:string}>}
 */
export async function explainError(base64Image) {
  const result = await analyzeImage(base64Image, 'This appears to be an error message. Explain what went wrong and suggest how to fix it.')
  return { success: true, explanation: result.analysis }
}

/**
 * Explain code from a screenshot.
 *
 * @param {string} base64Image
 * @returns {Promise<{success:boolean, explanation:string}>}
 */
export async function explainCode(base64Image) {
  const result = await analyzeImage(base64Image, 'This appears to be code. Explain what it does, identify any issues, and suggest improvements.')
  return { success: true, explanation: result.analysis }
}

/**
 * Interpret a chart or graph.
 *
 * @param {string} base64Image
 * @returns {Promise<{success:boolean, interpretation:string}>}
 */
export async function interpretChart(base64Image) {
  const result = await analyzeImage(base64Image, 'Interpret this chart or graph. Describe the trends, patterns, and key insights.')
  return { success: true, interpretation: result.analysis }
}

/**
 * Capture and analyze the current screen.
 *
 * @param {string} prompt — what to look for
 * @returns {Promise<{success:boolean, analysis:string}>}
 */
export async function analyzeScreen(prompt = 'Describe what is currently on the screen. Identify the main application, visible text, and UI elements.') {
  // This will be implemented in Phase 12
  // For now, return a placeholder
  return {
    success: false,
    message: 'Screen capture not yet available. Use /api/vision/analyze with an image instead.',
  }
}

export { VISION_URL }