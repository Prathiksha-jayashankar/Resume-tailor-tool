/**
 * Vercel Serverless Function: GET /api/resume-tailor/download/:format
 * Downloads the confirmed tailored resume as PDF or DOCX.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sessionManager } from '../../../server/resume-tailor/sessionManager'
import { generateDownload } from '../../../server/resume-tailor/downloadGenerator'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const format = req.query.format as string
    if (format !== 'pdf' && format !== 'docx') {
      return res.status(400).json({ error: 'Invalid format. Must be "pdf" or "docx".' })
    }

    const sessionId = req.query.sessionId as string | undefined
    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ error: 'Session ID is required as a query parameter.' })
    }

    const session = sessionManager.getSession(sessionId)
    if (!session) {
      return res.status(400).json({ error: 'Invalid or expired session. Please start a new session.' })
    }

    if (!session.tailoredResume) {
      return res.status(400).json({ error: 'No confirmed tailored resume found. Please confirm your tailored resume first.' })
    }

    const jobTitle = session.parsedJobDescription?.jobTitle || 'Untitled'

    const result = await generateDownload(session.tailoredResume.content, jobTitle, format)

    if (!result.success) {
      return res.status(500).json({ error: result.error })
    }

    res.setHeader('Content-Type', result.mimeType)
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`)
    return res.send(result.buffer)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred during download generation.'
    return res.status(500).json({ error: message })
  }
}
