/**
 * Unit tests for SessionManager service.
 * Tests session create, get, update, delete, expiry, and cleanup.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SessionManager } from './sessionManager'
import { SESSION_TIMEOUT_MS } from './constants'

describe('SessionManager', () => {
  let manager: SessionManager

  beforeEach(() => {
    manager = new SessionManager()
  })

  afterEach(() => {
    manager.stopCleanupInterval()
  })

  describe('createSession', () => {
    it('creates a session with a unique ID', () => {
      const session = manager.createSession()
      expect(session.id).toBeDefined()
      expect(typeof session.id).toBe('string')
      expect(session.id.length).toBeGreaterThan(0)
    })

    it('initializes session with correct default values', () => {
      const before = Date.now()
      const session = manager.createSession()
      const after = Date.now()

      expect(session.createdAt).toBeGreaterThanOrEqual(before)
      expect(session.createdAt).toBeLessThanOrEqual(after)
      expect(session.lastActivityAt).toBe(session.createdAt)
      expect(session.parsedResume).toBeNull()
      expect(session.parsedJobDescription).toBeNull()
      expect(session.analysisResult).toBeNull()
      expect(session.tailoredResume).toBeNull()
      expect(session.privacyAcknowledged).toBe(false)
    })

    it('creates sessions with unique IDs', () => {
      const s1 = manager.createSession()
      const s2 = manager.createSession()
      expect(s1.id).not.toBe(s2.id)
    })
  })

  describe('getSession', () => {
    it('retrieves an existing session by ID', () => {
      const created = manager.createSession()
      const retrieved = manager.getSession(created.id)
      expect(retrieved).toBeDefined()
      expect(retrieved!.id).toBe(created.id)
    })

    it('returns undefined for non-existent session ID', () => {
      const result = manager.getSession('non-existent-id')
      expect(result).toBeUndefined()
    })

    it('updates lastActivityAt on access', () => {
      const session = manager.createSession()
      const originalActivity = session.lastActivityAt

      // Advance time slightly
      vi.useFakeTimers()
      vi.advanceTimersByTime(1000)

      const retrieved = manager.getSession(session.id)
      expect(retrieved!.lastActivityAt).toBeGreaterThan(originalActivity)

      vi.useRealTimers()
    })

    it('returns undefined and deletes expired session', () => {
      vi.useFakeTimers()
      const session = manager.createSession()

      // Advance past TTL
      vi.advanceTimersByTime(SESSION_TIMEOUT_MS + 1)

      const result = manager.getSession(session.id)
      expect(result).toBeUndefined()
      expect(manager.getActiveSessionCount()).toBe(0)

      vi.useRealTimers()
    })
  })

  describe('updateSession', () => {
    it('updates session with partial data', () => {
      const session = manager.createSession()
      const updated = manager.updateSession(session.id, { privacyAcknowledged: true })

      expect(updated).toBeDefined()
      expect(updated!.privacyAcknowledged).toBe(true)
    })

    it('updates lastActivityAt on update', () => {
      vi.useFakeTimers()
      const session = manager.createSession()
      const originalActivity = session.lastActivityAt

      vi.advanceTimersByTime(1000)
      const updated = manager.updateSession(session.id, { privacyAcknowledged: true })

      expect(updated!.lastActivityAt).toBeGreaterThan(originalActivity)
      vi.useRealTimers()
    })

    it('returns undefined for non-existent session', () => {
      const result = manager.updateSession('non-existent', { privacyAcknowledged: true })
      expect(result).toBeUndefined()
    })

    it('returns undefined and deletes expired session on update attempt', () => {
      vi.useFakeTimers()
      const session = manager.createSession()

      vi.advanceTimersByTime(SESSION_TIMEOUT_MS + 1)

      const result = manager.updateSession(session.id, { privacyAcknowledged: true })
      expect(result).toBeUndefined()
      expect(manager.getActiveSessionCount()).toBe(0)

      vi.useRealTimers()
    })
  })

  describe('deleteSession', () => {
    it('deletes an existing session and returns true', () => {
      const session = manager.createSession()
      const result = manager.deleteSession(session.id)

      expect(result).toBe(true)
      expect(manager.getSession(session.id)).toBeUndefined()
      expect(manager.getActiveSessionCount()).toBe(0)
    })

    it('returns false for non-existent session', () => {
      const result = manager.deleteSession('non-existent')
      expect(result).toBe(false)
    })

    it('nulls out all user data fields before deletion', () => {
      const session = manager.createSession()

      // Populate session with user data
      manager.updateSession(session.id, {
        parsedResume: { rawText: 'sensitive data', skills: [], experience: [], education: [], keywords: [], sections: [] },
        parsedJobDescription: { rawText: 'job data', requiredSkills: [], preferredQualifications: [], responsibilities: [], keywords: [], jobTitle: 'Engineer' },
      })

      // Keep a reference to verify nulling
      const sessionRef = manager.getSession(session.id)!

      manager.deleteSession(session.id)

      // After delete, the reference should show nulled fields
      expect(sessionRef.parsedResume).toBeNull()
      expect(sessionRef.parsedJobDescription).toBeNull()
      expect(sessionRef.analysisResult).toBeNull()
      expect(sessionRef.tailoredResume).toBeNull()
    })
  })

  describe('isExpired', () => {
    it('returns false for fresh session', () => {
      const session = manager.createSession()
      expect(manager.isExpired(session)).toBe(false)
    })

    it('returns true for session past TTL', () => {
      vi.useFakeTimers()
      const session = manager.createSession()

      vi.advanceTimersByTime(SESSION_TIMEOUT_MS + 1)
      expect(manager.isExpired(session)).toBe(true)

      vi.useRealTimers()
    })

    it('returns false for session just under TTL', () => {
      vi.useFakeTimers()
      const session = manager.createSession()

      vi.advanceTimersByTime(SESSION_TIMEOUT_MS - 1)
      expect(manager.isExpired(session)).toBe(false)

      vi.useRealTimers()
    })
  })

  describe('cleanup', () => {
    it('purges expired sessions', () => {
      vi.useFakeTimers()

      manager.createSession()
      manager.createSession()

      vi.advanceTimersByTime(SESSION_TIMEOUT_MS + 1)

      const purged = manager.cleanup()
      expect(purged).toBe(2)
      expect(manager.getActiveSessionCount()).toBe(0)

      vi.useRealTimers()
    })

    it('does not purge active sessions', () => {
      vi.useFakeTimers()

      manager.createSession()
      vi.advanceTimersByTime(SESSION_TIMEOUT_MS + 1)

      // Create a fresh session after advancing time
      manager.createSession()

      const purged = manager.cleanup()
      expect(purged).toBe(1)
      expect(manager.getActiveSessionCount()).toBe(1)

      vi.useRealTimers()
    })

    it('returns 0 when no sessions are expired', () => {
      manager.createSession()
      manager.createSession()

      const purged = manager.cleanup()
      expect(purged).toBe(0)
      expect(manager.getActiveSessionCount()).toBe(2)
    })
  })

  describe('stopCleanupInterval', () => {
    it('stops the cleanup interval without error', () => {
      expect(() => manager.stopCleanupInterval()).not.toThrow()
    })

    it('can be called multiple times safely', () => {
      manager.stopCleanupInterval()
      expect(() => manager.stopCleanupInterval()).not.toThrow()
    })
  })
})
