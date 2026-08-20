/**
 * Shared constants for the Resume Tailor Tool.
 * Includes weights, timeouts, character limits, and file validation rules.
 */

import type { KeywordCategory } from './types'

// ── Category Weights for Score Calculation ────────────────────────────────────

/** Weighted percentages for match score calculation (Requirements 3.4) */
export const CATEGORY_WEIGHTS: Record<KeywordCategory, number> = {
  technical: 0.40,
  experience: 0.30,
  soft_skills: 0.20,
  education: 0.10,
}

// ── Timeout Values (milliseconds) ────────────────────────────────────────────

/** Maximum time for file parsing / resume text extraction (Requirements 1.3) */
export const FILE_PARSE_TIMEOUT = 10_000

/** Maximum time for job description analysis (Requirements 2.2) */
export const JD_ANALYSIS_TIMEOUT = 10_000

/** Maximum time for keyword matching (Requirements 3.1) */
export const KEYWORD_MATCH_TIMEOUT = 30_000

/** Maximum time for LLM response (Requirements 8.5) */
export const LLM_RESPONSE_TIMEOUT = 60_000

/** Maximum time for suggestion application (Requirements 5.3) */
export const SUGGESTION_APPLY_TIMEOUT = 3_000

/** Maximum time for download file generation (Requirements 6.3) */
export const DOWNLOAD_GENERATION_TIMEOUT = 5_000

// ── Character Limits ──────────────────────────────────────────────────────────

/** Maximum characters for resume input (Requirements 1.1) */
export const RESUME_MAX_CHARS = 50_000

/** Maximum characters for job description input (Requirements 2.1) */
export const JD_MAX_CHARS = 15_000

/** Minimum characters for job description before showing a warning (Requirements 2.3) */
export const JD_MIN_WARNING_CHARS = 50

/** Minimum characters required for valid resume content (Requirements 1.5) */
export const RESUME_MIN_CHARS = 50

/** Maximum characters for job title in download filename (Requirements 6.4) */
export const FILENAME_MAX_TITLE_CHARS = 50

// ── File Validation ───────────────────────────────────────────────────────────

/** Accepted file extensions for resume upload (Requirements 1.2) */
export const VALID_FILE_EXTENSIONS = ['.pdf', '.docx', '.txt'] as const

/** Maximum file size in bytes (5 MB) (Requirements 1.2) */
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024

// ── Session Configuration ─────────────────────────────────────────────────────

/** Session timeout in milliseconds (30 minutes of inactivity) (Requirements 9.2) */
export const SESSION_TIMEOUT_MS = 30 * 60 * 1000
