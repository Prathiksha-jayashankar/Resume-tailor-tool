/**
 * ResumeTailorPage — main page orchestrating the full resume tailor workflow.
 *
 * Flow: PrivacyNotice → ResumeInput + JobDescription → Analyze → AnalysisView
 *       → SuggestionList → Apply → ResumePreview → Confirm → DownloadPanel
 *
 * Wrapped in a React error boundary for graceful failure handling.
 *
 * Requirements: 3.5, 3.6, 3.7, 8.4, 8.5, 7.5
 */

import React, { Component, useState, useCallback, useEffect, useRef } from 'react'
import type {
  AnalysisResult,
  Suggestion,
  TailoredResume,
} from '../../shared/types'
import { PrivacyNotice } from './PrivacyNotice'
import { ResumeInputPanel } from './ResumeInputPanel'
import { JobDescriptionPanel } from './JobDescriptionPanel'
import { LoadingIndicator } from './LoadingIndicator'
import { AnalysisView } from './AnalysisView'
import { SuggestionList } from './SuggestionList'
import { ResumePreview } from './ResumePreview'
import { DownloadPanel } from './DownloadPanel'
import { StepProgressBar, getStepIndex, FLOW_STEPS } from './StepProgressBar'
import {
  createSession,
  deleteSession,
  analyzeResume as analyzeResumeApi,
  applySuggestionsApi,
  confirmResume as confirmResumeApi,
  downloadResume as downloadResumeApi,
  ApiError,
} from './api'
import './resume-tailor.css'

// ── Flow State ────────────────────────────────────────────────────────────────

type FlowState = 'input' | 'analyzing' | 'results' | 'applying' | 'preview' | 'confirmed'

// ── Placeholder async functions removed — now wired to API (task 11.4) ────────

// ── Error Boundary ────────────────────────────────────────────────────────────

interface ErrorBoundaryProps {
  children: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class ResumeTailorErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          data-testid="error-boundary-fallback"
          role="alert"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px 24px',
            textAlign: 'center',
            minHeight: 300,
          }}
        >
          <h2
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: 'var(--text-primary, #1f2937)',
              margin: '0 0 12px 0',
            }}
          >
            Something went wrong
          </h2>
          <p
            style={{
              fontSize: 14,
              color: 'var(--text-secondary, #6b7280)',
              margin: '0 0 24px 0',
              maxWidth: 400,
            }}
          >
            An unexpected error occurred while rendering the Resume Tailor Tool.
            Please try again.
          </p>
          <button
            type="button"
            data-testid="error-boundary-reset"
            onClick={this.handleReset}
            style={{
              padding: '10px 24px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--primary, #2563eb)',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              minHeight: 44,
              minWidth: 44,
            }}
          >
            Try Again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

// ── Main Page Component ───────────────────────────────────────────────────────

function ResumeTailorPageContent() {
  // ── State ─────────────────────────────────────────────────────────────────
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false)
  const [resumeText, setResumeText] = useState('')
  const [jdText, setJdText] = useState('')
  const [jdSubmitted, setJdSubmitted] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const [flowState, setFlowState] = useState<FlowState>('input')
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [tailoredResume, setTailoredResume] = useState<TailoredResume | null>(null)
  const [loadingStartTime, setLoadingStartTime] = useState<number | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  // ── Error handling state ──────────────────────────────────────────────────
  const [errorRetryable, setErrorRetryable] = useState(false)
  const [errorIsSessionExpired, setErrorIsSessionExpired] = useState(false)
  const [retryCountdown, setRetryCountdown] = useState(0)
  const [lastAction, setLastAction] = useState<'analyze' | 'apply' | null>(null)
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Session lifecycle — create on mount, cleanup on unmount ────────────────

  // Cleanup countdown interval on unmount
  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
      }
    }
  }, [])

  // Manage retry countdown timer
  useEffect(() => {
    if (retryCountdown <= 0) {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
        countdownIntervalRef.current = null
      }
      return
    }

    countdownIntervalRef.current = setInterval(() => {
      setRetryCountdown((prev) => {
        if (prev <= 1) {
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current)
            countdownIntervalRef.current = null
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
        countdownIntervalRef.current = null
      }
    }
  }, [retryCountdown])

  /**
   * Centralized error handler: maps ApiError or generic Error into state.
   * Preserves user input (resumeText, jdText) and reverts flow state.
   */
  const handleError = useCallback((err: unknown, fallbackFlowState: FlowState) => {
    if (err instanceof ApiError) {
      setError(err.message)
      setErrorRetryable(err.retryable)
      setErrorIsSessionExpired(err.code === 'SESSION_EXPIRED')

      // Start countdown for rate-limited or delayed-retry errors
      if (err.retryAfterMs > 0 && err.retryable) {
        setRetryCountdown(Math.ceil(err.retryAfterMs / 1000))
      }
    } else {
      setError(
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred. Please try again.'
      )
      setErrorRetryable(true)
      setErrorIsSessionExpired(false)
    }

    // Revert to previous safe state — user input is preserved
    setFlowState(fallbackFlowState)
  }, [])

  /** Clear error state */
  const clearError = useCallback(() => {
    setError(null)
    setErrorRetryable(false)
    setErrorIsSessionExpired(false)
    setRetryCountdown(0)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function initSession() {
      try {
        const { sessionId: newId } = await createSession()
        if (!cancelled) {
          setSessionId(newId)
          sessionIdRef.current = newId
        }
      } catch (err) {
        if (!cancelled) {
          setError('Could not create session. Please reload the page.')
          setErrorRetryable(false)
          setErrorIsSessionExpired(false)
        }
      }
    }

    initSession()

    return () => {
      cancelled = true
      // Cleanup: delete session on unmount
      const id = sessionIdRef.current
      if (id) {
        deleteSession(id).catch(() => {
          // Best-effort cleanup — ignore errors on unmount
        })
      }
    }
  }, [])

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handlePrivacyAcknowledge = useCallback(() => {
    setPrivacyAcknowledged(true)
  }, [])

  const handleJdSubmit = useCallback(() => {
    setJdSubmitted(true)
  }, [])

  const handleAnalyze = useCallback(async () => {
    if (!sessionId) return
    clearError()
    setFlowState('analyzing')
    setLoadingStartTime(Date.now())
    setLastAction('analyze')

    try {
      const result = await analyzeResumeApi(resumeText, jdText, sessionId)
      setAnalysisResult(result)
      setSuggestions(result.suggestions)
      setFlowState('results')
    } catch (err) {
      handleError(err, 'input')
    } finally {
      setLoadingStartTime(undefined)
    }
  }, [resumeText, jdText, sessionId, clearError, handleError])

  const handleSuggestionUpdate = useCallback(
    (id: string, status: 'accepted' | 'rejected' | 'pending') => {
      setSuggestions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status } : s))
      )
    },
    []
  )

  const handleSelectAll = useCallback(() => {
    setSuggestions((prev) => prev.map((s) => ({ ...s, status: 'accepted' as const })))
  }, [])

  const handleDeselectAll = useCallback(() => {
    setSuggestions((prev) => prev.map((s) => ({ ...s, status: 'rejected' as const })))
  }, [])

  const handleApplySuggestions = useCallback(async () => {
    if (!sessionId) return
    const acceptedIds = suggestions
      .filter((s) => s.status === 'accepted')
      .map((s) => s.id)

    if (acceptedIds.length === 0) return

    clearError()
    setFlowState('applying')
    setLoadingStartTime(Date.now())
    setLastAction('apply')

    try {
      const result = await applySuggestionsApi(sessionId, acceptedIds)
      setTailoredResume(result)
      setFlowState('preview')
    } catch (err) {
      handleError(err, 'results')
    } finally {
      setLoadingStartTime(undefined)
    }
  }, [suggestions, sessionId, clearError, handleError])

  const handleConfirm = useCallback(async () => {
    if (!sessionId) return
    try {
      await confirmResumeApi(sessionId)
      setFlowState('confirmed')
    } catch (err) {
      handleError(err, 'preview')
    }
  }, [sessionId, handleError])

  const handleCancelPreview = useCallback(() => {
    setTailoredResume(null)
    setFlowState('results')
  }, [])

  /** Retry the last failed action (analyze or apply suggestions) */
  const handleRetry = useCallback(() => {
    if (lastAction === 'analyze') {
      handleAnalyze()
    } else if (lastAction === 'apply') {
      handleApplySuggestions()
    }
  }, [lastAction, handleAnalyze, handleApplySuggestions])

  /** Reload the page to start a new session (for session expiry) */
  const handleSessionRestart = useCallback(() => {
    window.location.reload()
  }, [])

  const handleDownload = useCallback(
    async (format: 'pdf' | 'docx') => {
      if (!sessionId) return
      setDownloadError(null)
      try {
        await downloadResumeApi(sessionId, format)
      } catch (err) {
        setDownloadError(
          err instanceof Error
            ? err.message
            : 'Download could not be generated. You can copy the text to clipboard instead.'
        )
      }
    },
    [sessionId]
  )

  // ── Derived state ─────────────────────────────────────────────────────────

  const isLoading = flowState === 'analyzing' || flowState === 'applying'
  const canAnalyze =
    !!sessionId &&
    resumeText.trim().length >= 50 && jdText.trim().length > 0 && jdSubmitted
  const hasAcceptedSuggestions = suggestions.some((s) => s.status === 'accepted')

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      data-testid="resume-tailor-page"
      className="resume-tailor-page"
      style={{
        maxWidth: 960,
        margin: '0 auto',
        padding: '24px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 32,
      }}
    >
      {/* Privacy Notice — blocks until acknowledged */}
      <PrivacyNotice
        isVisible={!privacyAcknowledged}
        onAcknowledge={handlePrivacyAcknowledge}
      />

      {/* Page Title */}
      <header>
        <h1
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: 'var(--text-primary, #1f2937)',
            margin: 0,
          }}
        >
          Resume Tailor Tool
        </h1>
        <p
          style={{
            fontSize: 14,
            color: 'var(--text-secondary, #6b7280)',
            margin: '8px 0 0 0',
          }}
        >
          Optimize your resume for a specific job description using AI-powered analysis.
        </p>
      </header>

      {/* Step Progress Bar */}
      <StepProgressBar currentStep={getStepIndex(flowState)} steps={FLOW_STEPS} />

      {/* Error display */}
      {error && (
        <div
          data-testid="page-error"
          role="alert"
          aria-live="assertive"
          style={{
            fontSize: 13,
            color: '#dc2626',
            background: 'rgba(239,68,68,0.06)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 8,
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <span data-testid="error-message">{error}</span>

          {/* Session expired — offer page reload */}
          {errorIsSessionExpired && (
            <button
              type="button"
              data-testid="session-restart-btn"
              onClick={handleSessionRestart}
              style={{
                alignSelf: 'flex-start',
                padding: '8px 16px',
                borderRadius: 6,
                border: '1px solid #dc2626',
                background: '#fff',
                color: '#dc2626',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                minHeight: 44,
                minWidth: 44,
              }}
            >
              Start New Session
            </button>
          )}

          {/* Retriable error — show retry button with optional countdown */}
          {errorRetryable && !errorIsSessionExpired && lastAction && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                type="button"
                data-testid="retry-btn"
                onClick={handleRetry}
                disabled={retryCountdown > 0}
                aria-label={
                  retryCountdown > 0
                    ? `Retry available in ${retryCountdown} seconds`
                    : 'Retry'
                }
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: '1px solid #dc2626',
                  background: retryCountdown > 0 ? '#f3f4f6' : '#fff',
                  color: retryCountdown > 0 ? '#9ca3af' : '#dc2626',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: retryCountdown > 0 ? 'not-allowed' : 'pointer',
                  minHeight: 44,
                  minWidth: 44,
                }}
              >
                {retryCountdown > 0 ? `Retry in ${retryCountdown}s` : 'Retry'}
              </button>
              {retryCountdown > 0 && (
                <span
                  data-testid="retry-countdown"
                  aria-live="polite"
                  style={{ fontSize: 12, color: '#6b7280' }}
                >
                  Please wait before retrying...
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Input Section: Resume + Job Description */}
      {(flowState === 'input' || flowState === 'results' || flowState === 'analyzing') && (
        <div
          data-testid="input-section"
          className="card card--elevated input-section"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 24,
          }}
        >
          <ResumeInputPanel
            value={resumeText}
            onChange={setResumeText}
            disabled={isLoading}
          />
          <JobDescriptionPanel
            value={jdText}
            onChange={setJdText}
            onSubmit={handleJdSubmit}
            isSubmitted={jdSubmitted}
            disabled={isLoading}
          />
        </div>
      )}

      {/* Analyze Button */}
      {flowState === 'input' && (
        <button
          type="button"
          data-testid="analyze-btn"
          onClick={handleAnalyze}
          disabled={!canAnalyze}
          aria-label="Analyze resume against job description"
          style={{
            alignSelf: 'center',
            padding: '12px 32px',
            borderRadius: 8,
            border: 'none',
            background: canAnalyze ? 'var(--primary, #2563eb)' : '#e5e7eb',
            color: canAnalyze ? '#fff' : '#9ca3af',
            fontSize: 16,
            fontWeight: 600,
            cursor: canAnalyze ? 'pointer' : 'not-allowed',
            minHeight: 44,
            minWidth: 44,
            transition: 'background 0.15s',
          }}
        >
          Analyze
        </button>
      )}

      {/* Loading Indicator */}
      <LoadingIndicator
        isLoading={isLoading}
        startTime={loadingStartTime}
        variant={flowState === 'analyzing' ? 'skeleton' : 'spinner'}
      />

      {/* Analysis Results */}
      {flowState === 'results' && analysisResult && (
        <>
          <div className="card card--elevated">
            <AnalysisView analysisResult={analysisResult} />
          </div>

          <SuggestionList
            suggestions={suggestions}
            onUpdate={handleSuggestionUpdate}
            onSelectAll={handleSelectAll}
            onDeselectAll={handleDeselectAll}
          />

          {/* Apply Suggestions Button */}
          <button
            type="button"
            data-testid="apply-suggestions-btn"
            onClick={handleApplySuggestions}
            disabled={!hasAcceptedSuggestions}
            aria-label="Apply accepted suggestions"
            style={{
              alignSelf: 'center',
              padding: '12px 32px',
              borderRadius: 8,
              border: 'none',
              background: hasAcceptedSuggestions
                ? '#10b981'
                : '#e5e7eb',
              color: hasAcceptedSuggestions ? '#fff' : '#9ca3af',
              fontSize: 16,
              fontWeight: 600,
              cursor: hasAcceptedSuggestions ? 'pointer' : 'not-allowed',
              minHeight: 44,
              minWidth: 44,
              transition: 'background 0.15s',
            }}
          >
            Apply Suggestions
          </button>
        </>
      )}

      {/* Resume Preview */}
      {flowState === 'preview' && tailoredResume && (
        <div className="card card--elevated">
          <ResumePreview
            tailoredResume={tailoredResume}
            onConfirm={handleConfirm}
            onCancel={handleCancelPreview}
          />
        </div>
      )}

      {/* Download Panel */}
      {flowState === 'confirmed' && tailoredResume && (
        <div className="card card--elevated">
          <DownloadPanel
            onDownload={handleDownload}
            tailoredContent={tailoredResume.content}
            error={downloadError}
          />
        </div>
      )}
    </div>
  )
}

// ── Default Export (Wrapped in Error Boundary) ────────────────────────────────

export default function ResumeTailorPage() {
  return (
    <ResumeTailorErrorBoundary>
      <ResumeTailorPageContent />
    </ResumeTailorErrorBoundary>
  )
}

export { ResumeTailorErrorBoundary, ResumeTailorPageContent }
