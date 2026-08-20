/**
 * LoadingIndicator — shows either a CSS spinner with elapsed time or skeleton
 * placeholders matching the analysis results layout during LLM processing.
 *
 * When `isLoading` is false, renders nothing.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 6.5, 7.2, 8.6, 8.7
 */

import React, { useEffect, useState } from 'react'

export interface LoadingIndicatorProps {
  isLoading: boolean
  startTime?: number
  variant?: 'spinner' | 'skeleton'
}

/** Spinner keyframe animation injected once */
const SPINNER_KEYFRAMES = `
@keyframes resume-tailor-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
`

/** Skeleton pulse keyframe animation */
const SKELETON_PULSE_KEYFRAMES = `
@keyframes resume-tailor-skeleton-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
`

let spinnerStyleInjected = false
let skeletonStyleInjected = false

function injectSpinnerStyle() {
  if (spinnerStyleInjected) return
  const style = document.createElement('style')
  style.textContent = SPINNER_KEYFRAMES
  document.head.appendChild(style)
  spinnerStyleInjected = true
}

function injectSkeletonStyle() {
  if (skeletonStyleInjected) return
  const style = document.createElement('style')
  style.textContent = SKELETON_PULSE_KEYFRAMES
  document.head.appendChild(style)
  skeletonStyleInjected = true
}

export function LoadingIndicator({
  isLoading,
  startTime,
  variant = 'spinner',
}: LoadingIndicatorProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  useEffect(() => {
    if (!isLoading) {
      setElapsedSeconds(0)
      return
    }

    if (variant === 'spinner') {
      injectSpinnerStyle()
    } else {
      injectSkeletonStyle()
    }

    // Calculate initial elapsed based on startTime
    const computeElapsed = () => {
      if (!startTime) return 0
      return Math.floor((Date.now() - startTime) / 1000)
    }

    setElapsedSeconds(computeElapsed())

    const interval = setInterval(() => {
      setElapsedSeconds(computeElapsed())
    }, 1000)

    return () => clearInterval(interval)
  }, [isLoading, startTime, variant])

  if (!isLoading) return null

  return (
    <div
      data-testid="loading-indicator"
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: 'var(--spacing-8, 32px) var(--spacing-4, 16px)',
        gap: 16,
      }}
    >
      {/* Screen reader announcement */}
      <span
        data-testid="loading-status-text"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          borderWidth: 0,
        }}
      >
        Loading analysis results
      </span>

      {variant === 'spinner' ? (
        <SpinnerContent elapsedSeconds={elapsedSeconds} />
      ) : (
        <SkeletonContent />
      )}

      {/* AI Disclaimer — shown in both variants */}
      <div
        data-testid="ai-disclaimer"
        style={{
          fontSize: 12,
          color: 'var(--text-muted, #94a3b8)',
          textAlign: 'center',
          maxWidth: 360,
          lineHeight: 1.5,
          marginTop: 8,
        }}
      >
        AI suggestions are machine-generated and should be reviewed and verified before submission.
      </div>
    </div>
  )
}

/** Spinner variant content */
function SpinnerContent({ elapsedSeconds }: { elapsedSeconds: number }) {
  return (
    <>
      {/* Spinner */}
      <div
        data-testid="loading-spinner"
        style={{
          width: 40,
          height: 40,
          border: '4px solid var(--color-border, #e2e8f0)',
          borderTopColor: 'var(--color-primary, #3b82f6)',
          borderRadius: '50%',
          animation: 'resume-tailor-spin 1s linear infinite',
        }}
        aria-hidden="true"
      />

      {/* Elapsed time */}
      <div
        data-testid="loading-elapsed-time"
        aria-live="polite"
        aria-atomic="true"
        style={{
          fontSize: 16,
          fontWeight: 500,
          color: 'var(--text-primary, #1e293b)',
        }}
      >
        Processing... {elapsedSeconds}s
      </div>
    </>
  )
}

/** Skeleton variant content — mimics MatchScoreGauge + KeywordMatchList layout */
function SkeletonContent() {
  const pulseAnimation = 'resume-tailor-skeleton-pulse 1.5s ease-in-out infinite'

  return (
    <div
      data-testid="skeleton-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--spacing-6, 24px)',
        width: '100%',
        maxWidth: 400,
      }}
    >
      {/* Circular skeleton — matches MatchScoreGauge (200x200) */}
      <div
        data-testid="skeleton-gauge"
        aria-hidden="true"
        style={{
          width: 200,
          height: 200,
          borderRadius: 'var(--radius-full, 9999px)',
          background: 'var(--color-border, #e2e8f0)',
          animation: pulseAnimation,
        }}
      />

      {/* Rectangular skeletons — match 4 keyword category sections */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--spacing-5, 20px)',
          width: '100%',
        }}
      >
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            data-testid={`skeleton-category-${index}`}
            aria-hidden="true"
            style={{
              width: '100%',
              height: 80,
              borderRadius: 'var(--radius-md, 10px)',
              background: 'var(--color-border, #e2e8f0)',
              animation: pulseAnimation,
              animationDelay: `${index * 0.15}s`,
            }}
          />
        ))}
      </div>
    </div>
  )
}
