/**
 * lib/performance.js
 *
 * Performance Optimization module for JARVIS.
 *
 * Features:
 *   - Lazy-load heavy modules
 *   - Optimize Framer Motion animations
 *   - Optimize Three.js rendering
 *   - Better caching
 *   - Better logging
 *   - Robust error recovery
 */

// Module cache for lazy loading
const moduleCache = new Map()

/**
 * Lazy-load a module.
 *
 * @param {string} name — module name
 * @param {function} loader — dynamic import function
 * @returns {Promise<any>}
 */
export async function lazyLoad(name, loader) {
  if (moduleCache.has(name)) {
    return moduleCache.get(name)
  }

  try {
    const module = await loader()
    moduleCache.set(name, module)
    return module
  } catch (error) {
    console.error(`[JARVIS] Failed to lazy load ${name}:`, error)
    throw error
  }
}

// Animation optimization presets
export const ANIMATION_PRESETS = {
  subtle: {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.2, ease: 'easeOut' },
  },
  smooth: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    transition: { duration: 0.3, ease: 'easeOut' },
  },
  fast: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { duration: 0.1 },
  },
}

// Three.js optimization settings
export const THREE_OPTIMIZATION = {
  antialias: true,
  alpha: true,
  powerPreference: 'high-performance',
  stencil: false,
  depth: false,
  preserveDrawingBuffer: false,
}

// Cache with TTL
class TTLCache {
  constructor(ttl = 60000) {
    this.cache = new Map()
    this.ttl = ttl
  }

  get(key) {
    const entry = this.cache.get(key)
    if (!entry) return null
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key)
      return null
    }
    return entry.value
  }

  set(key, value) {
    this.cache.set(key, { value, timestamp: Date.now() })
  }

  clear() {
    this.cache.clear()
  }
}

// Global caches
export const responseCache = new TTLCache(30000) // 30s cache for API responses
export const memoryCache = new TTLCache(60000) // 60s cache for memory queries

// Performance logging
const perfLog = []

export function logPerformance(label, start) {
  const duration = performance.now() - start
  perfLog.push({ label, duration, timestamp: Date.now() })
  if (perfLog.length > 100) {
    perfLog.shift()
  }
  return duration
}

export function getPerformanceLog() {
  return [...perfLog]
}

// Error recovery
export class ErrorBoundary extends Error {
  constructor(message, recoverable = true) {
    super(message)
    this.recoverable = recoverable
    this.timestamp = Date.now()
  }
}

export function withErrorRecovery(fn, fallback) {
  return async (...args) => {
    try {
      return await fn(...args)
    } catch (error) {
      console.error('[JARVIS] Error recovered:', error)
      if (fallback) {
        return fallback(error, ...args)
      }
      throw error
    }
  }
}

// Bundle optimization helper
export function getBundleStats() {
  return {
    cachedModules: moduleCache.size,
    performanceEntries: perfLog.length,
    memoryUsage: process.memoryUsage(),
  }
}

export { TTLCache }