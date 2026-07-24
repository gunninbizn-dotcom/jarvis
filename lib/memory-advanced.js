/**
 * lib/memory-advanced.js
 *
 * Advanced Memory module for JARVIS.
 *
 * Structured memory for:
 *   - User Profile (name, preferred voice, language, applications)
 *   - Projects (current project, completed tasks, bugs, TODOs)
 *   - Preferences (coding style, favorite tools, frequently used apps)
 *   - Knowledge (important facts, long-term memories)
 *
 * Uses MongoDB for persistence.
 */

import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'

const uri = process.env.MONGO_URL
const dbName = process.env.DB_NAME || 'jarvis_db'

let clientPromise = null

if (uri) {
  if (!global._mongoClientPromise) {
    const client = new MongoClient(uri)
    global._mongoClientPromise = client.connect()
  }
  clientPromise = global._mongoClientPromise
}

async function getDb() {
  if (!clientPromise) {
    throw new Error('MongoDB is not configured. Set MONGO_URL to enable advanced memory.')
  }
  const c = await clientPromise
  return c.db(dbName)
}

// ─── User Profile ───────────────────────────────────────────────────────────

/**
 * Get user profile.
 * @returns {Promise<object>}
 */
export async function getUserProfile() {
  if (!clientPromise) {
    return {
      name: null,
      preferredVoice: 'default',
      preferredLanguage: 'en-US',
      preferredApplications: [],
    }
  }
  try {
    const db = await getDb()
    const profile = await db.collection('user_profile').findOne({ id: 'default' })
    return profile || {
      name: null,
      preferredVoice: 'default',
      preferredLanguage: 'en-US',
      preferredApplications: [],
    }
  } catch {
    return {
      name: null,
      preferredVoice: 'default',
      preferredLanguage: 'en-US',
      preferredApplications: [],
    }
  }
}

/**
 * Update user profile.
 * @param {object} updates
 * @returns {Promise<{success:boolean}>}
 */
export async function updateUserProfile(updates) {
  if (!clientPromise) {
    return { success: false, message: 'MongoDB not configured' }
  }
  try {
    const db = await getDb()
    await db.collection('user_profile').updateOne(
      { id: 'default' },
      { $set: { ...updates, updatedAt: new Date() } },
      { upsert: true }
    )
    return { success: true }
  } catch (error) {
    return { success: false, message: error.message }
  }
}

// ─── Projects ───────────────────────────────────────────────────────────────

/**
 * Get all projects.
 * @returns {Promise<Array>}
 */
export async function getProjects() {
  if (!clientPromise) return []
  try {
    const db = await getDb()
    const projects = await db.collection('projects').find({}).toArray()
    return projects.map(p => ({ ...p, _id: undefined }))
  } catch {
    return []
  }
}

/**
 * Get current project.
 * @returns {Promise<object|null>}
 */
export async function getCurrentProject() {
  if (!clientPromise) return null
  try {
    const db = await getDb()
    const project = await db.collection('projects').findOne({ current: true })
    return project ? { ...project, _id: undefined } : null
  } catch {
    return null
  }
}

/**
 * Create a project.
 * @param {string} name
 * @param {string} description
 * @returns {Promise<{success:boolean, id:string}>}
 */
export async function createProject(name, description = '') {
  if (!clientPromise) {
    return { success: false, message: 'MongoDB not configured' }
  }
  try {
    const db = await getDb()
    const id = uuidv4()
    await db.collection('projects').insertOne({
      id,
      name,
      description,
      current: false,
      tasks: [],
      bugs: [],
      todos: [],
      createdAt: new Date(),
    })
    return { success: true, id }
  } catch (error) {
    return { success: false, message: error.message }
  }
}

/**
 * Add a task to a project.
 * @param {string} projectId
 * @param {string} task
 * @returns {Promise<{success:boolean}>}
 */
export async function addProjectTask(projectId, task) {
  if (!clientPromise) {
    return { success: false, message: 'MongoDB not configured' }
  }
  try {
    const db = await getDb()
    await db.collection('projects').updateOne(
      { id: projectId },
      { $push: { tasks: { id: uuidv4(), text: task, completed: false, createdAt: new Date() } } }
    )
    return { success: true }
  } catch (error) {
    return { success: false, message: error.message }
  }
}

/**
 * Add a TODO to a project.
 * @param {string} projectId
 * @param {string} todo
 * @returns {Promise<{success:boolean}>}
 */
export async function addProjectTodo(projectId, todo) {
  if (!clientPromise) {
    return { success: false, message: 'MongoDB not configured' }
  }
  try {
    const db = await getDb()
    await db.collection('projects').updateOne(
      { id: projectId },
      { $push: { todos: { id: uuidv4(), text: todo, completed: false, createdAt: new Date() } } }
    )
    return { success: true }
  } catch (error) {
    return { success: false, message: error.message }
  }
}

// ─── Preferences ──────────────────────────────────────────────────────────

/**
 * Get user preferences.
 * @returns {Promise<object>}
 */
export async function getPreferences() {
  if (!clientPromise) {
    return {
      codingStyle: 'clean',
      favoriteTools: [],
      frequentlyUsedApps: [],
    }
  }
  try {
    const db = await getDb()
    const prefs = await db.collection('preferences').findOne({ id: 'default' })
    return prefs || {
      codingStyle: 'clean',
      favoriteTools: [],
      frequentlyUsedApps: [],
    }
  } catch {
    return {
      codingStyle: 'clean',
      favoriteTools: [],
      frequentlyUsedApps: [],
    }
  }
}

/**
 * Update preferences.
 * @param {object} updates
 * @returns {Promise<{success:boolean}>}
 */
export async function updatePreferences(updates) {
  if (!clientPromise) {
    return { success: false, message: 'MongoDB not configured' }
  }
  try {
    const db = await getDb()
    await db.collection('preferences').updateOne(
      { id: 'default' },
      { $set: { ...updates, updatedAt: new Date() } },
      { upsert: true }
    )
    return { success: true }
  } catch (error) {
    return { success: false, message: error.message }
  }
}

// ─── Knowledge ────────────────────────────────────────────────────────────

/**
 * Add a knowledge fact.
 * @param {string} fact
 * @param {string} category
 * @returns {Promise<{success:boolean, id:string}>}
 */
export async function addKnowledge(fact, category = 'general') {
  if (!clientPromise) {
    return { success: false, message: 'MongoDB not configured' }
  }
  try {
    const db = await getDb()
    const id = uuidv4()
    await db.collection('knowledge').insertOne({
      id,
      fact,
      category,
      createdAt: new Date(),
    })
    return { success: true, id }
  } catch (error) {
    return { success: false, message: error.message }
  }
}

/**
 * Search knowledge.
 * @param {string} query
 * @param {number} limit
 * @returns {Promise<Array>}
 */
export async function searchKnowledge(query, limit = 10) {
  if (!clientPromise) return []
  try {
    const db = await getDb()
    const results = await db
      .collection('knowledge')
      .find({ fact: { $regex: query, $options: 'i' } })
      .limit(limit)
      .toArray()
    return results.map(r => ({ ...r, _id: undefined }))
  } catch {
    return []
  }
}

/**
 * Get all knowledge.
 * @returns {Promise<Array>}
 */
export async function getAllKnowledge() {
  if (!clientPromise) return []
  try {
    const db = await getDb()
    const results = await db.collection('knowledge').find({}).toArray()
    return results.map(r => ({ ...r, _id: undefined }))
  } catch {
    return []
  }
}

// ─── Memory Summary ─────────────────────────────────────────────────────────

/**
 * Get a summary of all memory.
 * @returns {Promise<object>}
 */
export async function getMemorySummary() {
  const [profile, projects, preferences, knowledge] = await Promise.all([
    getUserProfile(),
    getProjects(),
    getPreferences(),
    getAllKnowledge(),
  ])

  return {
    profile,
    projects,
    preferences,
    knowledgeCount: knowledge.length,
  }
}