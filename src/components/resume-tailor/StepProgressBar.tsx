/**
 * StepProgressBar — visual workflow indicator showing the user's current
 * position in the resume tailoring flow.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 6.4
 */

import React from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

/** Represents a single step in the progress bar. */
export interface StepDefinition {
  label: string
  icon?: string
}

/** Props for the StepProgressBar component. */
export interface StepProgressBarProps {
  currentStep: number // 0-based index into FLOW_STEPS
  steps: StepDefinition[]
}

/** FlowState type matching ResumeTailorPage's internal state. */
type FlowState = 'input' | 'analyzing' | 'results' | 'applying' | 'preview' | 'confirmed'

// ── Constants ─────────────────────────────────────────────────────────────────

/** The 5 workflow steps displayed in the progress bar. */
export const FLOW_STEPS: StepDefinition[] = [
  { label: 'Input', icon: '📝' },
  { label: 'Analyze', icon: '🔍' },
  { label: 'Results', icon: '📊' },
  { label: 'Preview', icon: '👁' },
  { label: 'Download', icon: '⬇' },
]

// ── Utility Functions ─────────────────────────────────────────────────────────

/**
 * Maps a FlowState to the corresponding 0-based step index.
 * Clamps to valid range if an unexpected value is passed.
 */
export function getStepIndex(flowState: FlowState): number {
  const mapping: Record<FlowState, number> = {
    input: 0,
    analyzing: 1,
    results: 2,
    applying: 2,
    preview: 3,
    confirmed: 4,
  }
  const index = mapping[flowState]
  if (index === undefined) return 0
  return Math.max(0, Math.min(index, FLOW_STEPS.length - 1))
}

/**
 * Determines a step's visual status relative to the current active step.
 */
export function getStepStatus(
  stepIndex: number,
  currentIndex: number
): 'completed' | 'active' | 'upcoming' {
  if (stepIndex < currentIndex) return 'completed'
  if (stepIndex === currentIndex) return 'active'
  return 'upcoming'
}

// ── Component ─────────────────────────────────────────────────────────────────

export function StepProgressBar({ currentStep, steps }: StepProgressBarProps) {
  return (
    <nav
      aria-label="Workflow progress"
      data-testid="step-progress-bar"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        padding: `var(--spacing-4, 16px) 0`,
      }}
    >
      <ol
        style={{
          display: 'flex',
          alignItems: 'center',
          listStyle: 'none',
          margin: 0,
          padding: 0,
          width: '100%',
          maxWidth: 640,
        }}
      >
        {steps.map((step, index) => {
          const status = getStepStatus(index, currentStep)
          const isLast = index === steps.length - 1

          return (
            <React.Fragment key={index}>
              <li
                data-testid={`step-indicator-${index}`}
                data-status={status}
                aria-current={status === 'active' ? 'step' : undefined}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 'var(--spacing-1, 4px)',
                  opacity: status === 'completed' ? 0.6 : 1,
                  flex: '0 0 auto',
                }}
              >
                {/* Step circle */}
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 'var(--radius-full, 9999px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    fontWeight: 600,
                    border: '2px solid',
                    borderColor:
                      status === 'active'
                        ? 'var(--color-primary, #2563eb)'
                        : status === 'completed'
                          ? 'var(--color-success, #10b981)'
                          : 'var(--color-border, #e2e8f0)',
                    background:
                      status === 'active'
                        ? 'var(--color-primary, #2563eb)'
                        : status === 'completed'
                          ? 'var(--color-success, #10b981)'
                          : 'var(--color-surface, #ffffff)',
                    color:
                      status === 'active' || status === 'completed'
                        ? '#ffffff'
                        : '#6b7280',
                    transition: `all var(--duration-normal, 250ms) var(--ease-default, cubic-bezier(0.4, 0, 0.2, 1))`,
                  }}
                >
                  {status === 'completed' ? '✓' : index + 1}
                </div>

                {/* Step label — hidden below 600px via CSS class */}
                <span
                  className="step-progress-label"
                  style={{
                    fontSize: 'var(--font-size-caption, 0.875rem)',
                    fontWeight: status === 'active' ? 600 : 400,
                    color:
                      status === 'active'
                        ? 'var(--color-primary, #2563eb)'
                        : status === 'completed'
                          ? 'var(--color-success, #10b981)'
                          : '#6b7280',
                    whiteSpace: 'nowrap',
                    transition: `color var(--duration-normal, 250ms) var(--ease-default, cubic-bezier(0.4, 0, 0.2, 1))`,
                  }}
                >
                  {step.label}
                </span>

                {/* Step icon — shown only below 600px */}
                <span
                  className="step-progress-icon"
                  aria-hidden="true"
                  style={{
                    display: 'none',
                    fontSize: 12,
                  }}
                >
                  {step.icon}
                </span>
              </li>

              {/* Connecting line */}
              {!isLast && (
                <div
                  data-testid={`step-connector-${index}`}
                  style={{
                    flex: '1 1 auto',
                    height: 2,
                    margin: '0 var(--spacing-2, 8px)',
                    borderRadius: 1,
                    background:
                      index < currentStep
                        ? 'var(--color-success, #10b981)'
                        : 'var(--color-border, #e2e8f0)',
                    transition: `background var(--duration-normal, 250ms) var(--ease-default, cubic-bezier(0.4, 0, 0.2, 1))`,
                    /* Shift connector up to align with circles, not labels */
                    alignSelf: 'flex-start',
                    marginTop: 15,
                  }}
                />
              )}
            </React.Fragment>
          )
        })}
      </ol>

      {/* Responsive styles: icons-only below 600px */}
      <style>{`
        @media (max-width: 599px) {
          .step-progress-label {
            display: none !important;
          }
          .step-progress-icon {
            display: block !important;
          }
        }
        @media (min-width: 600px) {
          .step-progress-label {
            display: block;
          }
          .step-progress-icon {
            display: none !important;
          }
        }
      `}</style>
    </nav>
  )
}

export default StepProgressBar
