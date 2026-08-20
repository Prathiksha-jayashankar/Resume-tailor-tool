/**
 * Resume content validation.
 * Pure function that validates resume text input before processing.
 */

import { RESUME_MIN_CHARS } from './constants'

/** Result of resume content validation */
export type ValidationResult =
  | { valid: true }
  | { valid: false; error: string; code: 'EMPTY' | 'WHITESPACE_ONLY' | 'TOO_SHORT' }

/**
 * Validates resume content text.
 *
 * Rejects:
 * - Empty strings
 * - Whitespace-only strings
 * - Strings with fewer than RESUME_MIN_CHARS (50) characters after trimming
 *
 * This is a pure function with no side effects.
 */
export function validateResumeContent(text: string): ValidationResult {
  if (text === '') {
    return {
      valid: false,
      error: 'Please provide resume content.',
      code: 'EMPTY',
    }
  }

  if (text.trim() === '') {
    return {
      valid: false,
      error: 'Resume content cannot contain only whitespace. Please provide valid content.',
      code: 'WHITESPACE_ONLY',
    }
  }

  if (text.trim().length < RESUME_MIN_CHARS) {
    return {
      valid: false,
      error: `Please provide valid resume content with at least ${RESUME_MIN_CHARS} characters.`,
      code: 'TOO_SHORT',
    }
  }

  return { valid: true }
}
