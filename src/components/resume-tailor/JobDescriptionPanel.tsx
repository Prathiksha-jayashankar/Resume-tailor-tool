/**
 * JobDescriptionPanel — text area for job description input.
 *
 * Accepts 1–15,000 characters. Shows a warning for descriptions under 50 characters
 * while still allowing submission. Supports editing after submission without losing
 * resume content (controlled component with parent-managed state).
 *
 * Requirements: 2.1, 2.3, 2.4
 */

import React from 'react'

/** Maximum characters allowed in the job description text area */
const JD_MAX_CHARS = 15_000

/** Threshold below which a short-description warning is shown */
const JD_MIN_WARNING_CHARS = 50

export interface JobDescriptionPanelProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  isSubmitted: boolean
  disabled?: boolean
}

export function JobDescriptionPanel({
  value,
  onChange,
  onSubmit,
  isSubmitted,
  disabled = false,
}: JobDescriptionPanelProps) {
  const trimmedLength = value.trim().length
  const showWarning = trimmedLength > 0 && trimmedLength < JD_MIN_WARNING_CHARS
  const isSubmitDisabled = trimmedLength === 0 || disabled

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isSubmitDisabled) {
      onSubmit()
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      data-testid="jd-panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        width: '100%',
      }}
    >
      <label
        htmlFor="jd-textarea"
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--text-primary, #1f2937)',
        }}
      >
        Job Description
      </label>

      <div style={{ position: 'relative' }}>
        <textarea
          id="jd-textarea"
          data-testid="jd-textarea"
          value={value}
          onChange={handleChange}
          maxLength={JD_MAX_CHARS}
          disabled={disabled}
          placeholder="Paste or type the job description here…"
          aria-describedby={showWarning ? 'jd-warning' : undefined}
          style={{
            width: '100%',
            minHeight: 180,
            padding: '12px 14px',
            borderRadius: 8,
            border: `1px solid ${isSubmitted ? 'rgba(34,197,94,0.5)' : 'var(--border, #e5e7eb)'}`,
            background: disabled
              ? 'var(--surface-secondary, #f9fafb)'
              : 'var(--surface, #fff)',
            fontSize: 14,
            lineHeight: 1.6,
            color: 'var(--text-primary, #1f2937)',
            resize: 'vertical',
            outline: 'none',
            transition: 'border-color 0.15s',
            fontFamily: 'inherit',
          }}
        />

        {isSubmitted && (
          <span
            data-testid="jd-submitted-indicator"
            style={{
              position: 'absolute',
              top: 8,
              right: 12,
              fontSize: 11,
              fontWeight: 600,
              color: '#16a34a',
              background: 'rgba(34,197,94,0.1)',
              padding: '2px 8px',
              borderRadius: 4,
            }}
          >
            Submitted
          </span>
        )}
      </div>

      {/* Character count */}
      <div
        data-testid="jd-char-count"
        style={{
          fontSize: 12,
          color: 'var(--text-muted, #9ca3af)',
          textAlign: 'right',
        }}
      >
        {value.length}/{JD_MAX_CHARS}
      </div>

      {/* Warning for short descriptions */}
      {showWarning && (
        <p
          id="jd-warning"
          role="alert"
          data-testid="jd-short-warning"
          style={{
            fontSize: 12,
            color: '#d97706',
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.3)',
            borderRadius: 6,
            padding: '8px 12px',
            margin: 0,
          }}
        >
          This job description may be too short for accurate analysis. You can still proceed.
        </p>
      )}

      {/* Submit button */}
      <button
        type="submit"
        data-testid="jd-submit-btn"
        disabled={isSubmitDisabled}
        style={{
          alignSelf: 'flex-start',
          padding: '10px 20px',
          borderRadius: 8,
          border: 'none',
          background: isSubmitDisabled
            ? 'var(--surface-secondary, #e5e7eb)'
            : '#7c3aed',
          color: isSubmitDisabled ? 'var(--text-muted, #9ca3af)' : '#fff',
          fontSize: 14,
          fontWeight: 600,
          cursor: isSubmitDisabled ? 'not-allowed' : 'pointer',
          transition: 'background 0.15s, opacity 0.15s',
          minHeight: 44,
          minWidth: 44,
        }}
      >
        {isSubmitted ? 'Re-submit' : 'Submit Job Description'}
      </button>
    </form>
  )
}

export { JD_MAX_CHARS, JD_MIN_WARNING_CHARS }
