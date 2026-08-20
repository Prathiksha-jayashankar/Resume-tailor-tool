/**
 * Resume Parser Service - Extracts structured data from plain text resume content.
 * Uses LLM for intelligent extraction of skills, experience, education, and keywords.
 * Enforces 10-second processing timeout.
 * Requirements: 1.6
 */

import type { LLMServiceAdapter } from './llmServiceAdapter'
import type {
  ParsedResume,
  ExperienceEntry,
  EducationEntry,
  ResumeSection,
} from './types'
import { FILE_PARSE_TIMEOUT } from './constants'

// ── Result Type ───────────────────────────────────────────────────────────────

export type ResumeParserResult =
  | { success: true; data: ParsedResume }
  | { success: false; error: string }

// ── Section Detection ─────────────────────────────────────────────────────────

/**
 * Regex patterns to detect section headings in resume text.
 * Matches:
 * - Lines that are ALL CAPS (e.g., "EXPERIENCE", "EDUCATION")
 * - Lines ending with a colon (e.g., "Work Experience:")
 * - Common resume headings (case-insensitive)
 */
const COMMON_HEADINGS = [
  'summary',
  'objective',
  'experience',
  'work experience',
  'professional experience',
  'employment history',
  'work history',
  'education',
  'skills',
  'technical skills',
  'core competencies',
  'certifications',
  'certificates',
  'projects',
  'awards',
  'achievements',
  'publications',
  'references',
  'languages',
  'interests',
  'hobbies',
  'volunteer',
  'volunteer experience',
  'professional development',
  'training',
  'qualifications',
  'profile',
  'about me',
  'contact',
  'contact information',
]

/**
 * Detect whether a line is a section heading.
 */
function isSectionHeading(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed || trimmed.length > 80) return false

  // ALL CAPS line (at least 3 alpha characters)
  if (/^[A-Z\s&\-/]+$/.test(trimmed) && /[A-Z]{3,}/.test(trimmed)) {
    return true
  }

  // Line ending with a colon
  if (/^[A-Za-z\s&\-/]+:$/.test(trimmed)) {
    return true
  }

  // Common heading match (case-insensitive)
  const normalized = trimmed.replace(/:$/, '').toLowerCase().trim()
  if (COMMON_HEADINGS.includes(normalized)) {
    return true
  }

  return false
}

/**
 * Split resume text into logical sections based on detected headings.
 * Each section gets a unique ID and start/end character indices.
 */
function splitIntoSections(text: string): ResumeSection[] {
  const lines = text.split('\n')
  const sections: ResumeSection[] = []
  let currentHeading = ''
  let currentStartIndex = 0
  let currentContent: string[] = []
  let sectionIndex = 0
  let charOffset = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (isSectionHeading(line) && i > 0) {
      // Save the previous section if it has content
      if (currentContent.length > 0 || currentHeading) {
        const content = currentContent.join('\n').trim()
        if (content || currentHeading) {
          sections.push({
            id: `section-${sectionIndex}`,
            heading: currentHeading || 'Header',
            content,
            startIndex: currentStartIndex,
            endIndex: charOffset - 1,
          })
          sectionIndex++
        }
      }

      // Start a new section
      currentHeading = line.trim().replace(/:$/, '')
      currentStartIndex = charOffset
      currentContent = []
    } else {
      currentContent.push(line)
    }

    charOffset += line.length + 1 // +1 for the newline character
  }

  // Save the last section
  if (currentContent.length > 0 || currentHeading) {
    const content = currentContent.join('\n').trim()
    if (content || currentHeading) {
      sections.push({
        id: `section-${sectionIndex}`,
        heading: currentHeading || 'Header',
        content,
        startIndex: currentStartIndex,
        endIndex: text.length - 1,
      })
    }
  }

  return sections
}

// ── LLM Extraction Prompt ─────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a resume parser. Extract structured information from the provided resume text. Return ONLY valid JSON with no additional text or markdown formatting.

The JSON must have this exact structure:
{
  "skills": ["skill1", "skill2", ...],
  "experience": [
    {
      "title": "Job Title",
      "company": "Company Name",
      "duration": "Start - End",
      "description": "Brief description of role and achievements",
      "keywords": ["keyword1", "keyword2"]
    }
  ],
  "education": [
    {
      "degree": "Degree Name",
      "institution": "School Name",
      "year": "Year or range",
      "keywords": ["keyword1", "keyword2"]
    }
  ],
  "keywords": ["keyword1", "keyword2", ...]
}

Rules:
- Extract ALL technical skills, tools, languages, and frameworks mentioned
- Extract ALL work experience entries with as much detail as available
- Extract ALL education entries
- The "keywords" field should contain important terms that summarize the candidate's profile (technical terms, industry terms, methodologies, certifications)
- If a field cannot be determined, use an empty string for strings or empty array for arrays
- Do NOT invent or hallucinate information not present in the text`

/**
 * Parse the LLM response JSON into structured data.
 * Returns default empty structures if parsing fails.
 */
function parseLLMResponse(content: string): {
  skills: string[]
  experience: ExperienceEntry[]
  education: EducationEntry[]
  keywords: string[]
} {
  const defaults = {
    skills: [] as string[],
    experience: [] as ExperienceEntry[],
    education: [] as EducationEntry[],
    keywords: [] as string[],
  }

  try {
    // Strip potential markdown code fences
    const cleaned = content
      .replace(/^```(?:json)?\s*/m, '')
      .replace(/\s*```$/m, '')
      .trim()

    const parsed = JSON.parse(cleaned)

    const skills = Array.isArray(parsed.skills)
      ? parsed.skills.filter((s: unknown) => typeof s === 'string')
      : []

    const experience = Array.isArray(parsed.experience)
      ? parsed.experience.map((e: Record<string, unknown>) => ({
          title: typeof e.title === 'string' ? e.title : '',
          company: typeof e.company === 'string' ? e.company : '',
          duration: typeof e.duration === 'string' ? e.duration : '',
          description: typeof e.description === 'string' ? e.description : '',
          keywords: Array.isArray(e.keywords)
            ? e.keywords.filter((k: unknown) => typeof k === 'string')
            : [],
        }))
      : []

    const education = Array.isArray(parsed.education)
      ? parsed.education.map((e: Record<string, unknown>) => ({
          degree: typeof e.degree === 'string' ? e.degree : '',
          institution: typeof e.institution === 'string' ? e.institution : '',
          year: typeof e.year === 'string' ? e.year : '',
          keywords: Array.isArray(e.keywords)
            ? e.keywords.filter((k: unknown) => typeof k === 'string')
            : [],
        }))
      : []

    const keywords = Array.isArray(parsed.keywords)
      ? parsed.keywords.filter((k: unknown) => typeof k === 'string')
      : []

    return { skills, experience, education, keywords }
  } catch {
    return defaults
  }
}

// ── ResumeParserService Class ─────────────────────────────────────────────────

export class ResumeParserService {
  private llmService: LLMServiceAdapter

  constructor(llmService: LLMServiceAdapter) {
    this.llmService = llmService
  }

  /**
   * Parse resume text into structured data.
   * Splits into sections, then uses LLM for intelligent extraction.
   * Enforces FILE_PARSE_TIMEOUT (10 seconds).
   */
  async parseResume(text: string): Promise<ResumeParserResult> {
    try {
      const result = await this.executeWithTimeout(
        this.doParse(text),
        FILE_PARSE_TIMEOUT
      )
      return result
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'PARSE_TIMEOUT') {
        return {
          success: false,
          error: 'Resume parsing timed out. Please try again with a shorter resume or retry.',
        }
      }
      return {
        success: false,
        error: 'An unexpected error occurred while parsing the resume.',
      }
    }
  }

  /**
   * Core parsing logic: section splitting + LLM extraction.
   */
  private async doParse(text: string): Promise<ResumeParserResult> {
    // Step 1: Split text into sections using heading detection
    const sections = splitIntoSections(text)

    // Step 2: Call LLM to extract skills, experience, education, keywords
    const llmResult = await this.llmService.sendRequest({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: text,
      temperature: 0.1,
    })

    if (!llmResult.success) {
      return {
        success: false,
        error: `Failed to parse resume: ${llmResult.error.message}`,
      }
    }

    // Step 3: Parse LLM response and map to ParsedResume
    const extracted = parseLLMResponse(llmResult.response.content)

    const parsedResume: ParsedResume = {
      rawText: text,
      skills: extracted.skills,
      experience: extracted.experience,
      education: extracted.education,
      keywords: extracted.keywords,
      sections,
    }

    return { success: true, data: parsedResume }
  }

  /**
   * Execute a promise with a timeout.
   * Rejects with 'PARSE_TIMEOUT' error if the timeout is exceeded.
   */
  private executeWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('PARSE_TIMEOUT'))
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

// ── Exported Utilities (for testing) ──────────────────────────────────────────

export { splitIntoSections, isSectionHeading, parseLLMResponse }

// ── Factory Function ──────────────────────────────────────────────────────────

/**
 * Create a ResumeParserService instance with the provided LLM service adapter.
 */
export function createResumeParser(
  llmService: LLMServiceAdapter
): ResumeParserService {
  return new ResumeParserService(llmService)
}
