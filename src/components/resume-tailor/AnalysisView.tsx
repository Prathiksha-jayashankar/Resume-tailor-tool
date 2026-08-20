/**
 * AnalysisView — orchestrates score display, keyword visualization, and gap indicators.
 *
 * Composes MatchScoreGauge and KeywordMatchList together. Shows a "well aligned"
 * indicator when the resume is already strongly aligned (isWellAligned = true).
 *
 * Requirements: 3.5, 3.6
 */

import React from 'react'
import type { AnalysisResult } from '../../shared/types'
import { MatchScoreGauge } from './MatchScoreGauge'
import { KeywordMatchList } from './KeywordMatchList'

// ── Props ─────────────────────────────────────────────────────────────────────

export interface AnalysisViewProps {
  analysisResult: AnalysisResult
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AnalysisView({ analysisResult }: AnalysisViewProps) {
  const { matchScore, keywordMatches, isWellAligned } = analysisResult

  return (
    <section
      data-testid="analysis-view"
      aria-label="Resume analysis results"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
        width: '100%',
      }}
    >
      {/* Well-aligned indicator */}
      {isWellAligned && (
        <div
          data-testid="well-aligned-indicator"
          role="status"
          aria-live="polite"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 16px',
            borderRadius: 8,
            background: 'rgba(34, 197, 94, 0.08)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
          }}
        >
          <span
            style={{ fontSize: 20 }}
            aria-hidden="true"
          >
            ✓
          </span>
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: '#15803d',
            }}
          >
            Your resume is well aligned with this job description.
          </span>
        </div>
      )}

      {/* Match Score Gauge */}
      <MatchScoreGauge score={matchScore} />

      {/* Keyword Match List */}
      <div>
        <h3
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--text-primary, #1f2937)',
            margin: '0 0 12px 0',
          }}
        >
          Keyword Analysis
        </h3>
        <KeywordMatchList matchResult={keywordMatches} />
      </div>
    </section>
  )
}
