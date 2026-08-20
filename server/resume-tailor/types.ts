/**
 * Core TypeScript interfaces and types for the Resume Tailor Tool.
 * Shared across backend services and API responses.
 */

// ── Resume Structured Data ────────────────────────────────────────────────────

/** Resume structured data extracted by parser */
export interface ParsedResume {
  rawText: string
  skills: string[]
  experience: ExperienceEntry[]
  education: EducationEntry[]
  keywords: string[]
  sections: ResumeSection[]
}

export interface ExperienceEntry {
  title: string
  company: string
  duration: string
  description: string
  keywords: string[]
}

export interface EducationEntry {
  degree: string
  institution: string
  year: string
  keywords: string[]
}

export interface ResumeSection {
  id: string
  heading: string
  content: string
  startIndex: number
  endIndex: number
}

// ── Job Description Structured Data ───────────────────────────────────────────

/** Job description structured data */
export interface ParsedJobDescription {
  rawText: string
  requiredSkills: string[]
  preferredQualifications: string[]
  responsibilities: string[]
  keywords: string[]
  jobTitle: string
}

// ── Keyword Matching Results ──────────────────────────────────────────────────

/** Keyword matching results */
export interface KeywordMatchResult {
  exactMatches: KeywordMatch[]
  semanticMatches: KeywordMatch[]
  missingKeywords: string[]
  categories: KeywordCategories
}

export interface KeywordMatch {
  jobDescriptionTerm: string
  resumeTerm: string
  matchType: 'exact' | 'semantic'
  category: KeywordCategory
  confidence: number
}

export type KeywordCategory = 'technical' | 'soft_skills' | 'experience' | 'education'

export interface KeywordCategories {
  technical: { matched: KeywordMatch[]; missing: string[] }
  soft_skills: { matched: KeywordMatch[]; missing: string[] }
  experience: { matched: KeywordMatch[]; missing: string[] }
  education: { matched: KeywordMatch[]; missing: string[] }
}

// ── Match Score ───────────────────────────────────────────────────────────────

/** Match score with overall percentage and per-category breakdown */
export interface MatchScore {
  overall: number // 0-100
  breakdown: {
    technical: number   // 0-100, weight 40%
    experience: number  // 0-100, weight 30%
    softSkills: number  // 0-100, weight 20%
    education: number   // 0-100, weight 10%
  }
}

// ── Suggestions ───────────────────────────────────────────────────────────────

export interface Suggestion {
  id: string
  category: SuggestionCategory
  priority: number // 1 = highest
  originalText: string
  suggestedText: string
  rationale: string
  targetSectionId: string
  status: 'pending' | 'accepted' | 'rejected'
}

export type SuggestionCategory =
  | 'keyword_add'
  | 'rephrase'
  | 'skill_highlight'
  | 'section_expand'
  | 'section_reduce'

// ── Analysis Result ───────────────────────────────────────────────────────────

/** Analysis result returned to frontend */
export interface AnalysisResult {
  sessionId: string
  matchScore: MatchScore
  keywordMatches: KeywordMatchResult
  suggestions: Suggestion[]
  isWellAligned: boolean // true if score > 85
}

// ── Tailored Resume ───────────────────────────────────────────────────────────

/** Tailored resume with applied suggestions */
export interface TailoredResume {
  content: string
  appliedSuggestionIds: string[]
  modifiedSections: ModifiedSection[]
}

export interface ModifiedSection {
  sectionId: string
  originalContent: string
  modifiedContent: string
  appliedSuggestionIds: string[]
}

// ── Session Data ──────────────────────────────────────────────────────────────

/** Session data stored in memory */
export interface SessionData {
  id: string
  createdAt: number
  lastActivityAt: number
  parsedResume: ParsedResume | null
  parsedJobDescription: ParsedJobDescription | null
  analysisResult: AnalysisResult | null
  tailoredResume: TailoredResume | null
  privacyAcknowledged: boolean
}

// ── Download Configuration ────────────────────────────────────────────────────

/** Download configuration for generating output files */
export interface DownloadConfig {
  format: 'pdf' | 'docx'
  filename: string // Pattern: Resume_[JobTitle]_Tailored.[ext]
}
