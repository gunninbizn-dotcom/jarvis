/**
 * lib/browser.js
 *
 * Browser Automation module for JARVIS.
 *
 * Uses Playwright for cross-browser automation.
 *
 * Capabilities:
 *   - Open websites
 *   - Search Google, YouTube, GitHub, Stack Overflow
 *   - Open Gmail, LinkedIn, ChatGPT, GitHub
 *   - Navigate pages
 *   - Fill forms when appropriate
 *
 * Sensitive actions require user confirmation.
 */

import { chromium } from 'playwright'

let browser = null
let context = null

/**
 * Get or create a browser instance.
 */
async function getBrowser() {
  if (!browser) {
    browser = await chromium.launch({ headless: false })
  }
  return browser
}

/**
 * Get or create a browser context.
 */
async function getContext() {
  if (!context) {
    const b = await getBrowser()
    context = await b.newContext({ viewport: { width: 1280, height: 720 } })
  }
  return context
}

// Search URLs
const SEARCH_URLS = {
  google: 'https://www.google.com/search?q=',
  youtube: 'https://www.youtube.com/results?search_query=',
  github: 'https://github.com/search?q=',
  stackoverflow: 'https://stackoverflow.com/search?q=',
}

// Direct URLs
const DIRECT_URLS = {
  gmail: 'https://mail.google.com',
  linkedin: 'https://www.linkedin.com',
  chatgpt: 'https://chat.openai.com',
  github: 'https://github.com',
}

/**
 * Open a URL in the browser.
 * @param {string} url
 * @returns {Promise<{success:boolean, message:string}>}
 */
export async function openUrl(url) {
  try {
    const ctx = await getContext()
    const page = await ctx.newPage()
    await page.goto(url)
    return { success: true, message: `Opened ${url}` }
  } catch (error) {
    throw new Error(`Failed to open URL: ${error.message}`)
  }
}

/**
 * Search a query on a specific platform.
 * @param {string} platform — google, youtube, github, stackoverflow
 * @param {string} query
 * @returns {Promise<{success:boolean, message:string}>}
 */
export async function search(platform, query) {
  const baseUrl = SEARCH_URLS[platform]
  if (!baseUrl) {
    throw new Error(`Unknown search platform: ${platform}`)
  }
  const url = `${baseUrl}${encodeURIComponent(query)}`
  return openUrl(url)
}

/**
 * Open a specific website.
 * @param {string} site — gmail, linkedin, chatgpt, github
 * @returns {Promise<{success:boolean, message:string}>}
 */
export async function openSite(site) {
  const url = DIRECT_URLS[site]
  if (!url) {
    throw new Error(`Unknown site: ${site}`)
  }
  return openUrl(url)
}

/**
 * Execute a browser automation command.
 *
 * @param {string} action — search, open
 * @param {object} params — { platform, query, site, url }
 * @param {object} options — { confirm: boolean }
 * @returns {Promise<{success:boolean, message:string}>}
 */
export async function executeBrowserCommand(action, params = {}, options = {}) {
  // Require confirmation for sensitive actions
  if (options.confirmRequired && !options.confirm) {
    return {
      success: false,
      message: 'This action requires confirmation. Please say "yes" to confirm.',
      requiresConfirmation: true,
    }
  }

  if (action === 'search') {
    return search(params.platform, params.query)
  }

  if (action === 'open') {
    if (params.site) {
      return openSite(params.site)
    }
    if (params.url) {
      return openUrl(params.url)
    }
    throw new Error('No site or URL specified')
  }

  throw new Error(`Unknown browser action: ${action}`)
}

/**
 * Close the browser instance.
 */
export async function closeBrowser() {
  if (context) {
    await context.close()
    context = null
  }
  if (browser) {
    await browser.close()
    browser = null
  }
}

export { SEARCH_URLS, DIRECT_URLS }
