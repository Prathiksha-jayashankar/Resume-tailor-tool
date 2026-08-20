/**
 * ResumePreview — displays tailored resume with accepted changes visually highlighted.
 *
 * Shows the tailored resume content with modified sections distinguished by a
 * highlighted background. Provides confirm and cancel actions for the user to
 * finalize or discard changes.
 *
 * Requirements: 5.4, 5.9
 */

import React from 'react'
import type { TailoredResume, ModifiedSection } from '../../shared/types'

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ResumePreviewProps {
  tailoredResume: TailoredResume
  onConfirm: () => void
  onCancel: () => void
}

// ── Styles ────────────────────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  width: '100%',
}

const headingStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  color: 'var(--text-primary, #1f2937)',
  margin: 0,
}

const contentContainerStyle: React.CSSProperties = {
  padding: '16px 20px',
  borderRadius: 8,
  border: '1px solid var(--border, #e5e7eb)',
  background: 'var(--surface, #fff)',
  whiteSpace: 'pre-wrap',
  fontSize: 14,
  lineHeight: 1.7,
  color: 'var(--text-primary, #1f2937)',
  fontFamily: 'inherit',
  maxHeight: 500,
  overflowY: 'auto' as const,
}

const modifiedSectionStyle: React.CSSProperties = {
  background: 'rgba(34, 197, 94, 0.10)',
  borderLeft: '3px solid #22c55e',
  padding: '8px 12px',
  borderRadius: 4,
  marginBottom: 8,
}

const modifiedLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: '#15803d',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  marginBottom: 4,
}

const unmodifiedSectionStyle: React.CSSProperties = {
  marginBottom: 8,
}

const actionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 12,
  justifyContent: 'flex-end',
  paddingTop: 8,
}

const confirmButtonStyle: React.CSSProperties = {
  padding: '10px 24px',
  borderRadius: 8,
  border: 'none',
  background: '#2563eb',
  color: '#fff',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  minHeight: 44,
  minWidth: 44,
  transition: 'background 0.15s',
}

const cancelButtonStyle: React.CSSProperties = {
  padding: '10px 24px',
  borderRadius: 8,
  border: '1px solid var(--border, #e5e7eb)',
  background: 'var(--surface, #fff)',
  color: 'var(--text-primary, #1f2937)',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  minHeight: 44,
  minWidth: 44,
  transition: 'background 0.15s, border-color 0.15s',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Splits the tailored resume content into segments, marking which segments
 * are modified and which are unchanged.
 */
function buildSegments(
  content: string,
  modifiedSections: ModifiedSection[]
): Array<{ text: string; isModified: boolean; sectionId?: string }> {
  if (modifiedSections.length === 0) {
    return [{ text: content, isModified: false }]
  }

  const segments: Array<{ text: string; isModified: boolean; sectionId?: string }> = []
  let remaining = content

  // Sort modified sections by their position in content
  const sortedSections = [...modifiedSections].sort((a, b) => {
    const posA = content.indexOf(a.modifiedContent)
    const posB = content.indexOf(b.modifiedContent)
    return posA - posB
  })

  for (const section of sortedSections) {
    const idx = remaining.indexOf(section.modifiedContent)
    if (idx === -1) continue

    // Add unmodified text before this section
    if (idx > 0) {
      segments.push({ text: remaining.slice(0, idx), isModified: false })
    }

    // Add modified section
    segments.push({
      text: section.modifiedContent,
      isModified: true,
      sectionId: section.sectionId,
    })

    remaining = remaining.slice(idx + section.modifiedContent.length)
  }

  // Add any remaining unmodified text
  if (remaining.length > 0) {
    segments.push({ text: remaining, isModified: false })
  }

  return segments
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ResumePreview({
  tailoredResume,
  onConfirm,
  onCancel,
}: ResumePreviewProps) {
  const { content, modifiedSections } = tailoredResume

  const segments = buildSegments(content, modifiedSections)

  return (
    <section
      data-testid="resume-preview"
      aria-label="Tailored resume preview"
      style={containerStyle}
    >
      <h3 style={headingStyle}>Tailored Resume Preview</h3>

      <div
        data-testid="resume-preview-content"
        style={contentContainerStyle}
      >
        {segments.map((segment, index) =>
          segment.isModified ? (
            <div
              key={`segment-${index}`}
              data-testid={`modified-section-${segment.sectionId}`}
              style={modifiedSectionStyle}
              aria-label={`Modified section: ${segment.sectionId}`}
            >
              <div style={modifiedLabelStyle}>Modified</div>
              {segment.text}
            </div>
          ) : (
            <div
              key={`segment-${index}`}
              data-testid={`unmodified-segment-${index}`}
              style={unmodifiedSectionStyle}
            >
              {segment.text}
            </div>
          )
        )}
      </div>

      <div style={actionsStyle} data-testid="resume-preview-actions">
        <button
          type="button"
          data-testid="resume-preview-cancel"
          onClick={onCancel}
          aria-label="Cancel and discard changes"
          style={cancelButtonStyle}
        >
          Cancel
        </button>
        <button
          type="button"
          data-testid="resume-preview-confirm"
          onClick={onConfirm}
          aria-label="Confirm and finalize tailored resume"
          style={confirmButtonStyle}
        >
          Confirm
        </button>
      </div>
    </section>
  )
}
