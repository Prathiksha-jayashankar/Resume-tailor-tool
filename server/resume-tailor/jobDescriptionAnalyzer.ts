/**
 * Job Description Analyzer Service.
 * Extracts required skills, preferred qualifications, responsibilities,
 * keywords, and job title from job description text using LLM.
 * Requirements: 2.2, 2.5
 */

import type { ParsedJobDescription } from './types'
import type { LLMServiceAdapter } from './llmServiceAdapter'
import { JD_ANALYSIS_TIMEOUT } from './constants'

// ── Result Types ──────────────────────────────────────────────────────────────

export type JDAnalysisResult =
  | { success: true; data: ParsedJobDescription }
  | { success: false; error: string }

// ── System Prompt ─────────────────────────────────────────────────────────────

const JD_ANALYSIS_SYSTEM_PROMPT = `You are a job description analysis expert. Given a job description, extract the following information and return it as a valid JSON object:

{
  "requiredSkills": ["skill1", "skill2", ...],
  "preferredQualifications": ["qualification1", "qualification2", ...],
  "responsibilities": ["responsibility1", "responsibility2", ...],
  "keywords": ["keyword1", "keyword2", ...],
  "jobTitle": "extracted job title"
}

Rules:
- "requiredSkills": List all explicitly required technical skills, tools, languages, and frameworks mentioned as mandatory.
- "preferredQualifications": List qualifications described as preferred, nice-to-have, or bonus.
- "responsibilities": List the main job responsibilities and duties.
- "keywords": List all important terms that a candidate's resume should contain to match this job, including industry terms, certifications, methodologies, and domain-specific vocabulary.
- "jobTitle": Extract the job title. If not explicitly stated, infer it from context.
- Return ONLY the JSON object with no additional text, markdown, or explanation.
- All arrays should contain non-empty strings.
- If a category has no items, return an empty array.`

// ── Error Messages ────────────────────────────────────────────────────────────

const ANALYSIS_FAILURE_MESSAGE =
  'Job description analysis could not be completed. Please try again.'

// ── JobDescriptionAnalyzer Class ──────────────────────────────────────────────

export class JobDescriptionAnalyzer {
  private llmService: LLMServiceAdapter

  constructor(llmService: LLMServiceAdapter) {
    this.llmService = llmService
  }

  /**
   * Analyze a job description text and extract structured data.
   * Enforces a 10-second timeout on the entire operation.
   */
  async analyzeJobDescription(text: string): Promise<JDAnalysisResult> {
    try {
      const result = await this.executeWithTimeout(
        this.performAnalysis(text),
        JD_ANALYSIS_TIMEOUT
      )
      return result
    } catch {
      return { success: false, error: ANALYSIS_FAILURE_MESSAGE }
    }
  }

  /**
   * Perform the LLM-based analysis of the job description.
   */
  private async performAnalysis(text: string): Promise<JDAnalysisResult> {
    const llmResult = await this.llmService.sendRequest({
      systemPrompt: JD_ANALYSIS_SYSTEM_PROMPT,
      userPrompt: text,
      temperature: 0.2,
    })

    if (!llmResult.success) {
      return { success: false, error: ANALYSIS_FAILURE_MESSAGE }
    }

    const parsed = this.parseResponse(llmResult.response.content)

    if (!parsed) {
      return { success: false, error: ANALYSIS_FAILURE_MESSAGE }
    }

    return {
      success: true,
      data: {
        rawText: text,
        requiredSkills: parsed.requiredSkills,
        preferredQualifications: parsed.preferredQualifications,
        responsibilities: parsed.responsibilities,
        keywords: parsed.keywords,
        jobTitle: parsed.jobTitle,
      },
    }
  }

  /**
   * Parse the LLM response content into structured job description data.
   * Returns null if parsing fails.
   */
  private parseResponse(content: string): Omit<ParsedJobDescription, 'rawText'> | null {
    try {
      // Strip markdown code fences if present
      const cleaned = content
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim()

      const data = JSON.parse(cleaned)

      // Validate required fields exist and are arrays/strings
      if (!this.isValidParsedData(data)) {
        return null
      }

      return {
        requiredSkills: this.ensureStringArray(data.requiredSkills),
        preferredQualifications: this.ensureStringArray(data.preferredQualifications),
        responsibilities: this.ensureStringArray(data.responsibilities),
        keywords: this.ensureStringArray(data.keywords),
        jobTitle: typeof data.jobTitle === 'string' ? data.jobTitle.trim() : '',
      }
    } catch {
      return null
    }
  }

  /**
   * Validate that parsed data has the expected shape.
   */
  private isValidParsedData(data: unknown): data is Record<string, unknown> {
    if (typeof data !== 'object' || data === null) return false
    const obj = data as Record<string, unknown>
    return (
      Array.isArray(obj.requiredSkills) &&
      Array.isArray(obj.preferredQualifications) &&
      Array.isArray(obj.responsibilities) &&
      Array.isArray(obj.keywords) &&
      typeof obj.jobTitle === 'string'
    )
  }

  /**
   * Ensure an array contains only non-empty strings.
   */
  private ensureStringArray(arr: unknown[]): string[] {
    return arr
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map(item => item.trim())
  }

  /**
   * Execute a promise with a timeout. Rejects if the timeout is exceeded.
   */
  private executeWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`))
      }, timeoutMs)

      promise
        .then(result => {
          clearTimeout(timer)
          resolve(result)
        })
        .catch(err => {
          clearTimeout(timer)
          reject(err)
        })
    })
  }
}

// ── Factory Function ──────────────────────────────────────────────────────────

/**
 * Create a JobDescriptionAnalyzer instance with the given LLM service.
 */
export function createJobDescriptionAnalyzer(
  llmService: LLMServiceAdapter
): JobDescriptionAnalyzer {
  return new JobDescriptionAnalyzer(llmService)
}
