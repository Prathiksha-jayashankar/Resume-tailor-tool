/**
 * Unit tests for ResumeParserService
 * Tests section detection, LLM response parsing, timeout enforcement, and full parsing flow.
 */

import { describe, it, expect, vi } from 'vitest'
import {
  ResumeParserService,
  splitIntoSections,
  isSectionHeading,
  parseLLMResponse,
  createResumeParser,
} from './resumeParserService'
import type { LLMServiceAdapter } from './llmServiceAdapter'

// ── Mock LLM Service ──────────────────────────────────────────────────────────

function createMockLLMService(
  response?: { success: true; response: { content: string; tokensUsed: { prompt: number; completion: number; total: number } } } | { success: false; error: { code: string; message: string } },
  delay = 0
): LLMServiceAdapter {
  return {
    sendRequest: vi.fn(async () => {
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay))
      }
      return response ?? {
        success: true,
        response: {
          content: JSON.stringify({
            skills: ['TypeScript', 'React'],
            experience: [{
              title: 'Software Engineer',
              company: 'Acme Corp',
              duration: '2020 - Present',
              description: 'Built web apps',
              keywords: ['React', 'TypeScript'],
            }],
            education: [{
              degree: 'B.S. Computer Science',
              institution: 'MIT',
              year: '2020',
              keywords: ['CS'],
            }],
            keywords: ['TypeScript', 'React', 'Node.js'],
          }),
          tokensUsed: { prompt: 100, completion: 200, total: 300 },
        },
      }
    }),
  } as unknown as LLMServiceAdapter
}

// ── Section Detection Tests ───────────────────────────────────────────────────

describe('isSectionHeading', () => {
  it('detects ALL CAPS headings', () => {
    expect(isSectionHeading('EXPERIENCE')).toBe(true)
    expect(isSectionHeading('WORK EXPERIENCE')).toBe(true)
    expect(isSectionHeading('EDUCATION')).toBe(true)
    expect(isSectionHeading('SKILLS & TOOLS')).toBe(true)
  })

  it('detects headings ending with colon', () => {
    expect(isSectionHeading('Experience:')).toBe(true)
    expect(isSectionHeading('Work Experience:')).toBe(true)
    expect(isSectionHeading('Technical Skills:')).toBe(true)
  })

  it('detects common headings (case-insensitive)', () => {
    expect(isSectionHeading('Experience')).toBe(true)
    expect(isSectionHeading('education')).toBe(true)
    expect(isSectionHeading('Skills')).toBe(true)
    expect(isSectionHeading('Summary')).toBe(true)
    expect(isSectionHeading('Professional Experience')).toBe(true)
  })

  it('rejects non-heading lines', () => {
    expect(isSectionHeading('Built a web app using React')).toBe(false)
    expect(isSectionHeading('')).toBe(false)
    expect(isSectionHeading('   ')).toBe(false)
    expect(isSectionHeading('a')).toBe(false)
  })

  it('rejects very long lines', () => {
    expect(isSectionHeading('A'.repeat(81))).toBe(false)
  })
})

describe('splitIntoSections', () => {
  it('splits resume text into sections based on headings', () => {
    const text = `John Doe
Software Engineer

EXPERIENCE
Worked at Acme Corp for 3 years building web apps.

EDUCATION
B.S. Computer Science from MIT, 2020`

    const sections = splitIntoSections(text)

    expect(sections.length).toBe(3)
    expect(sections[0].heading).toBe('Header')
    expect(sections[0].content).toContain('John Doe')
    expect(sections[1].heading).toBe('EXPERIENCE')
    expect(sections[1].content).toContain('Acme Corp')
    expect(sections[2].heading).toBe('EDUCATION')
    expect(sections[2].content).toContain('MIT')
  })

  it('assigns unique IDs to each section', () => {
    const text = `Header info
SKILLS
TypeScript, React
EXPERIENCE
Some experience`

    const sections = splitIntoSections(text)
    const ids = sections.map(s => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('records startIndex and endIndex for each section', () => {
    const text = `Name Line
SKILLS
TypeScript`

    const sections = splitIntoSections(text)
    for (const section of sections) {
      expect(section.startIndex).toBeGreaterThanOrEqual(0)
      expect(section.endIndex).toBeGreaterThanOrEqual(section.startIndex)
    }
  })

  it('handles text with no headings as a single section', () => {
    const text = 'Just some plain text resume without any clear headings or structure.'
    const sections = splitIntoSections(text)
    expect(sections.length).toBe(1)
    expect(sections[0].heading).toBe('Header')
  })
})

// ── LLM Response Parsing Tests ────────────────────────────────────────────────

describe('parseLLMResponse', () => {
  it('parses valid JSON response', () => {
    const json = JSON.stringify({
      skills: ['TypeScript', 'React'],
      experience: [{
        title: 'Engineer',
        company: 'Acme',
        duration: '2020-2023',
        description: 'Built stuff',
        keywords: ['React'],
      }],
      education: [{
        degree: 'BS CS',
        institution: 'MIT',
        year: '2020',
        keywords: ['CS'],
      }],
      keywords: ['TypeScript'],
    })

    const result = parseLLMResponse(json)
    expect(result.skills).toEqual(['TypeScript', 'React'])
    expect(result.experience).toHaveLength(1)
    expect(result.experience[0].title).toBe('Engineer')
    expect(result.education).toHaveLength(1)
    expect(result.education[0].degree).toBe('BS CS')
    expect(result.keywords).toEqual(['TypeScript'])
  })

  it('handles JSON wrapped in markdown code fences', () => {
    const content = '```json\n{"skills":["Python"],"experience":[],"education":[],"keywords":[]}\n```'
    const result = parseLLMResponse(content)
    expect(result.skills).toEqual(['Python'])
  })

  it('returns defaults for invalid JSON', () => {
    const result = parseLLMResponse('not valid json at all')
    expect(result.skills).toEqual([])
    expect(result.experience).toEqual([])
    expect(result.education).toEqual([])
    expect(result.keywords).toEqual([])
  })

  it('filters out non-string values from arrays', () => {
    const json = JSON.stringify({
      skills: ['valid', 123, null, 'also valid'],
      experience: [],
      education: [],
      keywords: [true, 'keyword'],
    })

    const result = parseLLMResponse(json)
    expect(result.skills).toEqual(['valid', 'also valid'])
    expect(result.keywords).toEqual(['keyword'])
  })
})

// ── ResumeParserService Tests ─────────────────────────────────────────────────

describe('ResumeParserService', () => {
  it('successfully parses resume text', async () => {
    const mockLLM = createMockLLMService()
    const service = new ResumeParserService(mockLLM)

    const result = await service.parseResume('John Doe\nSoftware Engineer\n\nEXPERIENCE\nWorked at Acme Corp building web apps with React and TypeScript.')

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.rawText).toContain('John Doe')
      expect(result.data.skills).toEqual(['TypeScript', 'React'])
      expect(result.data.experience).toHaveLength(1)
      expect(result.data.education).toHaveLength(1)
      expect(result.data.sections.length).toBeGreaterThan(0)
    }
  })

  it('returns error when LLM call fails', async () => {
    const mockLLM = createMockLLMService({
      success: false,
      error: { code: 'UNAVAILABLE', message: 'Service unavailable' },
    })
    const service = new ResumeParserService(mockLLM)

    const result = await service.parseResume('Some resume content that is long enough.')

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('Service unavailable')
    }
  })

  it('returns timeout error when processing exceeds 10 seconds', async () => {
    // Use a delay that exceeds timeout (simulated with vi.useFakeTimers)
    const mockLLM = createMockLLMService(undefined, 15_000)
    const service = new ResumeParserService(mockLLM)

    vi.useFakeTimers()
    const parsePromise = service.parseResume('Some resume content.')

    // Advance timers past the 10-second timeout
    await vi.advanceTimersByTimeAsync(11_000)

    const result = await parsePromise
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('timed out')
    }

    vi.useRealTimers()
  })
})

// ── Factory Function Tests ────────────────────────────────────────────────────

describe('createResumeParser', () => {
  it('creates a ResumeParserService instance', () => {
    const mockLLM = createMockLLMService()
    const parser = createResumeParser(mockLLM)
    expect(parser).toBeInstanceOf(ResumeParserService)
  })
})
