/**
 * Property-based tests for StepProgressBar component.
 *
 * Uses fast-check to verify universal properties hold across all valid inputs.
 */

import React from 'react'
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import * as fc from 'fast-check'
import {
  StepProgressBar,
  getStepIndex,
  getStepStatus,
  FLOW_STEPS,
  StepDefinition,
} from './StepProgressBar'

// ── Generators ────────────────────────────────────────────────────────────────

/** Generates a valid steps array with length between 2 and 10. */
const stepsArb = fc
  .array(
    fc.record({
      label: fc.string({ minLength: 1, maxLength: 20 }),
      icon: fc.option(fc.string({ minLength: 1, maxLength: 2 }), { nil: undefined }),
    }),
    { minLength: 2, maxLength: 10 }
  )
  .map((arr) => arr as StepDefinition[])

/** Generates a valid (steps, currentStep) pair where currentStep is in bounds. */
const stepsWithCurrentStepArb = stepsArb.chain((steps) =>
  fc.record({
    steps: fc.constant(steps),
    currentStep: fc.integer({ min: 0, max: steps.length - 1 }),
  })
)

/** All valid FlowState values. */
const flowStateArb = fc.constantFrom(
  'input' as const,
  'analyzing' as const,
  'results' as const,
  'applying' as const,
  'preview' as const,
  'confirmed' as const
)

// ── Property 1: Step status correctness ───────────────────────────────────────

describe('Property 1: Step status correctness', () => {
  /**
   * **Validates: Requirements 3.2, 3.3, 3.4, 3.7**
   *
   * For any valid steps array (length >= 2) and currentStep in [0, steps.length - 1]:
   * - Exactly one step has data-status="active"
   * - All steps before currentStep have data-status="completed"
   * - All steps after currentStep have data-status="upcoming"
   * - The active step has aria-current="step"
   */
  it('renders correct status for all steps relative to currentStep', () => {
    fc.assert(
      fc.property(stepsWithCurrentStepArb, ({ steps, currentStep }) => {
        const { container } = render(
          <StepProgressBar steps={steps} currentStep={currentStep} />
        )

        const indicators = container.querySelectorAll('[data-testid^="step-indicator-"]')

        // Exactly one active step
        const activeSteps = container.querySelectorAll('[data-status="active"]')
        expect(activeSteps.length).toBe(1)

        // The active step has aria-current="step"
        const activeLi = activeSteps[0]
        expect(activeLi.getAttribute('aria-current')).toBe('step')

        // Verify each step's status
        for (let i = 0; i < steps.length; i++) {
          const indicator = indicators[i]
          const status = indicator.getAttribute('data-status')

          if (i < currentStep) {
            expect(status).toBe('completed')
          } else if (i === currentStep) {
            expect(status).toBe('active')
          } else {
            expect(status).toBe('upcoming')
          }
        }
      }),
      { numRuns: 50 }
    )
  })
})

// ── Property 2: Step count rendering ──────────────────────────────────────────

describe('Property 2: Step count rendering', () => {
  /**
   * **Validates: Requirement 3.1**
   *
   * For any non-empty array of step definitions (length 2-10), the component
   * renders exactly steps.length step indicator elements.
   */
  it('renders exactly steps.length step indicators', () => {
    fc.assert(
      fc.property(stepsWithCurrentStepArb, ({ steps, currentStep }) => {
        const { container } = render(
          <StepProgressBar steps={steps} currentStep={currentStep} />
        )

        const indicators = container.querySelectorAll('[data-testid^="step-indicator-"]')
        expect(indicators.length).toBe(steps.length)
      }),
      { numRuns: 50 }
    )
  })
})

// ── Property 3: Progress line proportionality ─────────────────────────────────

describe('Property 3: Progress line proportionality', () => {
  /**
   * **Validates: Requirement 3.5**
   *
   * For any steps array and currentStep value, the number of filled connecting
   * lines (with green/success color) equals currentStep.
   */
  it('number of filled connecting lines equals currentStep', () => {
    fc.assert(
      fc.property(stepsWithCurrentStepArb, ({ steps, currentStep }) => {
        const { container } = render(
          <StepProgressBar steps={steps} currentStep={currentStep} />
        )

        const connectors = container.querySelectorAll('[data-testid^="step-connector-"]')

        // Total connectors should be steps.length - 1
        expect(connectors.length).toBe(steps.length - 1)

        // Count filled connectors (those with success/green color)
        let filledCount = 0
        for (let i = 0; i < connectors.length; i++) {
          const style = (connectors[i] as HTMLElement).style.background
          // A connector at index i is filled if i < currentStep
          if (style.includes('10b981') || style.includes('success')) {
            filledCount++
          }
        }

        expect(filledCount).toBe(currentStep)
      }),
      { numRuns: 50 }
    )
  })
})

// ── Property 6: Step index bounds safety ──────────────────────────────────────

describe('Property 6: Step index bounds safety', () => {
  /**
   * **Validates: Requirement 3.2**
   *
   * For any valid FlowState value from ['input', 'analyzing', 'results',
   * 'applying', 'preview', 'confirmed'], getStepIndex returns a value
   * in [0, FLOW_STEPS.length - 1].
   */
  it('getStepIndex always returns a value within FLOW_STEPS bounds', () => {
    fc.assert(
      fc.property(flowStateArb, (flowState) => {
        const index = getStepIndex(flowState)
        expect(index).toBeGreaterThanOrEqual(0)
        expect(index).toBeLessThanOrEqual(FLOW_STEPS.length - 1)
      }),
      { numRuns: 100 }
    )
  })
})
