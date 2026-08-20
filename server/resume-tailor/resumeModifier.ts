/**
 * ResumeModifier service.
 * Applies accepted suggestions to produce a tailored resume and detects conflicts
 * when multiple suggestions target the same section.
 *
 * Requirements: 5.3, 5.6, 5.7, 5.8
 */

import type { ParsedResume, Suggestion, TailoredResume, ModifiedSection } from './types'
import { SUGGESTION_APPLY_TIMEOUT } from './constants'

// ── Exported Types ────────────────────────────────────────────────────────────

/** A pair of suggestions that conflict because they target the same section */
export interface ConflictPair {
  suggestionA: string
  suggestionB: string
  sectionId: string
}

/** Result of applying suggestions — either success with the tailored resume, or failure */
export type ApplyResult =
  | { success: true; tailoredResume: TailoredResume; skippedSuggestions: string[] }
  | { success: false; error: string }

// ── Conflict Detection ────────────────────────────────────────────────────────

/**
 * Detects conflicting suggestions that target the same resume section.
 * Groups suggestions by targetSectionId and returns all conflicting pairs
 * when 2+ suggestions target the same section.
 */
export function detectConflicts(suggestions: Suggestion[]): ConflictPair[] {
  const conflicts: ConflictPair[] = []

  // Group suggestions by targetSectionId
  const grouped = new Map<string, Suggestion[]>()
  for (const suggestion of suggestions) {
    const existing = grouped.get(suggestion.targetSectionId)
    if (existing) {
      existing.push(suggestion)
    } else {
      grouped.set(suggestion.targetSectionId, [suggestion])
    }
  }

  // For each section with 2+ suggestions, generate all conflict pairs
  for (const [sectionId, group] of grouped) {
    if (group.length >= 2) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          conflicts.push({
            suggestionA: group[i].id,
            suggestionB: group[j].id,
            sectionId,
          })
        }
      }
    }
  }

  return conflicts
}

// ── Suggestion Application ────────────────────────────────────────────────────

/**
 * Applies accepted suggestions to the parsed resume to produce a tailored resume.
 *
 * - Only applies suggestions with status 'accepted'
 * - For each section, applies suggestions in priority order (lower number = higher priority)
 * - Replaces originalText with suggestedText in the section content
 * - If a suggestion's originalText is not found in the section, it is skipped (partial failure)
 * - Unaffected sections remain byte-for-byte identical
 * - Reconstructs full content preserving section ordering and headings
 * - Returns within the SUGGESTION_APPLY_TIMEOUT (3 seconds)
 */
export function applySuggestions(resume: ParsedResume, suggestions: Suggestion[]): ApplyResult {
  const startTime = Date.now()

  try {
    // Filter to only accepted suggestions
    const accepted = suggestions.filter(s => s.status === 'accepted')

    if (accepted.length === 0) {
      return {
        success: true,
        tailoredResume: {
          content: resume.rawText,
          appliedSuggestionIds: [],
          modifiedSections: [],
        },
        skippedSuggestions: [],
      }
    }

    // Group accepted suggestions by targetSectionId
    const suggestionsBySection = new Map<string, Suggestion[]>()
    for (const suggestion of accepted) {
      const existing = suggestionsBySection.get(suggestion.targetSectionId)
      if (existing) {
        existing.push(suggestion)
      } else {
        suggestionsBySection.set(suggestion.targetSectionId, [suggestion])
      }
    }

    // Sort each group by priority (lower number = higher priority)
    for (const group of suggestionsBySection.values()) {
      group.sort((a, b) => a.priority - b.priority)
    }

    const appliedSuggestionIds: string[] = []
    const skippedSuggestions: string[] = []
    const modifiedSections: ModifiedSection[] = []

    // Build the tailored content by processing sections in original order
    let tailoredContent = resume.rawText

    for (const section of resume.sections) {
      // Check timeout
      if (Date.now() - startTime > SUGGESTION_APPLY_TIMEOUT) {
        return { success: false, error: 'Suggestion application timed out' }
      }

      const sectionSuggestions = suggestionsBySection.get(section.id)
      if (!sectionSuggestions || sectionSuggestions.length === 0) {
        // Unaffected section — no changes needed
        continue
      }

      // Apply suggestions to this section's content
      let modifiedContent = section.content
      const sectionAppliedIds: string[] = []

      for (const suggestion of sectionSuggestions) {
        // Check timeout per suggestion
        if (Date.now() - startTime > SUGGESTION_APPLY_TIMEOUT) {
          return { success: false, error: 'Suggestion application timed out' }
        }

        // Attempt to replace originalText with suggestedText
        if (modifiedContent.includes(suggestion.originalText)) {
          modifiedContent = modifiedContent.replace(suggestion.originalText, suggestion.suggestedText)
          sectionAppliedIds.push(suggestion.id)
          appliedSuggestionIds.push(suggestion.id)
        } else {
          // Partial failure: originalText not found, skip this suggestion
          skippedSuggestions.push(suggestion.id)
        }
      }

      // If any suggestions were applied to this section, record the modification
      if (sectionAppliedIds.length > 0) {
        modifiedSections.push({
          sectionId: section.id,
          originalContent: section.content,
          modifiedContent,
          appliedSuggestionIds: sectionAppliedIds,
        })

        // Replace the section content in the full tailored content
        tailoredContent = tailoredContent.replace(section.content, modifiedContent)
      }
    }

    return {
      success: true,
      tailoredResume: {
        content: tailoredContent,
        appliedSuggestionIds,
        modifiedSections,
      },
      skippedSuggestions,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error during suggestion application'
    return { success: false, error: message }
  }
}
