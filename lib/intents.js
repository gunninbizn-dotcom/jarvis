/**
 * lib/intents.js
 *
 * Intent Router — classifies every user request before deciding how to handle it.
 *
 * Supported intent categories:
 *   - conversation
 *   - desktop_command
 *   - browser_automation
 *   - file_management
 *   - memory_query
 *   - vision_request
 *   - search_request
 *   - system_information
 *
 * The router is designed to be easy to extend with new intents.
 * Add a new pattern to INTENT_PATTERNS and a handler to the INTENT_HANDLERS map.
 */

// ─── Intent Patterns ───────────────────────────────────────────────────────

const INTENT_PATTERNS = {
  desktop_command: [
    /open\s+(chrome|edge|firefox|vscode|cursor|code|chatgpt|calculator|calc|notepad|explorer|file\s*explorer|terminal|cmd|powershell|spotify|discord)/i,
    /launch\s+(chrome|edge|firefox|vscode|cursor|code|chatgpt|calculator|calc|notepad|explorer|terminal|spotify|discord)/i,
    /lock\s*screen/i,
    /\bsleep\b/i,
    /\brestart\b/i,
    /shut\s*down/i,
    /shutdown/i,
  ],
  browser_automation: [
    /search\s+(google|youtube|github|stackoverflow|stack\s*overflow)/i,
    /open\s+(gmail|linkedin|chatgpt|github|google|youtube)/i,
    /go to|navigate to|visit|browse to/i,
    /open\s+website|open\s+url/i,
  ],
  file_management: [
    /(read|open|write|edit|create|rename|move|copy|delete|remove).*file/i,
    /create.*folder|make.*directory/i,
    /find.*file|search.*file|where.*file/i,
    /(read|open).*document/i,
  ],
  memory_query: [
    /remember|recall|what did i|tell me about|do you remember/i,
    /what is my|what's my/i,
  ],
  vision_request: [
    /screenshot|image|photo|picture|see this|look at|explain this/i,
    /what is in this|what's in this/i,
    /ocr|read text/i,
  ],
  search_request: [
    /search|find|look up|what is|who is|when|where|how to|tell me about/i,
  ],
  system_information: [
    /cpu|memory|ram|disk|storage|network|battery|status|info|temperature|uptime/i,
    /system\s*info|system\s*status/i,
  ],
}

// ─── Parameter Extraction ──────────────────────────────────────────────────

const PARAM_EXTRACTORS = {
  desktop_command: (msg) => {
    const appMatch = msg.match(/open\s+(chrome|edge|firefox|vscode|cursor|code|chatgpt|calculator|calc|notepad|explorer|file\s*explorer|terminal|cmd|powershell|spotify|discord)/i)
    const actionMatch = msg.match(/(lock\s*screen|sleep|restart|shut\s*down|shutdown)/i)
    return {
      app: appMatch ? appMatch[1].toLowerCase().replace(/\s/g, '') : null,
      action: actionMatch ? actionMatch[1].toLowerCase() : 'open',
    }
  },
  browser_automation: (msg) => {
    const searchMatch = msg.match(/search\s+(google|youtube|github|stackoverflow|stack\s*overflow)\s*(?:for|about)?\s*(.*)/i)
    const openMatch = msg.match(/open\s+(gmail|linkedin|chatgpt|github|google|youtube)/i)
    const urlMatch = msg.match(/go to|navigate to|visit|browse to\s*(.*)/i)
    return {
      target: openMatch ? openMatch[1].toLowerCase() : null,
      query: searchMatch ? searchMatch[2].trim() : null,
      url: urlMatch ? urlMatch[1].trim() : null,
    }
  },
  file_management: (msg) => {
    const opMatch = msg.match(/(read|write|edit|create|rename|move|copy|delete|remove)/i)
    const pathMatch = msg.match(/(?:file|document|folder|directory)\s+(.+)/i)
    return {
      operation: opMatch ? opMatch[1].toLowerCase() : 'read',
      path: pathMatch ? pathMatch[1].trim() : null,
    }
  },
  memory_query: (msg) => {
    const queryMatch = msg.match(/(?:remember|recall|what did i|tell me about|what is my|what's my)\s*(.*)/i)
    return {
      query: queryMatch ? queryMatch[1].trim() : msg.trim(),
    }
  },
  vision_request: (msg) => {
    const targetMatch = msg.match(/(screenshot|image|photo|picture)/i)
    return {
      target: targetMatch ? targetMatch[1].toLowerCase() : 'screenshot',
    }
  },
  search_request: (msg) => {
    const queryMatch = msg.match(/(?:search|find|look up|what is|who is|when|where|how to|tell me about)\s*(.*)/i)
    return {
      query: queryMatch ? queryMatch[1].trim() : msg.trim(),
    }
  },
  system_information: (msg) => {
    const metricMatch = msg.match(/(cpu|memory|ram|disk|storage|network|battery|temperature|uptime)/i)
    return {
      metric: metricMatch ? metricMatch[1].toLowerCase() : 'all',
    }
  },
}

// ─── Intent Classification ─────────────────────────────────────────────────

/**
 * Classify a user message into an intent category.
 *
 * @param {string} message — the user's message
 * @returns {{intent: string, confidence: number, params: object}}
 */
export function classifyIntent(message) {
  if (!message || typeof message !== 'string') {
    return { intent: 'conversation', confidence: 0, params: {} }
  }

  const msg = message.toLowerCase().trim()

  // Check patterns in priority order (most specific first)
  const priority = ['desktop_command', 'browser_automation', 'file_management', 'vision_request', 'memory_query', 'system_information', 'search_request']

  for (const intent of priority) {
    const patterns = INTENT_PATTERNS[intent]
    if (!patterns) continue
    for (const pattern of patterns) {
      if (pattern.test(msg)) {
        const params = PARAM_EXTRACTORS[intent] ? PARAM_EXTRACTORS[intent](msg) : {}
        return { intent, confidence: 0.85, params }
      }
    }
  }

  // Default to conversation
  return { intent: 'conversation', confidence: 0.9, params: {} }
}

/**
 * Check if a message matches a specific intent.
 * @param {string} message
 * @param {string} intent
 * @returns {boolean}
 */
export function matchesIntent(message, intent) {
  return classifyIntent(message).intent === intent
}

/**
 * Get all available intent categories.
 * @returns {string[]}
 */
export function getAvailableIntents() {
  return Object.keys(INTENT_PATTERNS)
}

export { INTENT_PATTERNS, PARAM_EXTRACTORS }
