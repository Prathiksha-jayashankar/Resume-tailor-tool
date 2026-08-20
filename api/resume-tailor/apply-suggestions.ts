/**
 * Vercel Serverless Function: POST /api/resume-tailor/apply-suggestions
 * Applies accepted suggestions to produce a tailored resume preview.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sessionManager } from '../../server/resume-tailor/sessionManager'
import { applySuggestions, detectConflicts } from '../../server/resume-tailor/resumeModifier'
import type { Suggestion } from '../../server/resume-tailor/types'

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { sessionId, acceptedSuggestionIds } = req.body

    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ error: 'Session ID is required' })
    }
    const session = sessionManager.getSession(sessionId)
    if (!session) {
      return res.status(400).json({ error: 'Invalid or expired session. Please start a new session.' })
    }

    if (!session.analysisResult) {
      return res.status(400).json({ error: 'No analysis result found. Please analyze your resume first.' })
    }

    if (!session.parsedResume) {
      return res.status(400).json({ error: 'No parsed resume found in session.' })
    }

    if (!acceptedSuggestionIds || !Array.isArray(acceptedSuggestionIds)) {
      return res.status(400).json({ error: 'acceptedSuggestionIds must be an array' })
    }

    const suggestions: Suggestion[] = session.analysisResult.suggestions.map(s => ({
      ...s,
      status: acceptedSuggestionIds.includes(s.id) ? 'accepted' as const : 'rejected' as const,
    }))

    const acceptedSuggestions = suggestions.filter(s => s.status === 'accepted')
    const conflicts = detectConflicts(acceptedSuggestions)

    const applyResult = applySuggestions(session.parsedResume, suggestions)

    if (!applyResult.success) {
      return res.status(500).json({ error: applyResult.error })
    }

    sessionManager.updateSession(sessionId, {
      tailoredResume: applyResult.tailoredResume,
    })

    const response: Record<string, unknown> = {
      ...applyResult.tailoredResume,
    }

    if (conflicts.length > 0) {
      response.conflicts = conflicts
    }

    if (applyResult.skippedSuggestions.length > 0) {
      response.skippedSuggestions = applyResult.skippedSuggestions
    }

    return res.status(200).json(response)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred while applying suggestions.'
    return res.status(500).json({ error: message })
  }
}
