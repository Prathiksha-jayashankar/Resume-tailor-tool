/**
 * ResumeInputPanel — text area for pasting resume content and file upload.
 *
 * Provides a text area (max 50,000 characters) and a file upload input accepting
 * PDF, DOCX, and TXT files. On file upload, text is extracted client-side and
 * displayed for user confirmation. Shows validation errors for invalid content,
 * unsupported formats, corrupted files, and oversized files.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.7
 */

import React, { useRef, useState } from 'react'
import { parseFile, type FileParseErrorCode } from './FileParser'

// ── Constants ─────────────────────────────────────────────────────────────────

/** Maximum characters allowed in the resume text area */
const RESUME_MAX_CHARS = 50_000

/** Minimum characters for valid resume content */
const RESUME_MIN_CHARS = 50

/** Accepted file types for the upload input */
const ACCEPTED_FILE_TYPES = '.pdf,.docx,.txt'

// ── Error Messages ────────────────────────────────────────────────────────────

const ERROR_MESSAGES: Record<FileParseErrorCode, string> = {
  UNSUPPORTED_FORMAT:
    'Unsupported file format. Please upload a PDF, DOCX, or TXT file.',
  FILE_TOO_LARGE:
    'File size exceeds the 5 MB limit. Please reduce the file size or paste content directly.',
  CORRUPTED_FILE:
    'This file could not be processed. Please upload a different file or paste your resume content directly.',
  PARSE_ERROR:
    'This file could not be processed. Please upload a different file or paste your resume content directly.',
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ResumeInputPanelProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ResumeInputPanel({
  value,
  onChange,
  disabled = false,
}: ResumeInputPanelProps) {
  const [error, setError] = useState<string | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [blurred, setBlurred] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const trimmedLength = value.trim().length
  const showMinLengthError = blurred && trimmedLength > 0 && trimmedLength < RESUME_MIN_CHARS

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value)
    if (error) setError(null)
    if (blurred) setBlurred(false)
  }

  const handleBlur = () => {
    setBlurred(true)
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setIsParsing(true)

    try {
      const result = await parseFile(file)

      if (result.success) {
        onChange(result.text)
        setBlurred(false)
      } else {
        setError(ERROR_MESSAGES[result.code] || result.error)
      }
    } catch {
      setError(ERROR_MESSAGES.CORRUPTED_FILE)
    } finally {
      setIsParsing(false)
      // Reset input so the same file can be re-selected
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  // ── Inline validation message ─────────────────────────────────────────────

  const validationMessage = showMinLengthError
    ? 'Please provide valid resume content with at least 50 characters.'
    : null

  const displayedError = error || validationMessage

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      data-testid="resume-input-panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        width: '100%',
      }}
    >
      <label
        htmlFor="resume-textarea"
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--text-primary, #1f2937)',
        }}
      >
        Resume Content
      </label>

      <textarea
        id="resume-textarea"
        data-testid="resume-textarea"
        value={value}
        onChange={handleTextChange}
        onBlur={handleBlur}
        maxLength={RESUME_MAX_CHARS}
        disabled={disabled || isParsing}
        placeholder="Paste your resume content here or upload a file below…"
        aria-describedby={displayedError ? 'resume-error' : undefined}
        aria-invalid={!!displayedError}
        style={{
          width: '100%',
          minHeight: 220,
          padding: '12px 14px',
          borderRadius: 8,
          border: `1px solid ${
            displayedError
              ? 'rgba(239,68,68,0.5)'
              : 'var(--border, #e5e7eb)'
          }`,
          background: disabled || isParsing
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

      {/* Character count */}
      <div
        data-testid="resume-char-count"
        style={{
          fontSize: 12,
          color: 'var(--text-muted, #9ca3af)',
          textAlign: 'right',
        }}
      >
        {value.length}/{RESUME_MAX_CHARS}
      </div>

      {/* File upload section */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_FILE_TYPES}
          onChange={handleFileChange}
          disabled={disabled || isParsing}
          data-testid="resume-file-input"
          aria-label="Upload resume file (PDF, DOCX, or TXT)"
          style={{
            position: 'absolute',
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: 'hidden',
            clip: 'rect(0,0,0,0)',
            whiteSpace: 'nowrap',
            border: 0,
          }}
        />

        <button
          type="button"
          data-testid="resume-upload-btn"
          onClick={handleUploadClick}
          disabled={disabled || isParsing}
          style={{
            padding: '10px 20px',
            borderRadius: 8,
            border: '1px solid var(--border, #e5e7eb)',
            background: disabled || isParsing
              ? 'var(--surface-secondary, #e5e7eb)'
              : 'var(--surface, #fff)',
            color: disabled || isParsing
              ? 'var(--text-muted, #9ca3af)'
              : 'var(--text-primary, #1f2937)',
            fontSize: 14,
            fontWeight: 600,
            cursor: disabled || isParsing ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s, border-color 0.15s',
            minHeight: 44,
            minWidth: 44,
          }}
        >
          {isParsing ? 'Parsing…' : 'Upload File'}
        </button>

        <span
          style={{
            fontSize: 12,
            color: 'var(--text-muted, #9ca3af)',
          }}
        >
          Accepted: PDF, DOCX, TXT (max 5 MB)
        </span>
      </div>

      {/* Loading indicator during file parsing */}
      {isParsing && (
        <p
          data-testid="resume-parsing-indicator"
          aria-live="polite"
          style={{
            fontSize: 12,
            color: '#7c3aed',
            margin: 0,
          }}
        >
          Extracting text from file…
        </p>
      )}

      {/* Error message */}
      {displayedError && (
        <p
          id="resume-error"
          role="alert"
          aria-live="assertive"
          data-testid="resume-error"
          style={{
            fontSize: 12,
            color: '#dc2626',
            background: 'rgba(239,68,68,0.06)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 6,
            padding: '8px 12px',
            margin: 0,
          }}
        >
          {displayedError}
        </p>
      )}
    </div>
  )
}

export { RESUME_MAX_CHARS, RESUME_MIN_CHARS, ACCEPTED_FILE_TYPES, ERROR_MESSAGES }
