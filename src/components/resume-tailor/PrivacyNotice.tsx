/**
 * PrivacyNotice — Modal displayed on first session access requiring acknowledgment.
 *
 * Describes data collection, processing by LLM, session-based storage (30 min timeout),
 * and deletion at session end. The user must acknowledge before submitting any content.
 *
 * Requirements: 9.5
 */

import React, { useEffect, useRef } from 'react'

// ── Props ─────────────────────────────────────────────────────────────────────

export interface PrivacyNoticeProps {
  isVisible: boolean
  onAcknowledge: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PrivacyNotice({ isVisible, onAcknowledge }: PrivacyNoticeProps) {
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (isVisible && buttonRef.current) {
      buttonRef.current.focus()
    }
  }, [isVisible])

  if (!isVisible) {
    return null
  }

  return (
    <div
      data-testid="privacy-notice-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.6)',
        zIndex: 9999,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="privacy-notice-title"
        data-testid="privacy-notice-dialog"
        style={{
          background: '#fff',
          borderRadius: 12,
          padding: '32px 28px',
          maxWidth: 520,
          width: '90%',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        }}
      >
        <h2
          id="privacy-notice-title"
          data-testid="privacy-notice-title"
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: 'var(--text-primary, #1f2937)',
            margin: '0 0 16px 0',
          }}
        >
          Privacy Notice
        </h2>

        <div
          data-testid="privacy-notice-body"
          style={{
            fontSize: 14,
            lineHeight: 1.6,
            color: 'var(--text-secondary, #4b5563)',
          }}
        >
          <p style={{ margin: '0 0 12px 0' }}>
            By using the Resume Tailor Tool, you acknowledge the following:
          </p>
          <ul
            style={{
              margin: '0 0 16px 0',
              paddingLeft: 20,
              listStyleType: 'disc',
            }}
          >
            <li style={{ marginBottom: 8 }}>
              Your resume and job description content will be sent to our server for AI-powered analysis.
            </li>
            <li style={{ marginBottom: 8 }}>
              Content is processed by a Large Language Model (LLM) to generate keyword matching, scoring, and tailoring suggestions.
            </li>
            <li style={{ marginBottom: 8 }}>
              Your data is not stored beyond the active session. Sessions expire after 30 minutes of inactivity.
            </li>
            <li style={{ marginBottom: 8 }}>
              All user-provided content is deleted from server memory at session end.
            </li>
            <li style={{ marginBottom: 0 }}>
              Your data is not shared with third parties beyond the LLM service API calls required for analysis.
            </li>
          </ul>
        </div>

        <button
          ref={buttonRef}
          type="button"
          data-testid="privacy-acknowledge-btn"
          onClick={onAcknowledge}
          style={{
            display: 'block',
            width: '100%',
            padding: '12px 24px',
            borderRadius: 8,
            border: 'none',
            background: 'var(--primary, #2563eb)',
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'background 0.15s',
            minHeight: 44,
            minWidth: 44,
          }}
        >
          I Understand and Accept
        </button>
      </div>
    </div>
  )
}
