/**
 * lib/memory.js
 *
 * Memory & context management for JARVIS.
 *
 * Features:
 *   - Long-term memory persistence (MongoDB-backed)
 *   - Session-based context
 *   - Context window management (trim oldest first)
 *   - Memory pruning (oldest first)
 *   - Semantic search over past conversations
 *   - Context injection (relevant memories injected into prompt)
 */

const MAX_HISTORY_TOKENS = 3000
const MAX_MEMORY_ENTRIES = 500
const MAX_INJECTED_MEMORIES = 5

/**
 * Estimate token count for a text string (rough approximation: 1 token ≈ 4 chars).
 * @param {string} text
 * @returns {number}
 */
export function estimateTokens(text) {
  if (!text || typeof text !== 'string') return 0
  return Math.ceil(text.length / 4)
}

/**
 * Manage the context window by trimming oldest history entries
 * that exceed the token limit.
 *
 * @param {Array<{role:string,text:string}>} history
 * @param {number} maxTokens — maximum tokens to retain
 * @returns {Array<{role:string,text:string}>}
 */
export function manageContextWindow(history, maxTokens = MAX_HISTORY_TOKENS) {
  if (!Array.isArray(history) || history.length === 0) return []

  let total = 0
  const trimmed = []

  // Iterate from newest to oldest, keeping entries until we hit the limit
  for (let i = history.length - 1; i >= 0; i--) {
    const entry = history[i]
    const text = entry.text || entry.content || ''
    const tokens = estimateTokens(text)
    total += tokens
    if (total > maxTokens) break
    trimmed.unshift(entry)
  }

  return trimmed
}

/**
 * Search past conversation logs for relevant entries.
 * Uses simple keyword matching (semantic search would use embeddings).
 *
 * @param {Array<{sessionId:string,user:string,jarvis:string,ts:Date}>} logs
 * @param {string} query — search term
 * @param {number} limit — max results
 * @returns {Array<{sessionId:string,user:string,jarvis:string,ts:Date,score:number}>}
 */
export function searchMemories(logs, query, limit = MAX_INJECTED_MEMORIES) {
  if (!Array.isArray(logs) || !query || !query.trim()) return []

  const q = query.toLowerCase().trim()
  const qTokens = q.split(/\s+/)

  const scored = logs
    .map((log) => {
      const userText = (log.user || '').toLowerCase()
      const jarvisText = (log.jarvis || '').toLowerCase()
      const combined = `${userText} ${jarvisText}`

      let score = 0
      for (const token of qTokens) {
        if (token.length < 3) continue
        const regex = new RegExp(token, 'gi')
        const matches = combined.match(regex)
        if (matches) {
          score += matches.length * 10
        }
      }

      // Boost recent entries
      if (log.ts) {
        const ageHours = (Date.now() - new Date(log.ts).getTime()) / (1000 * 3600)
        score *= Math.max(0.1, 1 - ageHours / 168) // decay over 1 week
      }

      return { ...log, score }
    })
    .filter((log) => log.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  return scored
}

/**
 * Inject relevant memories into the system prompt.
 *
 * @param {string} systemPrompt
 * @param {Array<{user:string,jarvis:string}>} memories
 * @returns {string}
 */
export function injectMemories(systemPrompt, memories) {
  if (!memories || memories.length === 0) return systemPrompt

  const memoryText = memories
    .map((m) => `- User: ${m.user}\n  Jarvis: ${m.jarvis}`)
    .join('\n')

  return `${systemPrompt}

## Relevant Past Conversations
Here are relevant memories from past conversations:
${memoryText}

Use these memories to provide more personalized and contextually relevant responses.`
}

/**
 * Prune old memory entries (oldest first).
 *
 * @param {Array} entries
 * @param {number} maxEntries — maximum entries to keep
 * @returns {Array}
 */
export function pruneMemories(entries, maxEntries = MAX_MEMORY_ENTRIES) {
  if (!Array.isArray(entries) || entries.length <= maxEntries) return entries
  return entries.slice(-maxEntries)
}

/**
 * Build a memory context object for the Gemini request.
 * Combines context window management and memory injection.
 *
 * @param {Array<{role:string,text:string}>} history
 * @param {Array<{user:string,jarvis:string,ts:Date}>} logs
 * @param {string} message — current user message
 * @returns {{history:Array, systemPromptAdditions:string}}
 */
export function buildMemoryContext(history, logs, message) {
  const trimmedHistory = manageContextWindow(history)
  const relevantMemories = searchMemories(logs, message)
  const memoryPrompt = injectMemories('', relevantMemories)

  return {
    history: trimmedHistory,
    memoryPrompt,
    memories: relevantMemories,
  }
}

export { MAX_HISTORY_TOKENS, MAX_MEMORY_ENTRIES, MAX_INJECTED_MEMORIES }
