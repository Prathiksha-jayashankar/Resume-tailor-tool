/**
 * DownloadPanel — PDF/DOCX download buttons with clipboard fallback on failure.
 *
 * Provides two download buttons for PDF and DOCX formats. If an error occurs
 * during download, shows the error message and offers a "Copy to Clipboard"
 * fallback button. On successful clipboard copy, displays a "Copied!" confirmation.
 *
 * Requirements: 6.1, 6.5, 6.6
 */

import React, { useState } from 'react'

// ── Props ─────────────────────────────────────────────────────────────────────

export interface DownloadPanelProps {
  onDownload: (format: 'pdf' | 'docx') => Promise<void>
  tailoredContent: string
  error?: string | null
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DownloadPanel({
  onDownload,
  tailoredContent,
  error,
}: DownloadPanelProps) {
  const [loadingFormat, setLoadingFormat] = useState<'pdf' | 'docx' | null>(null)
  const [copyConfirmation, setCopyConfirmation] = useState<string | null>(null)

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleDownload = async (format: 'pdf' | 'docx') => {
    setLoadingFormat(format)
    setCopyConfirmation(null)
    try {
      await onDownload(format)
    } finally {
      setLoadingFormat(null)
    }
  }

  const handleCopyToClipboard = async () => {
    setCopyConfirmation(null)
    try {
      await navigator.clipboard.writeText(tailoredContent)
      setCopyConfirmation('Copied!')
    } catch {
      setCopyConfirmation('Copy failed. Please copy manually.')
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      data-testid="download-panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        width: '100%',
      }}
    >
      <label
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--text-primary, #1f2937)',
        }}
      >
        Download Tailored Resume
      </label>

      {/* Download buttons */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          data-testid="download-pdf-btn"
          onClick={() => handleDownload('pdf')}
          disabled={loadingFormat !== null}
          aria-label="Download PDF"
          style={{
            padding: '10px 20px',
            borderRadius: 8,
            border: '1px solid var(--border, #e5e7eb)',
            background: loadingFormat !== null
              ? 'var(--surface-secondary, #e5e7eb)'
              : 'var(--primary, #2563eb)',
            color: loadingFormat !== null
              ? 'var(--text-muted, #9ca3af)'
              : '#fff',
            fontSize: 14,
            fontWeight: 600,
            cursor: loadingFormat !== null ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s, border-color 0.15s',
            minHeight: 44,
            minWidth: 44,
          }}
        >
          {loadingFormat === 'pdf' ? 'Downloading…' : 'Download PDF'}
        </button>

        <button
          type="button"
          data-testid="download-docx-btn"
          onClick={() => handleDownload('docx')}
          disabled={loadingFormat !== null}
          aria-label="Download DOCX"
          style={{
            padding: '10px 20px',
            borderRadius: 8,
            border: '1px solid var(--border, #e5e7eb)',
            background: loadingFormat !== null
              ? 'var(--surface-secondary, #e5e7eb)'
              : 'var(--primary, #2563eb)',
            color: loadingFormat !== null
              ? 'var(--text-muted, #9ca3af)'
              : '#fff',
            fontSize: 14,
            fontWeight: 600,
            cursor: loadingFormat !== null ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s, border-color 0.15s',
            minHeight: 44,
            minWidth: 44,
          }}
        >
          {loadingFormat === 'docx' ? 'Downloading…' : 'Download DOCX'}
        </button>
      </div>

      {/* Error message with clipboard fallback */}
      {error && (
        <div
          data-testid="download-error"
          role="alert"
          aria-live="assertive"
          style={{
            fontSize: 12,
            color: '#dc2626',
            background: 'rgba(239,68,68,0.06)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 6,
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <span>{error}</span>

          <button
            type="button"
            data-testid="copy-clipboard-btn"
            onClick={handleCopyToClipboard}
            aria-label="Copy to Clipboard"
            style={{
              alignSelf: 'flex-start',
              padding: '8px 16px',
              borderRadius: 6,
              border: '1px solid rgba(239,68,68,0.3)',
              background: '#fff',
              color: '#dc2626',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.15s',
              minHeight: 44,
              minWidth: 44,
            }}
          >
            Copy to Clipboard
          </button>
        </div>
      )}

      {/* Clipboard copy confirmation */}
      {copyConfirmation && (
        <p
          data-testid="copy-confirmation"
          aria-live="polite"
          style={{
            fontSize: 12,
            color: copyConfirmation === 'Copied!' ? '#16a34a' : '#dc2626',
            margin: 0,
          }}
        >
          {copyConfirmation}
        </p>
      )}
    </div>
  )
}
