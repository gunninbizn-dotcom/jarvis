/**
 * lib/plugins.js
 *
 * Plugin Architecture for JARVIS.
 *
 * Plugins are isolated modules that can be added without modifying the core assistant.
 *
 * Future plugins may include:
 *   - Weather
 *   - Calendar
 *   - GitHub
 *   - Gmail
 *   - Spotify
 *   - Slack
 *   - WhatsApp
 *   - Home Assistant
 *   - Smart Home Devices
 */

// Plugin registry
const pluginRegistry = new Map()

// Plugin metadata
const pluginMetadata = new Map()

/**
 * Register a plugin.
 *
 * @param {string} name — unique plugin name
 * @param {object} plugin — { init, handle, canHandle, metadata }
 * @returns {boolean}
 */
export function registerPlugin(name, plugin) {
  if (!name || typeof name !== 'string') {
    console.error('Plugin name is required')
    return false
  }

  if (!plugin || typeof plugin !== 'object') {
    console.error('Plugin object is required')
    return false
  }

  if (typeof plugin.handle !== 'function') {
    console.error('Plugin must have a handle function')
    return false
  }

  pluginRegistry.set(name, plugin)
  pluginMetadata.set(name, {
    name,
    version: plugin.version || '1.0.0',
    description: plugin.description || '',
    author: plugin.author || 'unknown',
    capabilities: plugin.capabilities || [],
    ...plugin.metadata,
  })

  console.log(`[JARVIS] Plugin registered: ${name}`)
  return true
}

/**
 * Unregister a plugin.
 *
 * @param {string} name
 * @returns {boolean}
 */
export function unregisterPlugin(name) {
  const removed = pluginRegistry.delete(name)
  pluginMetadata.delete(name)
  if (removed) {
    console.log(`[JARVIS] Plugin unregistered: ${name}`)
  }
  return removed
}

/**
 * Get a plugin by name.
 *
 * @param {string} name
 * @returns {object|null}
 */
export function getPlugin(name) {
  return pluginRegistry.get(name) || null
}

/**
 * Get all registered plugins.
 *
 * @returns {Array<object>}
 */
export function getAllPlugins() {
  return Array.from(pluginMetadata.values())
}

/**
 * Check if any plugin can handle a message.
 *
 * @param {string} message
 * @returns {object|null} — { plugin, name } or null
 */
export function findHandler(message) {
  for (const [name, plugin] of pluginRegistry.entries()) {
    if (plugin.canHandle && plugin.canHandle(message)) {
      return { plugin, name }
    }
  }
  return null
}

/**
 * Execute a plugin handler.
 *
 * @param {string} name
 * @param {string} message
 * @param {object} context
 * @returns {Promise<any>}
 */
export async function executePlugin(name, message, context = {}) {
  const plugin = pluginRegistry.get(name)
  if (!plugin) {
    throw new Error(`Plugin not found: ${name}`)
  }

  if (typeof plugin.handle !== 'function') {
    throw new Error(`Plugin ${name} has no handle function`)
  }

  return plugin.handle(message, context)
}

/**
 * Initialize all plugins.
 *
 * @returns {Promise<void>}
 */
export async function initializePlugins() {
  for (const [name, plugin] of pluginRegistry.entries()) {
    if (plugin.init && typeof plugin.init === 'function') {
      try {
        await plugin.init()
        console.log(`[JARVIS] Plugin initialized: ${name}`)
      } catch (error) {
        console.error(`[JARVIS] Plugin init failed: ${name}`, error)
      }
    }
  }
}

// ─── Built-in Plugin: Weather ───────────────────────────────────────────────

const weatherPlugin = {
  version: '1.0.0',
  description: 'Get current weather information',
  capabilities: ['weather', 'forecast'],
  canHandle: (msg) => /weather|temperature|forecast|rain|sunny|climate/i.test(msg),
  handle: async (msg, context) => {
    // Placeholder - would integrate with weather API
    return {
      success: true,
      message: 'Weather plugin not yet configured. Set WEATHER_API_KEY in .env.',
    }
  },
}

// ─── Built-in Plugin: System Info ───────────────────────────────────────────

const systemInfoPlugin = {
  version: '1.0.0',
  description: 'Get system information',
  capabilities: ['system', 'cpu', 'memory', 'network'],
  canHandle: (msg) => /cpu|memory|ram|disk|network|battery|status|info|temperature|uptime/i.test(msg),
  handle: async (msg, context) => {
    // This is handled by the existing /api/status endpoint
    return {
      success: true,
      message: 'Use /api/status for system information.',
    }
  },
}

// Auto-register built-in plugins
registerPlugin('weather', weatherPlugin)
registerPlugin('system-info', systemInfoPlugin)

export { pluginRegistry, pluginMetadata }
