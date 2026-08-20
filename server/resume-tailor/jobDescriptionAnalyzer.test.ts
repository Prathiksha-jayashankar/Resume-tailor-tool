/**
 * Unit tests for JobDescriptionAnalyzer service.
 * Requirements: 2.2, 2.5
 */

import { describe, it, expect, vi } from 'vitest'
import { JobDescriptionAnalyzer, createJobDescriptionAnalyzer } from './jobDescriptionAnalyzer'
import type { LLMServiceAdapter } from './llmServiceAdapter'

// ── Helpers ───────────────────────────────────────────────────────────────────

function createMockLLMService(response?: { success: boolean; response?: { content: string; tokensUsed: { prompt: number; completion: number; total: number } }; error?: { code: string; message: string } }): LLMServiceAdapter {
  const defaultResponse = {
    success: true as const,
    response: {
      content: JSON.stringify({
        requiredSkills: ['TypeScript', 'React', 'Node.js'],
        preferredQualifications: ['AWS experience', 'GraphQL knowledge'],
        responsibilities: ['Build web applications', 'Mentor junior developers'],
        keywords: ['full-stack', 'agile', 'CI/CD'],
        jobTitle: 'Senior Software Engineer',
      }),
      tokensUsed: { prompt: 100, completion: 200, total: 300 },
    },
  }

  return {
    sendRequest: vi.fn().mockResolvedValue(response || defaultResponse),
  } as unknown as LLMServiceAdapter
}

const SAMPLE_JD = `
Senior Software Engineer - Full Stack

We are looking for a Senior Software Engineer to join our team.

Required Skills:
- TypeScript
- React
- Node.js

Preferred Qualifications:
- AWS experience
- GraphQL knowledge

Responsibilities:
- Build web applications
- Mentor junior developers
`

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('JobDescriptionAnalyzer', () => {
  describe('analyzeJobDescription', () => {
    it('should return parsed job description data on successful LLM response', async () => {
      const mockLLM = createMockLLMService()
      const analyzer = new JobDescriptionAnalyzer(mockLLM)

      const result = await analyzer.analyzeJobDescription(SAMPLE_JD)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.rawText).toBe(SAMPLE_JD)
        expect(result.data.requiredSkills).toEqual(['TypeScript', 'React', 'Node.js'])
        expect(result.data.preferredQualifications).toEqual(['AWS experience', 'GraphQL knowledge'])
        expect(result.data.responsibilities).toEqual(['Build web applications', 'Mentor junior developers'])
        expect(result.data.keywords).toEqual(['full-stack', 'agile', 'CI/CD'])
        expect(result.data.jobTitle).toBe('Senior Software Engineer')
      }
    })

    it('should pass the job description text as the user prompt to the LLM', async () => {
      const mockLLM = createMockLLMService()
      const analyzer = new JobDescriptionAnalyzer(mockLLM)

      await analyzer.analyzeJobDescription(SAMPLE_JD)

      expect(mockLLM.sendRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          userPrompt: SAMPLE_JD,
          temperature: 0.2,
        })
      )
    })

    it('should return error when LLM returns failure', async () => {
      const mockLLM = createMockLLMService({
        success: false,
        error: { code: 'API_ERROR', message: 'Service unavailable' },
      } as any)
      const analyzer = new JobDescriptionAnalyzer(mockLLM)

      const result = await analyzer.analyzeJobDescription(SAMPLE_JD)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Job description analysis could not be completed. Please try again.')
      }
    })

    it('should return error when LLM returns invalid JSON', async () => {
      const mockLLM = createMockLLMService({
        success: true,
        response: {
          content: 'This is not valid JSON at all',
          tokensUsed: { prompt: 100, completion: 50, total: 150 },
        },
      } as any)
      const analyzer = new JobDescriptionAnalyzer(mockLLM)

      const result = await analyzer.analyzeJobDescription(SAMPLE_JD)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Job description analysis could not be completed. Please try again.')
      }
    })

    it('should return error when LLM returns JSON missing required fields', async () => {
      const mockLLM = createMockLLMService({
        success: true,
        response: {
          content: JSON.stringify({ requiredSkills: ['TypeScript'] }),
          tokensUsed: { prompt: 100, completion: 50, total: 150 },
        },
      } as any)
      const analyzer = new JobDescriptionAnalyzer(mockLLM)

      const result = await analyzer.analyzeJobDescription(SAMPLE_JD)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Job description analysis could not be completed. Please try again.')
      }
    })

    it('should handle LLM response wrapped in markdown code fences', async () => {
      const jsonContent = JSON.stringify({
        requiredSkills: ['Python'],
        preferredQualifications: ['ML experience'],
        responsibilities: ['Build models'],
        keywords: ['machine learning'],
        jobTitle: 'ML Engineer',
      })
      const mockLLM = createMockLLMService({
        success: true,
        response: {
          content: '```json\n' + jsonContent + '\n```',
          tokensUsed: { prompt: 100, completion: 200, total: 300 },
        },
      } as any)
      const analyzer = new JobDescriptionAnalyzer(mockLLM)

      const result = await analyzer.analyzeJobDescription(SAMPLE_JD)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.requiredSkills).toEqual(['Python'])
        expect(result.data.jobTitle).toBe('ML Engineer')
      }
    })

    it('should filter out empty strings from arrays', async () => {
      const mockLLM = createMockLLMService({
        success: true,
        response: {
          content: JSON.stringify({
            requiredSkills: ['TypeScript', '', '  ', 'React'],
            preferredQualifications: [],
            responsibilities: ['Build apps'],
            keywords: ['keyword'],
            jobTitle: 'Developer',
          }),
          tokensUsed: { prompt: 100, completion: 200, total: 300 },
        },
      } as any)
      const analyzer = new JobDescriptionAnalyzer(mockLLM)

      const result = await analyzer.analyzeJobDescription(SAMPLE_JD)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.requiredSkills).toEqual(['TypeScript', 'React'])
      }
    })

    it('should enforce 10-second timeout', async () => {
      vi.useFakeTimers()

      const mockLLM = {
        sendRequest: vi.fn().mockImplementation(() =>
          new Promise(resolve => {
            setTimeout(() => resolve({
              success: true,
              response: {
                content: JSON.stringify({
                  requiredSkills: [],
                  preferredQualifications: [],
                  responsibilities: [],
                  keywords: [],
                  jobTitle: 'Test',
                }),
                tokensUsed: { prompt: 0, completion: 0, total: 0 },
              },
            }), 15_000) // Takes 15 seconds - exceeds timeout
          })
        ),
      } as unknown as LLMServiceAdapter

      const analyzer = new JobDescriptionAnalyzer(mockLLM)
      const resultPromise = analyzer.analyzeJobDescription(SAMPLE_JD)

      // Advance past the 10-second timeout
      await vi.advanceTimersByTimeAsync(10_001)

      const result = await resultPromise

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Job description analysis could not be completed. Please try again.')
      }

      vi.useRealTimers()
    })

    it('should return error when LLM throws an exception', async () => {
      const mockLLM = {
        sendRequest: vi.fn().mockRejectedValue(new Error('Network failure')),
      } as unknown as LLMServiceAdapter

      const analyzer = new JobDescriptionAnalyzer(mockLLM)
      const result = await analyzer.analyzeJobDescription(SAMPLE_JD)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Job description analysis could not be completed. Please try again.')
      }
    })
  })

  describe('createJobDescriptionAnalyzer', () => {
    it('should create an instance of JobDescriptionAnalyzer', () => {
      const mockLLM = createMockLLMService()
      const analyzer = createJobDescriptionAnalyzer(mockLLM)

      expect(analyzer).toBeInstanceOf(JobDescriptionAnalyzer)
    })
  })
})
