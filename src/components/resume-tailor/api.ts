/**
 * API client for the Resume Tailor Tool.
 * All calls use fetch with credentials: 'include' and proper error handling.
 *
 * Requirements: 3.7, 8.4, 8.5, 9.2, 9.3
 */

import type { AnalysisResult, TailoredResume } from '../../shared/types'

const BASE_URL = '/api/resume-tailor'

// ── Error Types ───────────────────────────────────────────────────────────────

export type ApiErrorCode =
  | 'TIMEOUT'
  | 'UNAVAILABLE'
  | 'API_ERROR'
  | 'RATE_LIMITED'
  | 'SESSION_EXPIRED'
  | 'UNKNOWN'

export class ApiError extends Error {
  code: ApiErrorCode
  retryable: boolean
  retryAfterMs: number

  constructor(message: string, code: ApiErrorCode, retryAfterMs = 0) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.retryable = code !== 'SESSION_EXPIRED'
    this.retryAfterMs = retryAfterMs
  }
}

/**
 * Maps an HTTP status and optional error body to an ApiError with appropriate
 * error code, message, and retry information.
 */
function mapResponseToApiError(
  status: number,
  body: { error?: string; code?: string; retryAfterMs?: number }
): ApiError {
  // Session expired (401 or explicit session-expired code)
  if (status === 401 || body.code === 'SESSION_EXPIRED') {
    return new ApiError(
      'Your session has expired. Please start a new session.',
      'SESSION_EXPIRED'
    )
  }

  // Rate limited (429 or explicit RATE_LIMITED code)
  if (status === 429 || body.code === 'RATE_LIMITED') {
    return new ApiError(
      body.error || 'Analysis could not be completed due to rate limiting. Please retry after 30 seconds.',
      'RATE_LIMITED',
      body.retryAfterMs || 30000
    )
  }

  // Server errors (5xx) or unavailable code
  if (status >= 500 || body.code === 'UNAVAILABLE') {
    return new ApiError(
      body.error || 'The analysis service is temporarily unavailable. Please try again later.',
      'UNAVAILABLE',
      30000
    )
  }

  // Timeout code from backend
  if (body.code === 'TIMEOUT') {
    return new ApiError(
      body.error || 'Analysis is taking longer than expected. The request has been cancelled.',
      'TIMEOUT'
    )
  }

  // General API error
  if (body.code === 'API_ERROR') {
    return new ApiError(
      body.error || 'Analysis could not be completed due to a service error. Please retry after 30 seconds.',
      'API_ERROR',
      30000
    )
  }

  // Default fallback
  return new ApiError(
    body.error || `Request failed with status ${status}`,
    'UNKNOWN'
  )
}

/**
 * Helper to make fetch calls with standard error handling.
 */
async function apiFetch<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw mapResponseToApiError(response.status, body as { error?: string; code?: string; retryAfterMs?: number })
  }

  return response.json() as Promise<T>
}

/**
 * Creates a new ephemeral session on the server.
 */
export async function createSession(): Promise<{ sessionId: string }> {
  return apiFetch<{ sessionId: string }>(`${BASE_URL}/session`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

/**
 * Deletes a session and all associated user data.
 */
export async function deleteSession(sessionId: string): Promise<void> {
  await apiFetch<{ success: boolean }>(`${BASE_URL}/session/${sessionId}`, {
    method: 'DELETE',
  })
}

/**
 * Analyzes resume content against a job description.
 */
export async function analyzeResume(
  resumeText: string,
  jobDescription: string,
  sessionId: string
): Promise<AnalysisResult> {
  return apiFetch<AnalysisResult>(`${BASE_URL}/analyze`, {
    method: 'POST',
    body: JSON.stringify({ resumeText, jobDescription, sessionId }),
  })
}

/**
 * Applies accepted suggestions to produce a tailored resume preview.
 */
export async function applySuggestionsApi(
  sessionId: string,
  acceptedSuggestionIds: string[]
): Promise<TailoredResume> {
  return apiFetch<TailoredResume>(`${BASE_URL}/apply-suggestions`, {
    method: 'POST',
    body: JSON.stringify({ sessionId, acceptedSuggestionIds }),
  })
}

/**
 * Confirms the tailored resume in the session.
 */
export async function confirmResume(sessionId: string): Promise<void> {
  await apiFetch<{ success: boolean }>(`${BASE_URL}/confirm`, {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  })
}

/**
 * Downloads the confirmed tailored resume in the specified format.
 * Triggers a browser download by creating a blob URL and clicking an anchor element.
 */
export async function downloadResume(
  sessionId: string,
  format: 'pdf' | 'docx'
): Promise<void> {
  const response = await fetch(
    `${BASE_URL}/download/${format}?sessionId=${encodeURIComponent(sessionId)}`,
    { credentials: 'include' }
  )

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    const message =
      (body as { error?: string }).error ||
      'Download could not be generated. You can copy the text to clipboard instead.'
    throw new Error(message)
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)

  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download =
    response.headers.get('Content-Disposition')?.match(/filename="?([^"]+)"?/)?.[1] ||
    `Resume_Tailored.${format}`
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()

  // Cleanup
  setTimeout(() => {
    URL.revokeObjectURL(url)
    document.body.removeChild(anchor)
  }, 100)
}
