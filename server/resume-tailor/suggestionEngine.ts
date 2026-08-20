/**
 * Suggestion Engine Service - Generates prioritized, actionable suggestions
 * to improve resume alignment with the target job description.
 *
 * Categories: keyword_add, rephrase, skill_highlight, section_expand, section_reduce
 * Shows original text vs suggested text with rationale.
 * Preserves factual accuracy of user's experience.
 * When score > 85, provides only minor optimization suggestions.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 8.3
 */

import type { LLMServiceAdapter } from './llmServiceAdapter'
import type {
  ParsedResume,
  ParsedJobDescription,
  KeywordMatchResult,
  MatchScore,
  Suggestion,
  SuggestionCategory,
} from './types'

// ── Result Types ──────────────────────────────────────────────────────────────

export type SuggestionResult =
  | { success: true; suggestions: Suggestion[] }
  | { success: false; error: string }

export interface GenerateSuggestionsParams {
  parsedResume: ParsedResume
  parsedJD: ParsedJobDescription
  matchResult: KeywordMatchResult
  matchScore: MatchScore
}

// ── Valid Categories ──────────────────────────────────────────────────────────

const VALID_SUGGESTION_CATEGORIES: SuggestionCategory[] = [
  'keyword_add',
  'rephrase',
  'skill_highlight',
  'section_expand',
  'section_reduce',
]

// ── LLM Prompts ───────────────────────────────────────────────────────────────

const SUGGESTION_SYSTEM_PROMPT = `You are a professional resume optimization expert. Your role is to generate specific, actionable suggestions to improve a resume's alignment with a target job description.

RULES:
- Preserve the factual accuracy of the user's experience and qualifications. NEVER fabricate experience, roles, skills, or achievements the user does not have.
- Suggestions must use formal professional tone without colloquialisms, slang, or first-person pronouns.
- Suggestions must contain no spelling or grammatical errors.
- Each suggestion must include the original text from the resume and the suggested replacement text.
- Each suggestion must include a rationale explaining why the change improves alignment.
- Each suggestion must target a specific section of the resume (by section ID).
- Prioritize suggestions by impact (1 = highest priority).

SUGGESTION CATEGORIES:
- "keyword_add": Add missing keywords from the job description naturally into existing content
- "rephrase": Rephrase existing content to better match job description language
- "skill_highlight": Emphasize or elevate existing skills that match job requirements
- "section_expand": Expand a section with more relevant detail from existing experience
- "section_reduce": Reduce or condense content that is less relevant to the target role

Return ONLY valid JSON with no additional text or markdown formatting:
{
  "suggestions": [
    {
      "category": "keyword_add",
      "priority": 1,
      "originalText": "exact text from resume",
      "suggestedText": "improved text",
      "rationale": "explanation of why this improves alignment",
      "targetSectionId": "section-id"
    }
  ]
}`

const MINOR_OPTIMIZATION_SYSTEM_PROMPT = `You are a professional resume optimization expert. The resume is ALREADY WELL-ALIGNED with the job description (match score above 85%). Provide ONLY minor optimization suggestions — small wording improvements, subtle keyword additions, or minor rephrasing for clarity.

RULES:
- The resume is already strong. Do NOT suggest major restructuring or significant changes.
- Preserve the factual accuracy of the user's experience and qualifications. NEVER fabricate experience, roles, skills, or achievements the user does not have.
- Suggestions must use formal professional tone without colloquialisms, slang, or first-person pronouns.
- Suggestions must contain no spelling or grammatical errors.
- Each suggestion must include the original text from the resume and the suggested replacement text.
- Each suggestion must include a rationale explaining why the change provides a minor improvement.
- Each suggestion must target a specific section of the resume (by section ID).
- Limit to at most 3-5 minor suggestions.
- Prioritize suggestions by impact (1 = highest priority).

SUGGESTION CATEGORIES:
- "keyword_add": Add a missing keyword naturally into existing content
- "rephrase": Minor rephrasing for clarity or stronger impact
- "skill_highlight": Slightly emphasize an existing skill that matches a job requirement
- "section_expand": Minor expansion with relevant detail
- "section_reduce": Minor trimming of less relevant content

Return ONLY valid JSON with no additional text or markdown formatting:
{
  "suggestions": [
    {
      "category": "rephrase",
      "priority": 1,
      "originalText": "exact text from resume",
      "suggestedText": "slightly improved text",
      "rationale": "explanation of why this minor change helps",
      "targetSectionId": "section-id"
    }
  ]
}`

// ── Error Messages ────────────────────────────────────────────────────────────

const LLM_FAILURE_ERROR = 'Suggestion generation could not be completed due to a service error. Please retry after 30 seconds.'
const PARSE_ERROR = 'Failed to parse suggestion response from the analysis service.'

// ── Pure Helper Functions (exported for property testing) ─────────────────────

/**
 * Validates that a suggestion category is one of the defined valid categories.
 * Property 6: Every suggestion has a valid category from the defined set.
 *
 * @param category - The category string to validate
 * @returns true if the category is valid, false otherwise
 */
export function validateSuggestionCategory(category: string): boolean {
  return VALID_SUGGESTION_CATEGORIES.includes(category as SuggestionCategory)
}

// ── SuggestionEngine Class ────────────────────────────────────────────────────

export class SuggestionEngine {
  private llmService: LLMServiceAdapter

  constructor(llmService: LLMServiceAdapter) {
    this.llmService = llmService
  }

  /**
   * Generate prioritized suggestions for improving resume alignment.
   * If score > 85, modifies prompt to request only minor optimization suggestions.
   */
  async generateSuggestions(params: GenerateSuggestionsParams): Promise<SuggestionResult> {
    const { parsedResume, parsedJD, matchResult, matchScore } = params
    const isHighScore = matchScore.overall > 85

    try {
      // Build user prompt with resume sections, missing keywords, and match context
      const userPrompt = this.buildUserPrompt(parsedResume, parsedJD, matchResult, matchScore)

      // Select system prompt based on score
      const systemPrompt = isHighScore
        ? MINOR_OPTIMIZATION_SYSTEM_PROMPT
        : SUGGESTION_SYSTEM_PROMPT

      // Call LLM to generate suggestions
      const llmResult = await this.llmService.sendRequest({
        systemPrompt,
        userPrompt,
        temperature: 0.4,
      })

      if (!llmResult.success) {
        return { success: false, error: LLM_FAILURE_ERROR }
      }

      // Parse and validate the LLM response
      const suggestions = this.parseSuggestionResponse(
        llmResult.response.content,
        parsedResume
      )

      if (suggestions === null) {
        return { success: false, error: PARSE_ERROR }
      }

      // Assign unique IDs, set status to pending, sort by priority
      const processedSuggestions = this.processSuggestions(suggestions)

      return { success: true, suggestions: processedSuggestions }
    } catch {
      return { success: false, error: LLM_FAILURE_ERROR }
    }
  }

  /**
   * Build the user prompt including resume sections, missing keywords, and match context.
   */
  private buildUserPrompt(
    parsedResume: ParsedResume,
    parsedJD: ParsedJobDescription,
    matchResult: KeywordMatchResult,
    matchScore: MatchScore
  ): string {
    const sections = parsedResume.sections.map(s => ({
      id: s.id,
      heading: s.heading,
      content: s.content,
    }))

    const prompt = `RESUME SECTIONS:
${JSON.stringify(sections, null, 2)}

JOB TITLE: ${parsedJD.jobTitle}

REQUIRED SKILLS: ${parsedJD.requiredSkills.join(', ')}

PREFERRED QUALIFICATIONS: ${parsedJD.preferredQualifications.join(', ')}

KEY RESPONSIBILITIES: ${parsedJD.responsibilities.join(', ')}

MISSING KEYWORDS (not found in resume): ${matchResult.missingKeywords.join(', ')}

MATCH SCORE: ${matchScore.overall}% overall
- Technical: ${matchScore.breakdown.technical}%
- Experience: ${matchScore.breakdown.experience}%
- Soft Skills: ${matchScore.breakdown.softSkills}%
- Education: ${matchScore.breakdown.education}%

Available section IDs: ${parsedResume.sections.map(s => s.id).join(', ')}

Generate suggestions to improve the resume's alignment with this job description. Each suggestion must target one of the available section IDs.`

    return prompt
  }

  /**
   * Parse the LLM suggestion response into Suggestion objects.
   * Validates each suggestion has a valid category.
   * Returns null if parsing completely fails.
   */
  private parseSuggestionResponse(
    content: string,
    parsedResume: ParsedResume
  ): Omit<Suggestion, 'id' | 'status'>[] | null {
    try {
      const cleaned = content
        .replace(/^```(?:json)?\s*/m, '')
        .replace(/\s*```$/m, '')
        .trim()

      const data = JSON.parse(cleaned)

      if (!data.suggestions || !Array.isArray(data.suggestions)) {
        return null
      }

      const validSectionIds = new Set(parsedResume.sections.map(s => s.id))
      const suggestions: Omit<Suggestion, 'id' | 'status'>[] = []

      for (const raw of data.suggestions) {
        // Validate required fields
        if (
          typeof raw.category !== 'string' ||
          typeof raw.priority !== 'number' ||
          typeof raw.originalText !== 'string' ||
          typeof raw.suggestedText !== 'string' ||
          typeof raw.rationale !== 'string' ||
          typeof raw.targetSectionId !== 'string'
        ) {
          continue // Skip malformed suggestions
        }

        // Validate category
        if (!validateSuggestionCategory(raw.category)) {
          continue // Skip suggestions with invalid categories
        }

        // Validate targetSectionId exists in resume (fallback to first section)
        const targetSectionId = validSectionIds.has(raw.targetSectionId)
          ? raw.targetSectionId
          : parsedResume.sections.length > 0
            ? parsedResume.sections[0].id
            : raw.targetSectionId

        suggestions.push({
          category: raw.category as SuggestionCategory,
          priority: Math.max(1, Math.round(raw.priority)),
          originalText: raw.originalText,
          suggestedText: raw.suggestedText,
          rationale: raw.rationale,
          targetSectionId,
        })
      }

      return suggestions.length > 0 ? suggestions : null
    } catch {
      return null
    }
  }

  /**
   * Process raw suggestions: assign unique IDs, set status to 'pending', sort by priority.
   */
  private processSuggestions(
    rawSuggestions: Omit<Suggestion, 'id' | 'status'>[]
  ): Suggestion[] {
    // Sort by priority (1 = highest)
    const sorted = [...rawSuggestions].sort((a, b) => a.priority - b.priority)

    // Assign unique IDs and set status
    return sorted.map((suggestion, index) => ({
      ...suggestion,
      id: `suggestion-${index + 1}`,
      status: 'pending' as const,
    }))
  }
}

// ── Factory Function ──────────────────────────────────────────────────────────

/**
 * Create a SuggestionEngine instance with the provided LLM service adapter.
 */
export function createSuggestionEngine(llmService: LLMServiceAdapter): SuggestionEngine {
  return new SuggestionEngine(llmService)
}
