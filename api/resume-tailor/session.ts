/**
 * Vercel Serverless Function: POST /api/resume-tailor/session
 * Creates a new ephemeral session.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sessionManager } from '../../server/resume-tailor/sessionManager'

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method === 'POST') {
    const session = sessionManager.createSession()
    return res.status(201).json({ sessionId: session.id })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
