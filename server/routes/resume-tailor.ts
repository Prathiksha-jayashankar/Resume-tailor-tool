/**
 * Express route handlers for the Resume Tailor Tool API.
 * Requirements: 9.1
 *
 * Endpoints:
 *   POST   /session         — Create a new session
 *   DELETE /session/:id     — Delete a session and its data
 *   POST   /analyze         — Analyze resume against job description
 *   POST   /apply-suggestions — Apply accepted suggestions to produce tailored resume
 *   POST   /confirm         — Confirm the tailored resume
 *   GET    /download/:format — Download tailored resume as PDF or DOCX
 */

import express from 'express'
import type { Request, Response, Router } from 'express'
import { sessionManager } from '../resume-tailor/sessionManager'
import { validateResumeContent } from '../resume-tailor/resumeValidation'
import { createLLMService } from '../resume-tailor/llmServiceAdapter'
import { createResumeParser } from '../resume-tailor/resumeParserService'
import { createJobDescriptionAnalyzer } from '../resume-tailor/jobDescriptionAnalyzer'
import { createKeywordMatcher } from '../resume-tailor/keywordMatcher'
import { calculateMatchScore, calculateCategoryScore, isWellAligned } from '../resume-tailor/matchScoreEngine'
import { createSuggestionEngine } from '../resume-tailor/suggestionEngine'
import { applySuggestions, detectConflicts } from '../resume-tailor/resumeModifier'
import { generateDownload } from '../resume-tailor/downloadGenerator'
import type { AnalysisResult, Suggestion } from '../resume-tailor/types'

const router: Router = express.Router()

// ── Session Management ────────────────────────────────────────────────────────

/**
 * POST /session
 * Creates a new ephemeral session and returns its ID.
 */
router.post('/session', (req: Request, res: Response) => {
  const session = sessionManager.createSession()
  res.status(201).json({ sessionId: session.id })
})

/**
 * DELETE /session/:id
 * Deletes the session and all associated user data.
 */
router.delete('/session/:id', (req: Request, res: Response) => {
  const id = req.params.id as string
  if (!id) {
    res.status(400).json({ error: 'Session ID is required' })
    return
  }
  const deleted = sessionManager.deleteSession(id)
  if (!deleted) {
    res.status(404).json({ error: 'Session not found' })
    return
  }
  res.status(200).json({ success: true })
})

// ── Analysis ──────────────────────────────────────────────────────────────────

/**
 * POST /analyze
 * Analyzes resume content against a job description.
 * Body: { resumeText, jobDescription, sessionId }
 */
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const { resumeText, jobDescription, sessionId } = req.body

    // 1. Validate sessionId exists and session is active
    if (!sessionId || typeof sessionId !== 'string') {
      res.status(400).json({ error: 'Session ID is required' })
      return
    }
    const session = sessionManager.getSession(sessionId)
    if (!session) {
      res.status(400).json({ error: 'Invalid or expired session. Please start a new session.' })
      return
    }

    // 2. Validate resumeText
    if (!resumeText || typeof resumeText !== 'string') {
      res.status(400).json({ error: 'Resume text is required' })
      return
    }
    const validation = validateResumeContent(resumeText)
    if (!validation.valid) {
      res.status(400).json({ error: validation.error })
      return
    }

    // 3. Validate jobDescription
    if (!jobDescription || typeof jobDescription !== 'string') {
      res.status(400).json({ error: 'Job description is required' })
      return
    }
    if (jobDescription.trim().length === 0) {
      res.status(400).json({ error: 'Job description cannot be empty' })
      return
    }

    // 4. Create LLM service instance
    const llmService = createLLMService()

    // 5. Parse resume
    const resumeParser = createResumeParser(llmService)
    const parseResult = await resumeParser.parseResume(resumeText)
    if (!parseResult.success) {
      res.status(500).json({ error: parseResult.error })
      return
    }
    const parsedResume = parseResult.data

    // 6. Analyze job description
    const jdAnalyzer = createJobDescriptionAnalyzer(llmService)
    const jdResult = await jdAnalyzer.analyzeJobDescription(jobDescription)
    if (!jdResult.success) {
      res.status(500).json({ error: jdResult.error })
      return
    }
    const parsedJD = jdResult.data

    // 7. Match keywords
    const keywordMatcher = createKeywordMatcher(llmService)
    const matchResult = await keywordMatcher.matchKeywords(parsedResume, parsedJD)
    if (!matchResult.success) {
      res.status(500).json({ error: matchResult.error })
      return
    }
    const keywordMatches = matchResult.data

    // 8. Calculate score
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

    // 9. Generate suggestions
    const suggestionEngine = createSuggestionEngine(llmService)
    const suggestionResult = await suggestionEngine.generateSuggestions({
      parsedResume,
      parsedJD,
      matchResult: keywordMatches,
      matchScore,
    })
    if (!suggestionResult.success) {
      res.status(500).json({ error: suggestionResult.error })
      return
    }

    // 10. Build AnalysisResult
    const analysisResult: AnalysisResult = {
      sessionId,
      matchScore,
      keywordMatches,
      suggestions: suggestionResult.suggestions,
      isWellAligned: wellAligned,
    }

    // 11. Store in session
    sessionManager.updateSession(sessionId, {
      parsedResume,
      parsedJobDescription: parsedJD,
      analysisResult,
    })

    // 12. Return 200 with AnalysisResult
    res.status(200).json(analysisResult)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred during analysis.'
    res.status(500).json({ error: message })
  }
})

// ── Suggestion Application ────────────────────────────────────────────────────

/**
 * POST /apply-suggestions
 * Applies accepted suggestions to produce a tailored resume preview.
 * Body: { sessionId, acceptedSuggestionIds }
 * Requirements: 5.3, 5.7, 5.8
 */
router.post('/apply-suggestions', (req: Request, res: Response) => {
  try {
    const { sessionId, acceptedSuggestionIds } = req.body

    // 1. Validate sessionId
    if (!sessionId || typeof sessionId !== 'string') {
      res.status(400).json({ error: 'Session ID is required' })
      return
    }
    const session = sessionManager.getSession(sessionId)
    if (!session) {
      res.status(400).json({ error: 'Invalid or expired session. Please start a new session.' })
      return
    }

    // 2. Verify session has analysisResult (resume was analyzed)
    if (!session.analysisResult) {
      res.status(400).json({ error: 'No analysis result found. Please analyze your resume first.' })
      return
    }

    if (!session.parsedResume) {
      res.status(400).json({ error: 'No parsed resume found in session.' })
      return
    }

    // 3. Validate acceptedSuggestionIds
    if (!acceptedSuggestionIds || !Array.isArray(acceptedSuggestionIds)) {
      res.status(400).json({ error: 'acceptedSuggestionIds must be an array' })
      return
    }

    // 4. Get suggestions from session analysisResult and mark accepted ones
    const suggestions: Suggestion[] = session.analysisResult.suggestions.map(s => ({
      ...s,
      status: acceptedSuggestionIds.includes(s.id) ? 'accepted' as const : 'rejected' as const,
    }))

    const acceptedSuggestions = suggestions.filter(s => s.status === 'accepted')

    // 5. Run conflict detection — return conflicts as a warning (don't block)
    const conflicts = detectConflicts(acceptedSuggestions)

    // 6. Apply suggestions via ResumeModifier
    const applyResult = applySuggestions(session.parsedResume, suggestions)

    if (!applyResult.success) {
      res.status(500).json({ error: applyResult.error })
      return
    }

    // 7. Store tailored resume in session
    sessionManager.updateSession(sessionId, {
      tailoredResume: applyResult.tailoredResume,
    })

    // 8. Return TailoredResume with optional conflict warnings
    const response: Record<string, unknown> = {
      ...applyResult.tailoredResume,
    }

    if (conflicts.length > 0) {
      response.conflicts = conflicts
    }

    if (applyResult.skippedSuggestions.length > 0) {
      response.skippedSuggestions = applyResult.skippedSuggestions
    }

    res.status(200).json(response)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred while applying suggestions.'
    res.status(500).json({ error: message })
  }
})

// ── Confirmation ──────────────────────────────────────────────────────────────

/**
 * POST /confirm
 * Finalizes the tailored resume in the session.
 * Body: { sessionId }
 * Requirements: 5.9
 */
router.post('/confirm', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body

    // 1. Validate sessionId
    if (!sessionId || typeof sessionId !== 'string') {
      res.status(400).json({ error: 'Session ID is required' })
      return
    }
    const session = sessionManager.getSession(sessionId)
    if (!session) {
      res.status(400).json({ error: 'Invalid or expired session. Please start a new session.' })
      return
    }

    // 2. Verify session has tailoredResume
    if (!session.tailoredResume) {
      res.status(400).json({ error: 'No tailored resume found. Please apply suggestions first.' })
      return
    }

    // 3. Mark session as confirmed (update lastActivityAt to keep session alive)
    sessionManager.updateSession(sessionId, {
      lastActivityAt: Date.now(),
    })

    // 4. Return success
    res.status(200).json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred while confirming the resume.'
    res.status(500).json({ error: message })
  }
})

// ── Download ──────────────────────────────────────────────────────────────────

/**
 * GET /download/:format
 * Downloads the confirmed tailored resume in the specified format (pdf or docx).
 * Query: sessionId
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */
router.get('/download/:format', async (req: Request, res: Response) => {
  try {
    // 1. Validate format parameter
    const format = req.params.format as string
    if (format !== 'pdf' && format !== 'docx') {
      res.status(400).json({ error: 'Invalid format. Must be "pdf" or "docx".' })
      return
    }

    // 2. Validate sessionId from query
    const sessionId = req.query.sessionId as string | undefined
    if (!sessionId || typeof sessionId !== 'string') {
      res.status(400).json({ error: 'Session ID is required as a query parameter.' })
      return
    }

    // 3. Get session and verify it has a confirmed tailored resume
    const session = sessionManager.getSession(sessionId)
    if (!session) {
      res.status(400).json({ error: 'Invalid or expired session. Please start a new session.' })
      return
    }

    if (!session.tailoredResume) {
      res.status(400).json({ error: 'No confirmed tailored resume found. Please confirm your tailored resume first.' })
      return
    }

    // 4. Get job title from session's parsed job description
    const jobTitle = session.parsedJobDescription?.jobTitle || 'Untitled'

    // 5. Generate download file (5-second timeout is enforced by generateDownload)
    const result = await generateDownload(session.tailoredResume.content, jobTitle, format)

    // 6. Handle result
    if (!result.success) {
      res.status(500).json({ error: result.error })
      return
    }

    // 7. Set response headers and send binary buffer
    res.setHeader('Content-Type', result.mimeType)
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`)
    res.send(result.buffer)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred during download generation.'
    res.status(500).json({ error: message })
  }
})

export default router
