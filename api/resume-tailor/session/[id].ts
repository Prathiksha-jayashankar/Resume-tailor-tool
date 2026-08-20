/**
 * Vercel Serverless Function: DELETE /api/resume-tailor/session/:id
 * Deletes a session and all associated user data.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sessionManager } from '../../../server/resume-tailor/sessionManager'

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const id = req.query.id as string
  if (!id) {
    return res.status(400).json({ error: 'Session ID is required' })
  }

  const deleted = sessionManager.deleteSession(id)
  if (!deleted) {
    return res.status(404).json({ error: 'Session not found' })
  }

  return res.status(200).json({ success: true })
}
