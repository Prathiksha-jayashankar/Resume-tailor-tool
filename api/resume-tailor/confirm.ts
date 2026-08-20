/**
 * Vercel Serverless Function: POST /api/resume-tailor/confirm
 * Finalizes the tailored resume in the session.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sessionManager } from '../../server/resume-tailor/sessionManager'

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
    const { sessionId } = req.body

    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ error: 'Session ID is required' })
    }
    const session = sessionManager.getSession(sessionId)
    if (!session) {
      return res.status(400).json({ error: 'Invalid or expired session. Please start a new session.' })
    }

    if (!session.tailoredResume) {
      return res.status(400).json({ error: 'No tailored resume found. Please apply suggestions first.' })
    }

    sessionManager.updateSession(sessionId, {
      lastActivityAt: Date.now(),
    })

    return res.status(200).json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred while confirming the resume.'
    return res.status(500).json({ error: message })
  }
}
