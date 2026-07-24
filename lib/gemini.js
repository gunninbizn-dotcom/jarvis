/**
 * lib/gemini.js
 *
 * Gemini conversation pipeline service.
 *
 * Responsibilities:
 *   - Build proper Gemini request payloads (system_instruction + history + user message)
 *   - Non-streaming reply (createGeminiReply)
 *   - Streaming reply as JSON-ND ReadableStream (createGeminiStreamReply)
 *   - Normalize client-side history ({role:'user'|'jarvis', text}) to Gemini format
 *   - Never expose the API key to the browser — this module runs server-side only.
 */

const SYSTEM_PROMPT = `You are Jarvis, a premium AI operating system assistant. You speak naturally, stay concise, and avoid hallucinating live system telemetry. If the user asks for current real-world facts, state that you need a verified source or external information. Keep the tone futuristic, helpful, and professional.`

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest'
const GENERATE_URL = `${GEMINI_BASE}/models/${MODEL}:generateContent`
const STREAM_URL = `${GEMINI_BASE}/models/${MODEL}:streamGenerateContent?alt=sse`

/**
 * Normalise client-side history into Gemini contents array.
 * Client items: { role: 'user' | 'jarvis', text: string }
 * Gemini items: { role: 'user' | 'model', parts: [{ text: string }] }
 *
 * @param {Array<{role:string,text:string}>} history
 * @returns {Array<{role:string,parts:Array<{text:string}>}>}
 */
export function normalizeHistory(history) {
  if (!Array.isArray(history)) return []
  return history
    .filter(
      (item) =>
        item &&
        typeof item.role === 'string' &&
        (typeof item.text === 'string' || typeof item.content === 'string')
    )
    .map((item) => ({
      role: item.role === 'jarvis' ? 'model' : item.role,
      parts: [{ text: item.text ?? item.content }],
    }))
}

/**
 * Build the full Gemini request body including system instruction, history, and user message.
 *
 * @param {Array<{role:string,text:string}>} history
 * @param {string} message
 * @returns {{system_instruction:object, contents:Array, generationConfig:object}}
 */
export function buildRequestBody(history, message, systemPromptOverride) {
  const contents = [
    ...normalizeHistory(history),
    { role: 'user', parts: [{ text: message }] },
  ]

  return {
    system_instruction: { parts: [{ text: systemPromptOverride || SYSTEM_PROMPT }] },
    contents,
    generationConfig: {
      temperature: 0.35,
      maxOutputTokens: 700,
      topP: 0.95,
      topK: 40,
    },
  }
}

/**
 * Non-streaming Gemini reply.
 *
 * @param {Array<{role:string,text:string}>} history
 * @param {string} message
 * @returns {Promise<string>} — the assistant's reply text
 */
export async function createGeminiReply(history, message, systemPromptOverride) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY. Please set GEMINI_API_KEY in your environment variables.')
  }

  const body = buildRequestBody(history, message, systemPromptOverride)

  const response = await fetch(`${GENERATE_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Gemini API error ${response.status}: ${errorText}`)
  }

  const data = await response.json()
  const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text

  if (typeof reply !== 'string' || !reply.trim()) {
    throw new Error('Gemini returned no assistant content.')
  }

  return reply.trim()
}

/**
 * Streaming Gemini reply.
 *
 * Returns a ReadableStream that emits JSON-ND lines (one JSON object per line):
 *   { "sessionId": "..." }   — emitted once at the start
 *   { "delta": "..." }        — emitted for each text chunk
 *   { "done": true }          — emitted at the end
 *
 * This format is already understood by the VoiceController client.
 *
 * @param {Array<{role:string,text:string}>} history
 * @param {string} message
 * @param {string} sessionId
 * @returns {Promise<ReadableStream>}
 */
export async function createGeminiStreamReply(history, message, sessionId, systemPromptOverride) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY. Please set GEMINI_API_KEY in your environment variables.')
  }

  const body = buildRequestBody(history, message, systemPromptOverride)

  const response = await fetch(`${STREAM_URL}&key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Gemini API error ${response.status}: ${errorText}`)
  }

  const encoder = new TextEncoder()
  let assistantText = ''
  let reader = null

  const stream = new ReadableStream({
    async start(controller) {
      // Emit session ID first
      controller.enqueue(encoder.encode(JSON.stringify({ sessionId }) + '\n'))

      reader = response.body?.getReader()
      if (!reader) {
        controller.enqueue(encoder.encode(JSON.stringify({ delta: 'Sorry, the response stream is unavailable.' }) + '\n'))
        controller.enqueue(encoder.encode(JSON.stringify({ done: true }) + '\n'))
        controller.close()
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() // keep incomplete line in buffer

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed) continue

            // SSE format: "data: {...}"
            let jsonStr = trimmed
            if (jsonStr.startsWith('data:')) {
              jsonStr = jsonStr.slice(5).trim()
            }

            if (!jsonStr || jsonStr === '[DONE]') continue

            let parsed
            try {
              parsed = JSON.parse(jsonStr)
            } catch {
              continue
            }

            // Extract text from Gemini streaming response
            const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text
            if (typeof text === 'string' && text.length > 0) {
              assistantText += text
              controller.enqueue(encoder.encode(JSON.stringify({ delta: text }) + '\n'))
            }
          }
        }

        // Flush any remaining buffer
        if (buffer.trim()) {
          let jsonStr = buffer.trim()
          if (jsonStr.startsWith('data:')) {
            jsonStr = jsonStr.slice(5).trim()
          }
          if (jsonStr && jsonStr !== '[DONE]') {
            try {
              const parsed = JSON.parse(jsonStr)
              const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text
              if (typeof text === 'string' && text.length > 0) {
                assistantText += text
                controller.enqueue(encoder.encode(JSON.stringify({ delta: text }) + '\n'))
              }
            } catch {
              // ignore
            }
          }
        }

        controller.enqueue(encoder.encode(JSON.stringify({ done: true }) + '\n'))
      } catch (error) {
        controller.error(error)
      } finally {
        controller.close()
      }
    },

    cancel() {
      reader?.cancel().catch(() => {})
    },
  })

  return stream
}

export { SYSTEM_PROMPT }
