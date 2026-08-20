/**
 * Unit tests for LLMServiceAdapter.
 * Tests retry logic, timeout handling, and error mapping.
 * Requirements: 8.1, 8.4, 8.5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { LLMServiceAdapter, createLLMService, type LLMRequest } from './llmServiceAdapter'

// Mock the OpenAI module
vi.mock('openai', () => {
  class MockAPIError extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.name = 'APIError'
      this.status = status
    }
  }

  class MockAPIConnectionError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'APIConnectionError'
    }
  }

  class MockAPIConnectionTimeoutError extends Error {
    constructor(message: string) {
      super(message || 'Request timed out')
      this.name = 'APIConnectionTimeoutError'
    }
  }

  const mockCreate = vi.fn()

  class MockOpenAI {
    chat = { completions: { create: mockCreate } }
    constructor() {}
  }

  MockOpenAI.APIError = MockAPIError
  MockOpenAI.APIConnectionError = MockAPIConnectionError
  MockOpenAI.APIConnectionTimeoutError = MockAPIConnectionTimeoutError

  return { default: MockOpenAI, __mockCreate: mockCreate }
})

// Access the mock
async function getMockCreate() {
  const mod = await import('openai')
  return (mod as any).__mockCreate as ReturnType<typeof vi.fn>
}

describe('LLMServiceAdapter', () => {
  let mockCreate: ReturnType<typeof vi.fn>
  const testRequest: LLMRequest = {
    systemPrompt: 'You are a helpful assistant.',
    userPrompt: 'Analyze this resume.',
    temperature: 0.3,
  }

  beforeEach(async () => {
    vi.useFakeTimers()
    mockCreate = await getMockCreate()
    mockCreate.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('createLLMService factory', () => {
    it('creates an instance with default config', () => {
      const service = createLLMService()
      expect(service).toBeInstanceOf(LLMServiceAdapter)
    })

    it('creates an instance with custom config', () => {
      const service = createLLMService({
        apiKey: 'test-key',
        model: 'gpt-4',
        maxTokens: 2048,
        timeout: 30000,
      })
      expect(service).toBeInstanceOf(LLMServiceAdapter)
    })
  })

  describe('sendRequest - successful responses', () => {
    it('returns content and token usage on success', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'Analysis complete.' } }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      })

      const service = createLLMService({ apiKey: 'test-key' })
      const resultPromise = service.sendRequest(testRequest)
      await vi.runAllTimersAsync()
      const result = await resultPromise

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.response.content).toBe('Analysis complete.')
        expect(result.response.tokensUsed).toEqual({
          prompt: 100,
          completion: 50,
          total: 150,
        })
      }
    })

    it('returns empty content when no choices returned', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: '' } }],
        usage: { prompt_tokens: 10, completion_tokens: 0, total_tokens: 10 },
      })

      const service = createLLMService({ apiKey: 'test-key' })
      const resultPromise = service.sendRequest(testRequest)
      await vi.runAllTimersAsync()
      const result = await resultPromise

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.response.content).toBe('')
      }
    })

    it('handles missing usage data gracefully', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'Done' } }],
        usage: undefined,
      })

      const service = createLLMService({ apiKey: 'test-key' })
      const resultPromise = service.sendRequest(testRequest)
      await vi.runAllTimersAsync()
      const result = await resultPromise

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.response.tokensUsed).toEqual({ prompt: 0, completion: 0, total: 0 })
      }
    })

    it('uses default temperature 0.3 when not specified', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'OK' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      })

      const service = createLLMService({ apiKey: 'test-key' })
      const resultPromise = service.sendRequest({
        systemPrompt: 'sys',
        userPrompt: 'usr',
      })
      await vi.runAllTimersAsync()
      await resultPromise

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ temperature: 0.3 }),
        expect.anything()
      )
    })
  })

  describe('sendRequest - error mapping', () => {
    it('maps rate limit error (429) to RATE_LIMITED', async () => {
      const OpenAI = (await import('openai')).default as any
      mockCreate.mockRejectedValue(new OpenAI.APIError(429, 'Rate limited'))

      const service = createLLMService({ apiKey: 'test-key' })
      const resultPromise = service.sendRequest(testRequest)
      await vi.runAllTimersAsync()
      const result = await resultPromise

      // After retries exhausted it should still be RATE_LIMITED
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('RATE_LIMITED')
        expect(result.error.retryAfterMs).toBe(30000)
        expect(result.error.message).toContain('rate limiting')
      }
    })

    it('maps 5xx server error to UNAVAILABLE', async () => {
      const OpenAI = (await import('openai')).default as any
      mockCreate.mockRejectedValue(new OpenAI.APIError(500, 'Internal Server Error'))

      const service = createLLMService({ apiKey: 'test-key' })
      const resultPromise = service.sendRequest(testRequest)
      await vi.runAllTimersAsync()
      const result = await resultPromise

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('UNAVAILABLE')
        expect(result.error.message).toContain('temporarily unavailable')
      }
    })

    it('maps 4xx client error to API_ERROR without retries', async () => {
      const OpenAI = (await import('openai')).default as any
      mockCreate.mockRejectedValueOnce(new OpenAI.APIError(400, 'Bad request'))

      const service = createLLMService({ apiKey: 'test-key' })
      const resultPromise = service.sendRequest(testRequest)
      await vi.runAllTimersAsync()
      const result = await resultPromise

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('API_ERROR')
        expect(result.error.message).toContain('service error')
      }
      // Should NOT retry on 4xx errors (only 1 call)
      expect(mockCreate).toHaveBeenCalledTimes(1)
    })

    it('maps connection error to UNAVAILABLE', async () => {
      const OpenAI = (await import('openai')).default as any
      mockCreate.mockRejectedValue(new OpenAI.APIConnectionError('ECONNREFUSED'))

      const service = createLLMService({ apiKey: 'test-key' })
      const resultPromise = service.sendRequest(testRequest)
      await vi.runAllTimersAsync()
      const result = await resultPromise

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('UNAVAILABLE')
      }
    })

    it('maps timeout error to TIMEOUT', async () => {
      const OpenAI = (await import('openai')).default as any
      mockCreate.mockRejectedValueOnce(new OpenAI.APIConnectionTimeoutError('Request timed out'))

      const service = createLLMService({ apiKey: 'test-key' })
      const resultPromise = service.sendRequest(testRequest)
      await vi.runAllTimersAsync()
      const result = await resultPromise

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('TIMEOUT')
        expect(result.error.message).toContain('taking longer than expected')
      }
      // Timeout errors should NOT be retried
      expect(mockCreate).toHaveBeenCalledTimes(1)
    })

    it('maps abort error to TIMEOUT', async () => {
      const abortError = new Error('The operation was aborted')
      abortError.name = 'AbortError'
      mockCreate.mockRejectedValueOnce(abortError)

      const service = createLLMService({ apiKey: 'test-key' })
      const resultPromise = service.sendRequest(testRequest)
      await vi.runAllTimersAsync()
      const result = await resultPromise

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('TIMEOUT')
      }
    })
  })

  describe('sendRequest - retry logic', () => {
    it('retries up to 2 times on 5xx errors', async () => {
      const OpenAI = (await import('openai')).default as any
      mockCreate.mockRejectedValue(new OpenAI.APIError(503, 'Service Unavailable'))

      const service = createLLMService({ apiKey: 'test-key' })
      const resultPromise = service.sendRequest(testRequest)
      await vi.runAllTimersAsync()
      const result = await resultPromise

      // Initial + 2 retries = 3 total attempts
      expect(mockCreate).toHaveBeenCalledTimes(3)
      expect(result.success).toBe(false)
    })

    it('retries on rate limit errors', async () => {
      const OpenAI = (await import('openai')).default as any
      mockCreate.mockRejectedValue(new OpenAI.APIError(429, 'Rate limited'))

      const service = createLLMService({ apiKey: 'test-key' })
      const resultPromise = service.sendRequest(testRequest)
      await vi.runAllTimersAsync()
      const result = await resultPromise

      // Initial + 2 retries = 3 total attempts
      expect(mockCreate).toHaveBeenCalledTimes(3)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('RATE_LIMITED')
      }
    })

    it('succeeds on retry after initial failure', async () => {
      const OpenAI = (await import('openai')).default as any
      mockCreate
        .mockRejectedValueOnce(new OpenAI.APIError(500, 'Server Error'))
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'Recovered!' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        })

      const service = createLLMService({ apiKey: 'test-key' })
      const resultPromise = service.sendRequest(testRequest)
      await vi.runAllTimersAsync()
      const result = await resultPromise

      expect(mockCreate).toHaveBeenCalledTimes(2)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.response.content).toBe('Recovered!')
      }
    })

    it('does NOT retry on non-retryable errors (4xx, timeout)', async () => {
      const OpenAI = (await import('openai')).default as any
      mockCreate.mockRejectedValueOnce(new OpenAI.APIError(401, 'Unauthorized'))

      const service = createLLMService({ apiKey: 'test-key' })
      const resultPromise = service.sendRequest(testRequest)
      await vi.runAllTimersAsync()
      const result = await resultPromise

      // Only 1 attempt - no retries
      expect(mockCreate).toHaveBeenCalledTimes(1)
      expect(result.success).toBe(false)
    })
  })

  describe('configuration', () => {
    it('uses gpt-4o-mini as default model', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'OK' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      })

      const service = createLLMService({ apiKey: 'test-key' })
      const resultPromise = service.sendRequest(testRequest)
      await vi.runAllTimersAsync()
      await resultPromise

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gpt-4o-mini' }),
        expect.anything()
      )
    })

    it('uses 4096 as default maxTokens', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'OK' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      })

      const service = createLLMService({ apiKey: 'test-key' })
      const resultPromise = service.sendRequest(testRequest)
      await vi.runAllTimersAsync()
      await resultPromise

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ max_tokens: 4096 }),
        expect.anything()
      )
    })

    it('allows custom model override', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'OK' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      })

      const service = createLLMService({ apiKey: 'test-key', model: 'gpt-4' })
      const resultPromise = service.sendRequest(testRequest)
      await vi.runAllTimersAsync()
      await resultPromise

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gpt-4' }),
        expect.anything()
      )
    })
  })
})
