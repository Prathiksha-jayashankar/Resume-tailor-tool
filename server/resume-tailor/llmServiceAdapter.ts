/**
 * LLM Service Adapter - Abstraction over OpenAI GPT API.
 * Handles retries, timeouts (60s), and error mapping.
 * Requirements: 8.1, 8.4, 8.5
 */

import OpenAI from 'openai'
import { LLM_RESPONSE_TIMEOUT } from './constants'

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface LLMServiceConfig {
  apiKey: string
  model: string
  maxTokens: number
  timeout: number
}

export interface LLMRequest {
  systemPrompt: string
  userPrompt: string
  temperature?: number
}

export interface LLMResponse {
  content: string
  tokensUsed: { prompt: number; completion: number; total: number }
}

export type LLMErrorCode = 'TIMEOUT' | 'UNAVAILABLE' | 'API_ERROR' | 'RATE_LIMITED'

export interface LLMError {
  code: LLMErrorCode
  message: string
  retryAfterMs?: number
}

export type LLMResult =
  | { success: true; response: LLMResponse }
  | { success: false; error: LLMError }

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_MODEL = 'gpt-4o-mini'
const DEFAULT_MAX_TOKENS = 4096
const DEFAULT_TEMPERATURE = 0.3
const MAX_RETRIES = 2
const INITIAL_BACKOFF_MS = 1000

// ── LLMServiceAdapter Class ───────────────────────────────────────────────────

export class LLMServiceAdapter {
  private client: OpenAI
  private config: LLMServiceConfig

  constructor(config?: Partial<LLMServiceConfig>) {
    this.config = {
      apiKey: config?.apiKey || process.env.OPENAI_API_KEY || '',
      model: config?.model || DEFAULT_MODEL,
      maxTokens: config?.maxTokens || DEFAULT_MAX_TOKENS,
      timeout: config?.timeout || LLM_RESPONSE_TIMEOUT,
    }

    this.client = new OpenAI({
      apiKey: this.config.apiKey,
      timeout: this.config.timeout,
    })
  }

  /**
   * Send a request to the LLM with retry logic and timeout handling.
   * Retries up to 2 times on 5xx errors or rate limits with exponential backoff (1s, 2s).
   */
  async sendRequest(request: LLMRequest): Promise<LLMResult> {
    let lastError: LLMError | null = null

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        const backoffMs = INITIAL_BACKOFF_MS * attempt
        await this.sleep(backoffMs)
      }

      const result = await this.executeRequest(request)

      if (result.success) {
        return result
      }

      lastError = result.error

      // Only retry on 5xx (UNAVAILABLE) or rate limit errors
      if (result.error.code !== 'UNAVAILABLE' && result.error.code !== 'RATE_LIMITED') {
        return result
      }
    }

    // All retries exhausted
    return { success: false, error: lastError! }
  }

  /**
   * Execute a single request attempt with AbortController timeout.
   */
  private async executeRequest(request: LLMRequest): Promise<LLMResult> {
    const abortController = new AbortController()
    const timeoutId = setTimeout(() => {
      abortController.abort()
    }, this.config.timeout)

    try {
      const completion = await this.client.chat.completions.create(
        {
          model: this.config.model,
          max_tokens: this.config.maxTokens,
          temperature: request.temperature ?? DEFAULT_TEMPERATURE,
          messages: [
            { role: 'system', content: request.systemPrompt },
            { role: 'user', content: request.userPrompt },
          ],
        },
        { signal: abortController.signal }
      )

      clearTimeout(timeoutId)

      const content = completion.choices[0]?.message?.content || ''
      const usage = completion.usage

      return {
        success: true,
        response: {
          content,
          tokensUsed: {
            prompt: usage?.prompt_tokens ?? 0,
            completion: usage?.completion_tokens ?? 0,
            total: usage?.total_tokens ?? 0,
          },
        },
      }
    } catch (error: unknown) {
      clearTimeout(timeoutId)
      return { success: false, error: this.mapError(error) }
    }
  }

  /**
   * Map raw errors to structured LLMError types.
   */
  private mapError(error: unknown): LLMError {
    // Timeout / abort errors
    if (this.isAbortError(error)) {
      return {
        code: 'TIMEOUT',
        message: 'Analysis is taking longer than expected. The request has been cancelled.',
      }
    }

    // OpenAI API errors
    if (error instanceof OpenAI.APIError) {
      const status = error.status

      // Rate limit (429)
      if (status === 429) {
        return {
          code: 'RATE_LIMITED',
          message: 'Analysis could not be completed due to rate limiting. Please retry after 30 seconds.',
          retryAfterMs: 30000,
        }
      }

      // Server errors (5xx) or connection issues
      if (status !== undefined && status >= 500) {
        return {
          code: 'UNAVAILABLE',
          message: 'The analysis service is temporarily unavailable. Please try again later.',
        }
      }

      // Other API errors (4xx, etc.)
      return {
        code: 'API_ERROR',
        message: 'Analysis could not be completed due to a service error. Please retry after 30 seconds.',
      }
    }

    // Connection errors (network failures, ECONNREFUSED, etc.)
    if (this.isConnectionError(error)) {
      return {
        code: 'UNAVAILABLE',
        message: 'The analysis service is temporarily unavailable. Please try again later.',
      }
    }

    // Fallback for unknown errors
    return {
      code: 'API_ERROR',
      message: 'Analysis could not be completed due to a service error. Please retry after 30 seconds.',
    }
  }

  /**
   * Check if the error is an abort/timeout error.
   */
  private isAbortError(error: unknown): boolean {
    if (error instanceof Error) {
      if (error.name === 'AbortError') return true
      if (error.message?.includes('aborted')) return true
      if (error.message?.includes('timeout')) return true
      if (error.message?.includes('Request timed out')) return true
    }
    // OpenAI APIConnectionTimeoutError
    if (error instanceof OpenAI.APIConnectionTimeoutError) return true
    return false
  }

  /**
   * Check if the error is a connection error.
   */
  private isConnectionError(error: unknown): boolean {
    if (error instanceof OpenAI.APIConnectionError) return true
    if (error instanceof Error) {
      const msg = error.message?.toLowerCase() || ''
      if (msg.includes('econnrefused')) return true
      if (msg.includes('enotfound')) return true
      if (msg.includes('enetunreach')) return true
      if (msg.includes('connection')) return true
    }
    return false
  }

  /**
   * Sleep utility for retry backoff.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// ── Factory Function ──────────────────────────────────────────────────────────

/**
 * Create an LLMServiceAdapter instance with optional config overrides.
 * Reads API key from process.env.OPENAI_API_KEY if not provided.
 */
export function createLLMService(config?: Partial<LLMServiceConfig>): LLMServiceAdapter {
  return new LLMServiceAdapter(config)
}
