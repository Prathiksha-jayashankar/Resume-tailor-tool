/**
 * SessionManager service for the Resume Tailor Tool.
 * Manages ephemeral in-memory sessions with 30-minute TTL.
 * All user-provided content is purged on session end (timeout, explicit delete, or disconnect).
 *
 * Requirements: 9.2, 9.3, 9.4
 */

import { randomUUID } from 'crypto'
import type { SessionData } from './types'
import { SESSION_TIMEOUT_MS } from './constants'

/** Interval between cleanup sweeps (60 seconds) */
const CLEANUP_INTERVAL_MS = 60_000

/**
 * SessionManager stores sessions in memory and handles lifecycle:
 * - create: allocate a new session
 * - get: retrieve session by ID (updates lastActivityAt)
 * - update: merge partial data into session
 * - delete: securely wipe all user content and remove session
 * - isExpired: check if session has exceeded TTL
 * - cleanup: purge all expired sessions
 */
class SessionManager {
  private sessions: Map<string, SessionData> = new Map()
  private cleanupInterval: ReturnType<typeof setInterval> | null = null

  constructor() {
    this.startCleanupInterval()
  }

  /**
   * Create a new session with a unique ID.
   * Returns the created SessionData.
   */
  createSession(): SessionData {
    const now = Date.now()
    const session: SessionData = {
      id: randomUUID(),
      createdAt: now,
      lastActivityAt: now,
      parsedResume: null,
      parsedJobDescription: null,
      analysisResult: null,
      tailoredResume: null,
      privacyAcknowledged: false,
    }
    this.sessions.set(session.id, session)
    return session
  }

  /**
   * Retrieve a session by ID.
   * Returns the session if found and not expired, otherwise undefined.
   * Updates lastActivityAt on access.
   */
  getSession(id: string): SessionData | undefined {
    const session = this.sessions.get(id)
    if (!session) return undefined
    if (this.isExpired(session)) {
      this.deleteSession(id)
      return undefined
    }
    session.lastActivityAt = Date.now()
    return session
  }

  /**
   * Update a session with partial data.
   * Returns the updated session or undefined if not found/expired.
   */
  updateSession(id: string, data: Partial<Omit<SessionData, 'id' | 'createdAt'>>): SessionData | undefined {
    const session = this.sessions.get(id)
    if (!session) return undefined
    if (this.isExpired(session)) {
      this.deleteSession(id)
      return undefined
    }
    Object.assign(session, data, { lastActivityAt: Date.now() })
    return session
  }

  /**
   * Delete a session, securely wiping all user-provided content from memory.
   * Defense in depth: null out all data fields before removing the map entry.
   */
  deleteSession(id: string): boolean {
    const session = this.sessions.get(id)
    if (!session) return false

    // Null out all user-provided content fields (defense in depth)
    session.parsedResume = null
    session.parsedJobDescription = null
    session.analysisResult = null
    session.tailoredResume = null

    // Remove from map
    this.sessions.delete(id)
    return true
  }

  /**
   * Check if a session has exceeded the 30-minute TTL.
   */
  isExpired(session: SessionData): boolean {
    return session.lastActivityAt + SESSION_TIMEOUT_MS < Date.now()
  }

  /**
   * Run cleanup sweep: delete all expired sessions.
   * Returns the number of sessions purged.
   */
  cleanup(): number {
    let purgedCount = 0
    for (const [id, session] of this.sessions) {
      if (this.isExpired(session)) {
        this.deleteSession(id)
        purgedCount++
      }
    }
    return purgedCount
  }

  /**
   * Start the periodic cleanup interval.
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, CLEANUP_INTERVAL_MS)
  }

  /**
   * Stop the periodic cleanup interval (for testing and graceful shutdown).
   */
  stopCleanupInterval(): void {
    if (this.cleanupInterval !== null) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }

  /**
   * Get the current number of active sessions (for monitoring/testing).
   */
  getActiveSessionCount(): number {
    return this.sessions.size
  }
}

/** Singleton instance of SessionManager */
export const sessionManager = new SessionManager()

/** Export the class for testing purposes */
export { SessionManager }
