/**
 * KeywordMatchList — displays matched vs missing keywords grouped by category.
 *
 * Shows keyword match results organized into four categories: technical skills,
 * soft skills, experience requirements, and educational qualifications. Each
 * category displays a heading with matched/total count, matched keywords as green
 * chips, and missing keywords as red/orange chips. Semantic matches show a tooltip
 * with the equivalent resume term.
 *
 * Requirements: 3.6
 */

import type { KeywordMatchResult, KeywordMatch, KeywordCategory } from '../../shared/types'

// ── Category Display Config ───────────────────────────────────────────────────

interface CategoryConfig {
  key: KeywordCategory
  label: string
}

const CATEGORY_ORDER: CategoryConfig[] = [
  { key: 'technical', label: 'Technical Skills' },
  { key: 'soft_skills', label: 'Soft Skills' },
  { key: 'experience', label: 'Experience' },
  { key: 'education', label: 'Education' },
]

// ── Props ─────────────────────────────────────────────────────────────────────

export interface KeywordMatchListProps {
  matchResult: KeywordMatchResult
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 20,
    width: '100%',
  },
  categorySection: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 10,
    padding: '14px 16px',
    borderRadius: 10,
    border: '1px solid var(--border, #e5e7eb)',
    background: 'var(--surface, #fff)',
  },
  categoryHeading: {
    fontSize: 14,
    fontWeight: 600 as const,
    color: 'var(--text-primary, #1f2937)',
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  countBadge: {
    fontSize: 12,
    fontWeight: 500 as const,
    color: 'var(--text-muted, #6b7280)',
    background: 'var(--surface-secondary, #f3f4f6)',
    borderRadius: 10,
    padding: '2px 8px',
  },
  chipContainer: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 8,
  },
  matchedChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 10px',
    borderRadius: 14,
    fontSize: 12,
    fontWeight: 500 as const,
    color: '#166534',
    background: '#dcfce7',
    border: '1px solid #bbf7d0',
    cursor: 'default',
    position: 'relative' as const,
  },
  semanticChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 10px',
    borderRadius: 14,
    fontSize: 12,
    fontWeight: 500 as const,
    color: '#1e40af',
    background: '#dbeafe',
    border: '1px solid #bfdbfe',
    cursor: 'default',
    position: 'relative' as const,
  },
  missingChip: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 10px',
    borderRadius: 14,
    fontSize: 12,
    fontWeight: 500 as const,
    color: '#9a3412',
    background: '#ffedd5',
    border: '1px solid #fed7aa',
    cursor: 'default',
  },
  semanticSubtitle: {
    fontSize: 10,
    color: '#1e40af',
    opacity: 0.8,
    marginLeft: 2,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 500 as const,
    color: 'var(--text-muted, #6b7280)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    margin: '4px 0 2px 0',
  },
  emptyMessage: {
    fontSize: 12,
    color: 'var(--text-muted, #9ca3af)',
    fontStyle: 'italic' as const,
    margin: 0,
  },
} as const

// ── Component ─────────────────────────────────────────────────────────────────

export function KeywordMatchList({ matchResult }: KeywordMatchListProps) {
  const { categories } = matchResult

  return (
    <div data-testid="keyword-match-list" style={styles.container}>
      {CATEGORY_ORDER.map(({ key, label }) => {
        const categoryData = categories[key]
        const matchedCount = categoryData.matched.length
        const missingCount = categoryData.missing.length
        const totalCount = matchedCount + missingCount

        return (
          <div
            key={key}
            data-testid={`keyword-category-${key}`}
            style={styles.categorySection}
          >
            {/* Category heading with count */}
            <h3 style={styles.categoryHeading}>
              {label}
              <span
                data-testid={`keyword-count-${key}`}
                style={styles.countBadge}
              >
                {matchedCount}/{totalCount}
              </span>
            </h3>

            {/* Matched keywords */}
            {matchedCount > 0 && (
              <div>
                <p style={styles.sectionLabel}>Matched</p>
                <div style={styles.chipContainer}>
                  {categoryData.matched.map((match, idx) => (
                    <MatchedKeywordChip key={`${key}-matched-${idx}`} match={match} />
                  ))}
                </div>
              </div>
            )}

            {/* Missing keywords */}
            {missingCount > 0 && (
              <div>
                <p style={styles.sectionLabel}>Missing</p>
                <div style={styles.chipContainer}>
                  {categoryData.missing.map((term, idx) => (
                    <span
                      key={`${key}-missing-${idx}`}
                      data-testid={`keyword-missing-${key}-${idx}`}
                      style={styles.missingChip}
                      aria-label={`Missing keyword: ${term}`}
                    >
                      {term}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {matchedCount === 0 && missingCount === 0 && (
              <p style={styles.emptyMessage}>No keywords identified for this category.</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

interface MatchedKeywordChipProps {
  match: KeywordMatch
}

function MatchedKeywordChip({ match }: MatchedKeywordChipProps) {
  const isSemantic = match.matchType === 'semantic'
  const chipStyle = isSemantic ? styles.semanticChip : styles.matchedChip

  const ariaLabel = isSemantic
    ? `Matched keyword: ${match.jobDescriptionTerm} (resume equivalent: ${match.resumeTerm})`
    : `Matched keyword: ${match.jobDescriptionTerm}`

  return (
    <span
      data-testid={`keyword-matched-${match.category}-${match.jobDescriptionTerm}`}
      style={chipStyle}
      aria-label={ariaLabel}
      title={
        isSemantic
          ? `Resume equivalent: ${match.resumeTerm}`
          : undefined
      }
    >
      {match.jobDescriptionTerm}
      {isSemantic && (
        <span style={styles.semanticSubtitle}>
          ≈ {match.resumeTerm}
        </span>
      )}
    </span>
  )
}

export { CATEGORY_ORDER }
