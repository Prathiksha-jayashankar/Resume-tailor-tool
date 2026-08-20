/**
 * Match Score Engine for the Resume Tailor Tool.
 * Pure functions for calculating weighted match scores across categories.
 *
 * Weights (Requirements 3.4):
 *   - Technical: 40%
 *   - Experience: 30%
 *   - Soft Skills: 20%
 *   - Education: 10%
 */

import type { MatchScore } from './types'
import { CATEGORY_WEIGHTS } from './constants'

/**
 * Clamps a number to the 0–100 range.
 */
function clamp(value: number): number {
  return Math.max(0, Math.min(100, value))
}

/**
 * Calculates the overall weighted match score from per-category breakdowns.
 *
 * Each category input is clamped to 0–100 before calculation.
 * The overall score is: round(0.4 * technical + 0.3 * experience + 0.2 * softSkills + 0.1 * education)
 * Result is always between 0 and 100 inclusive.
 *
 * Requirements: 3.4, 3.5
 */
export function calculateMatchScore(breakdown: {
  technical: number
  experience: number
  softSkills: number
  education: number
}): MatchScore {
  const technical = clamp(breakdown.technical)
  const experience = clamp(breakdown.experience)
  const softSkills = clamp(breakdown.softSkills)
  const education = clamp(breakdown.education)

  const overall = Math.round(
    CATEGORY_WEIGHTS.technical * technical +
    CATEGORY_WEIGHTS.experience * experience +
    CATEGORY_WEIGHTS.soft_skills * softSkills +
    CATEGORY_WEIGHTS.education * education
  )

  return {
    overall: clamp(overall),
    breakdown: {
      technical,
      experience,
      softSkills,
      education,
    },
  }
}

/**
 * Determines whether a match score indicates strong alignment with the job description.
 * Returns true if and only if the score is strictly greater than 85.
 *
 * Requirements: 4.6
 */
export function isWellAligned(score: number): boolean {
  return score > 85
}

/**
 * Calculates a category score as a percentage of matched items out of total items.
 * Returns 0 if total is 0 (avoids division by zero).
 * Result is clamped to 0–100.
 *
 * This is a helper used by the keyword matcher to compute per-category scores
 * before passing them to calculateMatchScore().
 */
export function calculateCategoryScore(matched: number, total: number): number {
  if (total === 0) return 0
  const score = Math.round((matched / total) * 100)
  return clamp(score)
}
