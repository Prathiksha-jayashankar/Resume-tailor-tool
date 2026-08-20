/**
 * Vercel Serverless Function: POST /api/resume-tailor/analyze
 * Analyzes resume content against a job description.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sessionManager } from '../../server/resume-tailor/sessionManager'
import { validateResumeContent } from '../../server/resume-tailor/resumeValidation'
import { createLLMService } from '../../server/resume-tailor/llmServiceAdapter'
import { createResumeParser } from '../../server/resume-tailor/resumeParserService'
import { createJobDescriptionAnalyzer } from '../../server/resume-tailor/jobDescriptionAnalyzer'
import { createKeywordMatcher } from '../../server/resume-tailor/keywordMatcher'
import { calculateMatchScore, calculateCategoryScore, isWellAligned } from '../../server/resume-tailor/matchScoreEngine'
import { createSuggestionEngine } from '../../server/resume-tailor/suggestionEngine'
import type { AnalysisResult } from '../../server/resume-tailor/types'

export const config = {
  maxDuration: 60,
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred during analysis.'
    return res.status(500).json({ error: message })
  }
}
