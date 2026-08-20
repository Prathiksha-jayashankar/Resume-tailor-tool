/**
 * Vercel Serverless Function: Catch-all handler for /api/*
 * Routes requests to the appropriate handler based on the path.
 *
 * This single file handles all API routes to avoid import resolution issues
 * with nested api/ folder structures on Vercel.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sessionManager } from '../server/resume-tailor/sessionManager'
import { validateResumeContent } from '../server/resume-tailor/resumeValidation'
import { createLLMService } from '../server/resume-tailor/llmServiceAdapter'
import { createResumeParser } from '../server/resume-tailor/resumeParserService'
import { createJobDescriptionAnalyzer } from '../server/resume-tailor/jobDescriptionAnalyzer'
import { createKeywordMatcher } from '../server/resume-tailor/keywordMatcher'
import { calculateMatchScore, calculateCategoryScore, isWellAligned } from '../server/resume-tailor/matchScoreEngine'
import { createSuggestionEngine } from '../server/resume-tailor/suggestionEngine'
import { applySuggestions, detectConflicts } from '../server/resume-tailor/resumeModifier'
import { generateDownload } from '../server/resume-tailor/downloadGenerator'
import type { AnalysisResult, Suggestion } from '../server/resume-tailor/types'

export const config = {
  maxDuration: 60,
}

function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // Parse the path: /api/resume-tailor/session -> ["resume-tailor", "session"]
  const pathParam = req.query.path
  const pathSegments = Array.isArray(pathParam) ? pathParam : pathParam ? [pathParam] : []

  // Strip "resume-tailor" prefix if present
  let routeSegments = pathSegments
  if (pathSegments[0] === 'resume-tailor') {
    routeSegments = pathSegments.slice(1)
  }

  const route = routeSegments.join('/')

  try {
    // POST /api/resume-tailor/session
    if (route === 'session' && req.method === 'POST') {
      const session = sessionManager.createSession()
      return res.status(201).json({ sessionId: session.id })
    }

    // DELETE /api/resume-tailor/session/:id
    if (routeSegments[0] === 'session' && routeSegments.length === 2 && req.method === 'DELETE') {
      const id = routeSegments[1]
      const deleted = sessionManager.deleteSession(id)
      if (!deleted) {
        return res.status(404).json({ error: 'Session not found' })
      }
      return res.status(200).json({ success: true })
    }

    // POST /api/resume-tailor/analyze
    if (route === 'analyze' && req.method === 'POST') {
      return await handleAnalyze(req, res)
    }

    // POST /api/resume-tailor/apply-suggestions
    if (route === 'apply-suggestions' && req.method === 'POST') {
      return handleApplySuggestions(req, res)
    }

    // POST /api/resume-tailor/confirm
    if (route === 'confirm' && req.method === 'POST') {
      return handleConfirm(req, res)
    }

    // GET /api/resume-tailor/download/:format
    if (routeSegments[0] === 'download' && routeSegments.length === 2 && req.method === 'GET') {
      return await handleDownload(req, res, routeSegments[1])
    }

    // Health check
    if (route === '' || route === 'health') {
      return res.status(200).json({ status: 'ok', timestamp: Date.now() })
    }

    return res.status(404).json({ error: `Not found: /api/${pathSegments.join('/')}` })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.'
    console.error('[API Error]', error)
    return res.status(500).json({ error: message })
  }
}

// ── Handlers ──────────────────────────────────────────────────────────────────

async function handleAnalyze(req: VercelRequest, res: VercelResponse) {
  const { resumeText, jobDescription, sessionId } = req.body

  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'Session ID is required' })
  }
  const session = sessionManager.getSession(sessionId)
  if (!session) {
    return res.status(400).json({ error: 'Invalid or expired session. Please start a new session.' })
  }

  if (!resumeText || typeof resumeText !== 'string') {
    return res.status(400).json({ error: 'Resume text is required' })
  }
  const validation = validateResumeContent(resumeText)
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error })
  }

  if (!jobDescription || typeof jobDescription !== 'string') {
    return res.status(400).json({ error: 'Job description is required' })
  }
  if (jobDescription.trim().length === 0) {
    return res.status(400).json({ error: 'Job description cannot be empty' })
  }

  const llmService = createLLMService()

  const resumeParser = createResumeParser(llmService)
  const parseResult = await resumeParser.parseResume(resumeText)
  if (!parseResult.success) {
    return res.status(500).json({ error: parseResult.error })
  }
  const parsedResume = parseResult.data

  const jdAnalyzer = createJobDescriptionAnalyzer(llmService)
  const jdResult = await jdAnalyzer.analyzeJobDescription(jobDescription)
  if (!jdResult.success) {
    return res.status(500).json({ error: jdResult.error })
  }
  const parsedJD = jdResult.data

  const keywordMatcher = createKeywordMatcher(llmService)
  const matchResult = await keywordMatcher.matchKeywords(parsedResume, parsedJD)
  if (!matchResult.success) {
    return res.status(500).json({ error: matchResult.error })
  }
  const keywordMatches = matchResult.data

  const technicalCategory = keywordMatches.categories.technical
  const experienceCategory = keywordMatches.categories.experience
  const softSkillsCategory = keywordMatches.categories.soft_skills
  const educationCategory = keywordMatches.categories.education

  const technicalScore = calculateCategoryScore(
    technicalCategory.matched.length,
    technicalCategory.matched.length + technicalCategory.missing.length
  )
  const experienceScore = calculateCategoryScore(
    experienceCategory.matched.length,
    experienceCategory.matched.length + experienceCategory.missing.length
  )
  const softSkillsScore = calculateCategoryScore(
    softSkillsCategory.matched.length,
    softSkillsCategory.matched.length + softSkillsCategory.missing.length
  )
  const educationScore = calculateCategoryScore(
    educationCategory.matched.length,
    educationCategory.matched.length + educationCategory.missing.length
  )

  const matchScore = calculateMatchScore({
    technical: technicalScore,
    experience: experienceScore,
    softSkills: softSkillsScore,
    education: educationScore,
  })

  const wellAligned = isWellAligned(matchScore.overall)

  const suggestionEngine = createSuggestionEngine(llmService)
  const suggestionResult = await suggestionEngine.generateSuggestions({
    parsedResume,
    parsedJD,
    matchResult: keywordMatches,
    matchScore,
  })
  if (!suggestionResult.success) {
    return res.status(500).json({ error: suggestionResult.error })
  }

  const analysisResult: AnalysisResult = {
    sessionId,
    matchScore,
    keywordMatches,
    suggestions: suggestionResult.suggestions,
    isWellAligned: wellAligned,
  }

  sessionManager.updateSession(sessionId, {
    parsedResume,
    parsedJobDescription: parsedJD,
    analysisResult,
  })

  return res.status(200).json(analysisResult)
}

function handleApplySuggestions(req: VercelRequest, res: VercelResponse) {
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

  const response: Record<string, unknown> = { ...applyResult.tailoredResume }

  if (conflicts.length > 0) {
    response.conflicts = conflicts
  }
  if (applyResult.skippedSuggestions.length > 0) {
    response.skippedSuggestions = applyResult.skippedSuggestions
  }

  return res.status(200).json(response)
}

function handleConfirm(req: VercelRequest, res: VercelResponse) {
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

  sessionManager.updateSession(sessionId, { lastActivityAt: Date.now() })
  return res.status(200).json({ success: true })
}

async function handleDownload(req: VercelRequest, res: VercelResponse, format: string) {
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
    return res.status(400).json({ error: 'No confirmed tailored resume found.' })
  }

  const jobTitle = session.parsedJobDescription?.jobTitle || 'Untitled'
  const result = await generateDownload(session.tailoredResume.content, jobTitle, format)

  if (!result.success) {
    return res.status(500).json({ error: result.error })
  }

  res.setHeader('Content-Type', result.mimeType)
  res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`)
  return res.send(result.buffer)
}
