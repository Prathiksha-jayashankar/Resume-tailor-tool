import { describe, it, expect } from 'vitest'
import { detectConflicts, applySuggestions } from './resumeModifier'
import type { Suggestion, ParsedResume } from './types'

// ── Helper Factories ──────────────────────────────────────────────────────────

function makeSuggestion(overrides: Partial<Suggestion> = {}): Suggestion {
  return {
    id: 'sug-1',
    category: 'rephrase',
    priority: 1,
    originalText: 'managed a team',
    suggestedText: 'led a cross-functional team',
    rationale: 'Stronger action verb',
    targetSectionId: 'section-1',
    status: 'accepted',
    ...overrides,
  }
}

function makeResume(overrides: Partial<ParsedResume> = {}): ParsedResume {
  return {
    rawText: '# Experience\nI managed a team of 5 engineers.\n\n# Education\nBS Computer Science',
    skills: ['JavaScript'],
    experience: [],
    education: [],
    keywords: ['team'],
    sections: [
      {
        id: 'section-1',
        heading: 'Experience',
        content: 'I managed a team of 5 engineers.',
        startIndex: 13,
        endIndex: 45,
      },
      {
        id: 'section-2',
        heading: 'Education',
        content: 'BS Computer Science',
        startIndex: 47,
        endIndex: 67,
      },
    ],
    ...overrides,
  }
}

// ── detectConflicts ───────────────────────────────────────────────────────────

describe('detectConflicts', () => {
  it('returns empty array when no suggestions share a section', () => {
    const suggestions = [
      makeSuggestion({ id: 'a', targetSectionId: 'sec-1' }),
      makeSuggestion({ id: 'b', targetSectionId: 'sec-2' }),
    ]
    expect(detectConflicts(suggestions)).toEqual([])
  })

  it('returns conflict pairs when two suggestions target the same section', () => {
    const suggestions = [
      makeSuggestion({ id: 'a', targetSectionId: 'sec-1' }),
      makeSuggestion({ id: 'b', targetSectionId: 'sec-1' }),
    ]
    const conflicts = detectConflicts(suggestions)
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]).toEqual({
      suggestionA: 'a',
      suggestionB: 'b',
      sectionId: 'sec-1',
    })
  })

  it('returns all pairs when three suggestions target the same section', () => {
    const suggestions = [
      makeSuggestion({ id: 'a', targetSectionId: 'sec-1' }),
      makeSuggestion({ id: 'b', targetSectionId: 'sec-1' }),
      makeSuggestion({ id: 'c', targetSectionId: 'sec-1' }),
    ]
    const conflicts = detectConflicts(suggestions)
    // 3 choose 2 = 3 pairs
    expect(conflicts).toHaveLength(3)
    expect(conflicts).toContainEqual({ suggestionA: 'a', suggestionB: 'b', sectionId: 'sec-1' })
    expect(conflicts).toContainEqual({ suggestionA: 'a', suggestionB: 'c', sectionId: 'sec-1' })
    expect(conflicts).toContainEqual({ suggestionA: 'b', suggestionB: 'c', sectionId: 'sec-1' })
  })

  it('returns empty array for empty input', () => {
    expect(detectConflicts([])).toEqual([])
  })

  it('handles multiple sections with conflicts independently', () => {
    const suggestions = [
      makeSuggestion({ id: 'a1', targetSectionId: 'sec-1' }),
      makeSuggestion({ id: 'a2', targetSectionId: 'sec-1' }),
      makeSuggestion({ id: 'b1', targetSectionId: 'sec-2' }),
      makeSuggestion({ id: 'b2', targetSectionId: 'sec-2' }),
    ]
    const conflicts = detectConflicts(suggestions)
    expect(conflicts).toHaveLength(2)
    expect(conflicts).toContainEqual({ suggestionA: 'a1', suggestionB: 'a2', sectionId: 'sec-1' })
    expect(conflicts).toContainEqual({ suggestionA: 'b1', suggestionB: 'b2', sectionId: 'sec-2' })
  })
})

// ── applySuggestions ──────────────────────────────────────────────────────────

describe('applySuggestions', () => {
  it('returns unchanged resume when no suggestions are accepted', () => {
    const resume = makeResume()
    const suggestions = [makeSuggestion({ status: 'pending' })]
    const result = applySuggestions(resume, suggestions)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.tailoredResume.content).toBe(resume.rawText)
      expect(result.tailoredResume.appliedSuggestionIds).toEqual([])
      expect(result.tailoredResume.modifiedSections).toEqual([])
      expect(result.skippedSuggestions).toEqual([])
    }
  })

  it('applies an accepted suggestion replacing original text', () => {
    const resume = makeResume()
    const suggestions = [makeSuggestion({ status: 'accepted' })]
    const result = applySuggestions(resume, suggestions)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.tailoredResume.content).toContain('led a cross-functional team')
      expect(result.tailoredResume.content).not.toContain('managed a team')
      expect(result.tailoredResume.appliedSuggestionIds).toEqual(['sug-1'])
      expect(result.tailoredResume.modifiedSections).toHaveLength(1)
      expect(result.tailoredResume.modifiedSections[0].sectionId).toBe('section-1')
    }
  })

  it('preserves unaffected sections byte-for-byte', () => {
    const resume = makeResume()
    const suggestions = [makeSuggestion({ status: 'accepted', targetSectionId: 'section-1' })]
    const result = applySuggestions(resume, suggestions)

    expect(result.success).toBe(true)
    if (result.success) {
      // Education section should be unchanged
      expect(result.tailoredResume.content).toContain('BS Computer Science')
    }
  })

  it('skips suggestions whose originalText is not found in the section', () => {
    const resume = makeResume()
    const suggestions = [
      makeSuggestion({
        id: 'bad-sug',
        status: 'accepted',
        originalText: 'text that does not exist',
        suggestedText: 'replacement',
        targetSectionId: 'section-1',
      }),
    ]
    const result = applySuggestions(resume, suggestions)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.skippedSuggestions).toEqual(['bad-sug'])
      expect(result.tailoredResume.appliedSuggestionIds).toEqual([])
      // Content unchanged since suggestion was skipped
      expect(result.tailoredResume.content).toBe(resume.rawText)
    }
  })

  it('applies suggestions in priority order within a section', () => {
    const resume = makeResume({
      rawText: '# Skills\nI know JavaScript and Python.\n\n# Education\nBS CS',
      sections: [
        { id: 'sec-skills', heading: 'Skills', content: 'I know JavaScript and Python.', startIndex: 9, endIndex: 38 },
        { id: 'sec-edu', heading: 'Education', content: 'BS CS', startIndex: 40, endIndex: 45 },
      ],
    })
    const suggestions = [
      makeSuggestion({
        id: 'low-priority',
        priority: 5,
        status: 'accepted',
        originalText: 'Python',
        suggestedText: 'Python/Django',
        targetSectionId: 'sec-skills',
      }),
      makeSuggestion({
        id: 'high-priority',
        priority: 1,
        status: 'accepted',
        originalText: 'JavaScript',
        suggestedText: 'JavaScript/TypeScript',
        targetSectionId: 'sec-skills',
      }),
    ]
    const result = applySuggestions(resume, suggestions)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.tailoredResume.content).toContain('JavaScript/TypeScript')
      expect(result.tailoredResume.content).toContain('Python/Django')
      expect(result.tailoredResume.appliedSuggestionIds).toContain('high-priority')
      expect(result.tailoredResume.appliedSuggestionIds).toContain('low-priority')
    }
  })

  it('handles partial application — continues when one suggestion fails', () => {
    const resume = makeResume()
    const suggestions = [
      makeSuggestion({
        id: 'will-fail',
        priority: 1,
        status: 'accepted',
        originalText: 'nonexistent text',
        suggestedText: 'replacement',
        targetSectionId: 'section-1',
      }),
      makeSuggestion({
        id: 'will-succeed',
        priority: 2,
        status: 'accepted',
        originalText: 'managed a team',
        suggestedText: 'led a team',
        targetSectionId: 'section-1',
      }),
    ]
    const result = applySuggestions(resume, suggestions)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.skippedSuggestions).toContain('will-fail')
      expect(result.tailoredResume.appliedSuggestionIds).toContain('will-succeed')
      expect(result.tailoredResume.content).toContain('led a team')
    }
  })

  it('returns success with empty arrays when given no suggestions', () => {
    const resume = makeResume()
    const result = applySuggestions(resume, [])

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.tailoredResume.content).toBe(resume.rawText)
      expect(result.tailoredResume.appliedSuggestionIds).toEqual([])
      expect(result.skippedSuggestions).toEqual([])
    }
  })

  it('ignores rejected suggestions', () => {
    const resume = makeResume()
    const suggestions = [makeSuggestion({ status: 'rejected' })]
    const result = applySuggestions(resume, suggestions)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.tailoredResume.content).toBe(resume.rawText)
      expect(result.tailoredResume.appliedSuggestionIds).toEqual([])
    }
  })
})
