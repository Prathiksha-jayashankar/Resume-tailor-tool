/**
 * SuggestionList — displays prioritized suggestions with accept/reject controls,
 * select-all/deselect-all options, original vs suggested text, rationale, and undo.
 *
 * Requirements: 5.1, 5.2, 5.5
 */

import React from 'react'
import type { Suggestion, SuggestionCategory } from '../../shared/types'

// ── Props ─────────────────────────────────────────────────────────────────────

export interface SuggestionListProps {
  suggestions: Suggestion[]
  onUpdate: (id: string, status: 'accepted' | 'rejected' | 'pending') => void
  onSelectAll: () => void
  onDeselectAll: () => void
}

// ── Category Badge Styles ─────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<SuggestionCategory, { bg: string; text: string }> = {
  keyword_add: { bg: '#dbeafe', text: '#1e40af' },
  rephrase: { bg: '#fef3c7', text: '#92400e' },
  skill_highlight: { bg: '#d1fae5', text: '#065f46' },
  section_expand: { bg: '#ede9fe', text: '#5b21b6' },
  section_reduce: { bg: '#fce7f3', text: '#9d174d' },
}

const CATEGORY_LABELS: Record<SuggestionCategory, string> = {
  keyword_add: 'Keyword Add',
  rephrase: 'Rephrase',
  skill_highlight: 'Skill Highlight',
  section_expand: 'Section Expand',
  section_reduce: 'Section Reduce',
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SuggestionList({
  suggestions,
  onUpdate,
  onSelectAll,
  onDeselectAll,
}: SuggestionListProps) {
  // Sort by priority (1 = highest, ascending)
  const sorted = [...suggestions].sort((a, b) => a.priority - b.priority)

  return (
    <div data-testid="suggestion-list" style={{ width: '100%' }}>
      {/* Header with Select All / Deselect All */}
      <div
        data-testid="suggestion-list-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--text-primary, #1f2937)',
          }}
        >
          Suggestions ({suggestions.length})
        </h3>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            data-testid="select-all-btn"
            onClick={onSelectAll}
            aria-label="Accept all suggestions"
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: '1px solid #10b981',
              background: '#ecfdf5',
              color: '#065f46',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              minHeight: 44,
              minWidth: 44,
              transition: 'background 0.15s',
            }}
          >
            Select All
          </button>

          <button
            type="button"
            data-testid="deselect-all-btn"
            onClick={onDeselectAll}
            aria-label="Reject all suggestions"
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: '1px solid #ef4444',
              background: '#fef2f2',
              color: '#991b1b',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              minHeight: 44,
              minWidth: 44,
              transition: 'background 0.15s',
            }}
          >
            Deselect All
          </button>
        </div>
      </div>

      {/* Suggestion cards */}
      <div role="list" data-testid="suggestion-cards">
        {sorted.map((suggestion) => (
          <SuggestionCard
            key={suggestion.id}
            suggestion={suggestion}
            onUpdate={onUpdate}
          />
        ))}
      </div>

      {suggestions.length === 0 && (
        <p
          data-testid="suggestion-empty"
          style={{
            textAlign: 'center',
            color: 'var(--text-muted, #9ca3af)',
            fontSize: 14,
            padding: '24px 0',
          }}
        >
          No suggestions available.
        </p>
      )}
    </div>
  )
}

// ── Suggestion Card ───────────────────────────────────────────────────────────

interface SuggestionCardProps {
  suggestion: Suggestion
  onUpdate: (id: string, status: 'accepted' | 'rejected' | 'pending') => void
}

function SuggestionCard({ suggestion, onUpdate }: SuggestionCardProps) {
  const { id, category, originalText, suggestedText, rationale, status } = suggestion
  const categoryStyle = CATEGORY_COLORS[category]
  const isAccepted = status === 'accepted'
  const isRejected = status === 'rejected'
  const showUndo = isAccepted || isRejected

  return (
    <div
      role="listitem"
      data-testid={`suggestion-card-${id}`}
      style={{
        border: `1px solid ${
          isAccepted
            ? '#10b981'
            : isRejected
            ? '#ef4444'
            : 'var(--border, #e5e7eb)'
        }`,
        borderRadius: 8,
        padding: 16,
        marginBottom: 12,
        background: isAccepted
          ? '#f0fdf4'
          : isRejected
          ? '#fef2f2'
          : 'var(--surface, #fff)',
        transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      {/* Category badge */}
      <span
        data-testid={`suggestion-category-${id}`}
        style={{
          display: 'inline-block',
          padding: '2px 8px',
          borderRadius: 12,
          fontSize: 11,
          fontWeight: 600,
          background: categoryStyle.bg,
          color: categoryStyle.text,
          marginBottom: 8,
        }}
      >
        {CATEGORY_LABELS[category]}
      </span>

      {/* Original text */}
      <div style={{ marginBottom: 8 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--text-muted, #6b7280)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Original
        </span>
        <p
          data-testid={`suggestion-original-${id}`}
          style={{
            margin: '4px 0 0',
            fontSize: 13,
            lineHeight: 1.5,
            color: 'var(--text-primary, #1f2937)',
            textDecoration: isAccepted ? 'line-through' : 'none',
            opacity: isAccepted ? 0.6 : 1,
          }}
        >
          {originalText}
        </p>
      </div>

      {/* Suggested text */}
      <div style={{ marginBottom: 8 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--text-muted, #6b7280)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Suggested
        </span>
        <p
          data-testid={`suggestion-suggested-${id}`}
          style={{
            margin: '4px 0 0',
            fontSize: 13,
            lineHeight: 1.5,
            color: 'var(--text-primary, #1f2937)',
            background: isAccepted ? '#bbf7d0' : 'transparent',
            borderRadius: isAccepted ? 4 : 0,
            padding: isAccepted ? '2px 4px' : 0,
          }}
        >
          {suggestedText}
        </p>
      </div>

      {/* Rationale */}
      <div style={{ marginBottom: 12 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--text-muted, #6b7280)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Rationale
        </span>
        <p
          data-testid={`suggestion-rationale-${id}`}
          style={{
            margin: '4px 0 0',
            fontSize: 12,
            lineHeight: 1.5,
            color: 'var(--text-muted, #6b7280)',
            fontStyle: 'italic',
          }}
        >
          {rationale}
        </p>
      </div>

      {/* Action buttons */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <button
          type="button"
          data-testid={`suggestion-accept-${id}`}
          onClick={() => onUpdate(id, 'accepted')}
          aria-label={`Accept suggestion ${id}`}
          disabled={isAccepted}
          style={{
            padding: '6px 14px',
            borderRadius: 6,
            border: '1px solid #10b981',
            background: isAccepted ? '#10b981' : '#ecfdf5',
            color: isAccepted ? '#fff' : '#065f46',
            fontSize: 12,
            fontWeight: 600,
            cursor: isAccepted ? 'default' : 'pointer',
            minHeight: 44,
            minWidth: 44,
            opacity: isAccepted ? 0.8 : 1,
            transition: 'background 0.15s, color 0.15s',
          }}
        >
          {isAccepted ? '✓ Accepted' : 'Accept'}
        </button>

        <button
          type="button"
          data-testid={`suggestion-reject-${id}`}
          onClick={() => onUpdate(id, 'rejected')}
          aria-label={`Reject suggestion ${id}`}
          disabled={isRejected}
          style={{
            padding: '6px 14px',
            borderRadius: 6,
            border: '1px solid #ef4444',
            background: isRejected ? '#ef4444' : '#fef2f2',
            color: isRejected ? '#fff' : '#991b1b',
            fontSize: 12,
            fontWeight: 600,
            cursor: isRejected ? 'default' : 'pointer',
            minHeight: 44,
            minWidth: 44,
            opacity: isRejected ? 0.8 : 1,
            transition: 'background 0.15s, color 0.15s',
          }}
        >
          {isRejected ? '✗ Rejected' : 'Reject'}
        </button>

        {showUndo && (
          <button
            type="button"
            data-testid={`suggestion-undo-${id}`}
            onClick={() => onUpdate(id, 'pending')}
            aria-label={`Undo decision for suggestion ${id}`}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: '1px solid var(--border, #d1d5db)',
              background: 'var(--surface, #fff)',
              color: 'var(--text-primary, #374151)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              minHeight: 44,
              minWidth: 44,
              transition: 'background 0.15s',
            }}
          >
            ↩ Undo
          </button>
        )}
      </div>
    </div>
  )
}

export { CATEGORY_LABELS, CATEGORY_COLORS }
