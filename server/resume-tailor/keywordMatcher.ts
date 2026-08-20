/**
 * Keyword Matcher Service - Performs semantic keyword matching between
 * parsed resume content and job description requirements.
 * Identifies exact matches, semantic equivalents, and missing keywords.
 * Groups results by category: technical, soft_skills, experience, education.
 * Enforces 30-second timeout with retry option on failure.
 * Requirements: 3.1, 3.2, 3.3, 3.6, 3.7, 8.2
 */

import type { LLMServiceAdapter } from './llmServiceAdapter'
import type {
  ParsedResume,
  ParsedJobDescription,
  KeywordMatchResult,
  KeywordMatch,
  KeywordCategory,
  KeywordCategories,
} from './types'
import { KEYWORD_MATCH_TIMEOUT } from './constants'

// ── Result Type ───────────────────────────────────────────────────────────────

export type KeywordMatcherResult =
  | { success: true; data: KeywordMatchResult }
  | { success: false; error: string }

// ── Classify Result (intermediate) ───────────────────────────────────────────

export interface ClassifyResult {
  exactMatches: KeywordMatch[]
  semanticMatches: KeywordMatch[]
  missingKeywords: string[]
}

// ── LLM Prompts ───────────────────────────────────────────────────────────────

const SEMANTIC_MATCH_SYSTEM_PROMPT = `You are a keyword matching expert specializing in resume analysis. Given a list of unmatched job description keywords and a list of resume keywords, identify semantic equivalents — terms that mean the same thing or are functionally equivalent in a professional context.

For each match found, provide:
- The job description term
- The matching resume term
- A confidence score (0.0 to 1.0) indicating how closely related they are
- A category: "technical", "soft_skills", "experience", or "education"

Also categorize the remaining unmatched keywords.

Return ONLY valid JSON with no additional text or markdown formatting:
{
  "semanticMatches": [
    {
      "jobDescriptionTerm": "term from JD",
      "resumeTerm": "equivalent term from resume",
      "confidence": 0.85,
      "category": "technical"
    }
  ],
  "missingKeywords": [
    {
      "term": "unmatched keyword",
      "category": "technical"
    }
  ]
}

Rules:
- Only match terms that are genuinely semantically equivalent (e.g., "managed" ≈ "led", "JavaScript" ≈ "JS", "team player" ≈ "collaborative")
- Confidence should reflect true semantic similarity (0.7+ for strong matches, 0.5-0.7 for moderate)
- Do NOT match unrelated terms
- Categories: "technical" for tech skills/tools/languages, "soft_skills" for interpersonal/communication skills, "experience" for work-related requirements, "education" for degrees/certifications
- Every unmatched JD keyword must appear in missingKeywords`

const CATEGORY_ASSIGNMENT_SYSTEM_PROMPT = `You are a keyword categorization expert. Categorize each of the following keywords into exactly one category.

Categories:
- "technical": Technical skills, programming languages, frameworks, tools, platforms, technologies
- "soft_skills": Interpersonal skills, communication, teamwork, leadership, problem-solving abilities
- "experience": Work experience requirements, years of experience, industry experience, domain knowledge
- "education": Degrees, certifications, academic qualifications, training programs

Return ONLY valid JSON:
{
  "categorized": [
    { "term": "keyword", "category": "technical" }
  ]
}

Rules:
- Every keyword must be categorized into exactly one category
- If unclear, use "technical" as default for ambiguous technical terms and "experience" for ambiguous work-related terms`

// ── Error Messages ────────────────────────────────────────────────────────────

const TIMEOUT_ERROR = 'Analysis could not be completed in time. Please try again.'
const LLM_FAILURE_ERROR = 'Keyword matching could not be completed due to a service error. Please retry after 30 seconds.'

// ── Pure Helper Functions (exported for testing) ──────────────────────────────

/**
 * Find exact matches between JD keywords and resume keywords (case-insensitive).
 * Returns exact KeywordMatch objects and the remaining unmatched JD keywords.
 */
export function findExactMatches(
  jdKeywords: string[],
  resumeKeywords: string[]
): { exactMatches: KeywordMatch[]; unmatchedJdKeywords: string[] } {
  const resumeKeywordsLower = resumeKeywords.map(k => k.toLowerCase().trim())
  const exactMatches: KeywordMatch[] = []
  const unmatchedJdKeywords: string[] = []

  for (const jdKeyword of jdKeywords) {
    const jdLower = jdKeyword.toLowerCase().trim()
    const resumeIndex = resumeKeywordsLower.indexOf(jdLower)

    if (resumeIndex !== -1) {
      exactMatches.push({
        jobDescriptionTerm: jdKeyword,
        resumeTerm: resumeKeywords[resumeIndex],
        matchType: 'exact',
        category: 'technical', // Will be reassigned by LLM categorization
        confidence: 1.0,
      })
    } else {
      unmatchedJdKeywords.push(jdKeyword)
    }
  }

  return { exactMatches, unmatchedJdKeywords }
}

/**
 * Group an array of KeywordMatch objects by their category field.
 * Also distributes missing keywords into categories.
 * Pure function — no LLM needed.
 *
 * Property 3: groupByCategory produces category buckets whose total item count
 * equals input array length.
 */
export function groupByCategory(
  matches: KeywordMatch[],
  missingKeywords: Array<{ term: string; category: KeywordCategory }> = []
): KeywordCategories {
  const categories: KeywordCategories = {
    technical: { matched: [], missing: [] },
    soft_skills: { matched: [], missing: [] },
    experience: { matched: [], missing: [] },
    education: { matched: [], missing: [] },
  }

  for (const match of matches) {
    const category = categories[match.category]
    if (category) {
      category.matched.push(match)
    } else {
      // Fallback to technical if category is invalid
      categories.technical.matched.push(match)
    }
  }

  for (const missing of missingKeywords) {
    const category = categories[missing.category]
    if (category) {
      category.missing.push(missing.term)
    } else {
      categories.technical.missing.push(missing.term)
    }
  }

  return categories
}

// ── KeywordMatcher Class ──────────────────────────────────────────────────────

export class KeywordMatcher {
  private llmService: LLMServiceAdapter

  constructor(llmService: LLMServiceAdapter) {
    this.llmService = llmService
  }

  /**
   * Orchestrator method: performs full keyword matching between parsed resume
   * and parsed job description.
   * Enforces KEYWORD_MATCH_TIMEOUT (30 seconds).
   */
  async matchKeywords(
    parsedResume: ParsedResume,
    parsedJD: ParsedJobDescription
  ): Promise<KeywordMatcherResult> {
    try {
      const result = await this.executeWithTimeout(
        this.performMatching(parsedResume, parsedJD),
        KEYWORD_MATCH_TIMEOUT
      )
      return result
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'KEYWORD_MATCH_TIMEOUT') {
        return { success: false, error: TIMEOUT_ERROR }
      }
      return { success: false, error: LLM_FAILURE_ERROR }
    }
  }

  /**
   * Classify JD keywords into exact matches, semantic matches, and missing.
   * 1. First: case-insensitive exact matching between JD keywords and resume keywords
   * 2. Then: LLM identifies semantic equivalents from resume keywords
   * 3. Remaining unmatched = missing
   * 4. LLM assigns category to each match
   *
   * Property 2: Every keyword is classified into exactly one of: exact match,
   * semantic match, or missing — no duplicates, no losses.
   */
  async classifyMatches(
    jdKeywords: string[],
    resumeKeywords: string[]
  ): Promise<ClassifyResult> {
    // Deduplicate inputs
    const uniqueJdKeywords = [...new Set(jdKeywords.filter(k => k.trim().length > 0))]
    const uniqueResumeKeywords = [...new Set(resumeKeywords.filter(k => k.trim().length > 0))]

    // Step 1: Exact matching (case-insensitive)
    const { exactMatches, unmatchedJdKeywords } = findExactMatches(
      uniqueJdKeywords,
      uniqueResumeKeywords
    )

    // If no unmatched keywords, skip LLM call
    if (unmatchedJdKeywords.length === 0) {
      // Still need to categorize exact matches
      const categorizedExact = await this.categorizeKeywords(
        exactMatches.map(m => m.jobDescriptionTerm)
      )
      for (const match of exactMatches) {
        const categorized = categorizedExact.find(
          c => c.term.toLowerCase() === match.jobDescriptionTerm.toLowerCase()
        )
        if (categorized) {
          match.category = categorized.category
        }
      }

      return {
        exactMatches,
        semanticMatches: [],
        missingKeywords: [],
      }
    }

    // Step 2: Call LLM for semantic matching of unmatched keywords
    const semanticResult = await this.findSemanticMatches(
      unmatchedJdKeywords,
      uniqueResumeKeywords
    )

    // Step 3: Categorize exact matches
    const categorizedExact = await this.categorizeKeywords(
      exactMatches.map(m => m.jobDescriptionTerm)
    )
    for (const match of exactMatches) {
      const categorized = categorizedExact.find(
        c => c.term.toLowerCase() === match.jobDescriptionTerm.toLowerCase()
      )
      if (categorized) {
        match.category = categorized.category
      }
    }

    return {
      exactMatches,
      semanticMatches: semanticResult.semanticMatches,
      missingKeywords: semanticResult.missingKeywords.map(m => m.term),
    }
  }

  /**
   * Internal: Full matching workflow.
   */
  private async performMatching(
    parsedResume: ParsedResume,
    parsedJD: ParsedJobDescription
  ): Promise<KeywordMatcherResult> {
    // Collect all resume keywords from various sections
    const resumeKeywords = this.collectResumeKeywords(parsedResume)

    // Collect all JD keywords
    const jdKeywords = this.collectJDKeywords(parsedJD)

    // Classify matches
    const classifyResult = await this.classifyMatches(jdKeywords, resumeKeywords)

    // Get categorized missing keywords from LLM response for grouping
    const { unmatchedJdKeywords } = findExactMatches(
      [...new Set(jdKeywords.filter(k => k.trim().length > 0))],
      [...new Set(resumeKeywords.filter(k => k.trim().length > 0))]
    )

    // Determine categories for missing keywords
    const missingWithCategories = await this.categorizeMissingKeywords(
      classifyResult.missingKeywords
    )

    // Group by category
    const allMatches = [
      ...classifyResult.exactMatches,
      ...classifyResult.semanticMatches,
    ]
    const categories = groupByCategory(allMatches, missingWithCategories)

    const result: KeywordMatchResult = {
      exactMatches: classifyResult.exactMatches,
      semanticMatches: classifyResult.semanticMatches,
      missingKeywords: classifyResult.missingKeywords,
      categories,
    }

    return { success: true, data: result }
  }

  /**
   * Use LLM to find semantic equivalents between unmatched JD keywords
   * and resume keywords.
   */
  private async findSemanticMatches(
    unmatchedJdKeywords: string[],
    resumeKeywords: string[]
  ): Promise<{
    semanticMatches: KeywordMatch[]
    missingKeywords: Array<{ term: string; category: KeywordCategory }>
  }> {
    const userPrompt = `Job description keywords (not exact-matched):
${JSON.stringify(unmatchedJdKeywords)}

Resume keywords available:
${JSON.stringify(resumeKeywords)}

Find semantic equivalents and categorize any remaining unmatched keywords.`

    const llmResult = await this.llmService.sendRequest({
      systemPrompt: SEMANTIC_MATCH_SYSTEM_PROMPT,
      userPrompt,
      temperature: 0.2,
    })

    if (!llmResult.success) {
      // On LLM failure, all unmatched keywords are treated as missing
      return {
        semanticMatches: [],
        missingKeywords: unmatchedJdKeywords.map(term => ({
          term,
          category: 'technical' as KeywordCategory,
        })),
      }
    }

    return this.parseSemanticMatchResponse(llmResult.response.content, unmatchedJdKeywords)
  }

  /**
   * Parse the LLM semantic matching response.
   */
  private parseSemanticMatchResponse(
    content: string,
    unmatchedJdKeywords: string[]
  ): {
    semanticMatches: KeywordMatch[]
    missingKeywords: Array<{ term: string; category: KeywordCategory }>
  } {
    try {
      const cleaned = content
        .replace(/^```(?:json)?\s*/m, '')
        .replace(/\s*```$/m, '')
        .trim()

      const data = JSON.parse(cleaned)

      const semanticMatches: KeywordMatch[] = []
      const missingKeywords: Array<{ term: string; category: KeywordCategory }> = []
      const matchedTerms = new Set<string>()

      // Parse semantic matches
      if (Array.isArray(data.semanticMatches)) {
        for (const match of data.semanticMatches) {
          if (
            typeof match.jobDescriptionTerm === 'string' &&
            typeof match.resumeTerm === 'string' &&
            typeof match.confidence === 'number'
          ) {
            const category = this.validateCategory(match.category)
            semanticMatches.push({
              jobDescriptionTerm: match.jobDescriptionTerm,
              resumeTerm: match.resumeTerm,
              matchType: 'semantic',
              category,
              confidence: Math.max(0, Math.min(1, match.confidence)),
            })
            matchedTerms.add(match.jobDescriptionTerm.toLowerCase())
          }
        }
      }

      // Parse missing keywords
      if (Array.isArray(data.missingKeywords)) {
        for (const missing of data.missingKeywords) {
          if (typeof missing === 'string') {
            missingKeywords.push({ term: missing, category: 'technical' })
            matchedTerms.add(missing.toLowerCase())
          } else if (typeof missing.term === 'string') {
            const category = this.validateCategory(missing.category)
            missingKeywords.push({ term: missing.term, category })
            matchedTerms.add(missing.term.toLowerCase())
          }
        }
      }

      // Ensure no keyword is lost — any unmatched JD keyword not in response goes to missing
      for (const jdKeyword of unmatchedJdKeywords) {
        if (!matchedTerms.has(jdKeyword.toLowerCase())) {
          missingKeywords.push({ term: jdKeyword, category: 'technical' })
        }
      }

      return { semanticMatches, missingKeywords }
    } catch {
      // On parse failure, treat all as missing
      return {
        semanticMatches: [],
        missingKeywords: unmatchedJdKeywords.map(term => ({
          term,
          category: 'technical' as KeywordCategory,
        })),
      }
    }
  }

  /**
   * Use LLM to categorize a list of keywords.
   */
  private async categorizeKeywords(
    keywords: string[]
  ): Promise<Array<{ term: string; category: KeywordCategory }>> {
    if (keywords.length === 0) return []

    const userPrompt = `Categorize these keywords:\n${JSON.stringify(keywords)}`

    const llmResult = await this.llmService.sendRequest({
      systemPrompt: CATEGORY_ASSIGNMENT_SYSTEM_PROMPT,
      userPrompt,
      temperature: 0.1,
    })

    if (!llmResult.success) {
      // Default to 'technical' on failure
      return keywords.map(term => ({ term, category: 'technical' as KeywordCategory }))
    }

    return this.parseCategoryResponse(llmResult.response.content, keywords)
  }

  /**
   * Categorize missing keywords using LLM.
   */
  private async categorizeMissingKeywords(
    missingKeywords: string[]
  ): Promise<Array<{ term: string; category: KeywordCategory }>> {
    if (missingKeywords.length === 0) return []
    return this.categorizeKeywords(missingKeywords)
  }

  /**
   * Parse the LLM category assignment response.
   */
  private parseCategoryResponse(
    content: string,
    keywords: string[]
  ): Array<{ term: string; category: KeywordCategory }> {
    try {
      const cleaned = content
        .replace(/^```(?:json)?\s*/m, '')
        .replace(/\s*```$/m, '')
        .trim()

      const data = JSON.parse(cleaned)
      const result: Array<{ term: string; category: KeywordCategory }> = []
      const categorizedTerms = new Set<string>()

      if (Array.isArray(data.categorized)) {
        for (const item of data.categorized) {
          if (typeof item.term === 'string') {
            const category = this.validateCategory(item.category)
            result.push({ term: item.term, category })
            categorizedTerms.add(item.term.toLowerCase())
          }
        }
      }

      // Ensure all keywords are categorized
      for (const keyword of keywords) {
        if (!categorizedTerms.has(keyword.toLowerCase())) {
          result.push({ term: keyword, category: 'technical' })
        }
      }

      return result
    } catch {
      return keywords.map(term => ({ term, category: 'technical' as KeywordCategory }))
    }
  }

  /**
   * Validate a category string. Returns 'technical' if invalid.
   */
  private validateCategory(category: unknown): KeywordCategory {
    const validCategories: KeywordCategory[] = [
      'technical',
      'soft_skills',
      'experience',
      'education',
    ]
    if (typeof category === 'string' && validCategories.includes(category as KeywordCategory)) {
      return category as KeywordCategory
    }
    return 'technical'
  }

  /**
   * Collect all keywords from a parsed resume.
   */
  private collectResumeKeywords(parsedResume: ParsedResume): string[] {
    const keywords: string[] = [...parsedResume.keywords, ...parsedResume.skills]

    for (const exp of parsedResume.experience) {
      keywords.push(...exp.keywords)
    }

    for (const edu of parsedResume.education) {
      keywords.push(...edu.keywords)
    }

    // Deduplicate
    return [...new Set(keywords.filter(k => k.trim().length > 0))]
  }

  /**
   * Collect all keywords from a parsed job description.
   */
  private collectJDKeywords(parsedJD: ParsedJobDescription): string[] {
    const keywords: string[] = [
      ...parsedJD.keywords,
      ...parsedJD.requiredSkills,
      ...parsedJD.preferredQualifications,
    ]

    // Deduplicate
    return [...new Set(keywords.filter(k => k.trim().length > 0))]
  }

  /**
   * Execute a promise with a timeout.
   * Rejects with 'KEYWORD_MATCH_TIMEOUT' error if the timeout is exceeded.
   */
  private executeWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('KEYWORD_MATCH_TIMEOUT'))
      }, timeoutMs)

      promise
        .then((result) => {
          clearTimeout(timer)
          resolve(result)
        })
        .catch((error) => {
          clearTimeout(timer)
          reject(error)
        })
    })
  }
}

// ── Factory Function ──────────────────────────────────────────────────────────

/**
 * Create a KeywordMatcher instance with the provided LLM service adapter.
 */
export function createKeywordMatcher(
  llmService: LLMServiceAdapter
): KeywordMatcher {
  return new KeywordMatcher(llmService)
}
