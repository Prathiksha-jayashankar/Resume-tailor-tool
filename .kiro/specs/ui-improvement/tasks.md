# Implementation Plan: UI Improvement

## Overview

This plan implements a modern UI layer for the Resume Tailor Tool through a CSS design tokens system, card wrapper styling, step progress bar, skeleton loading states, animated score gauge, and accessibility enhancements. The approach layers CSS-only design tokens as the foundation, then builds component-level visual enhancements on top, followed by workflow UX improvements. All changes are presentational — no backend or data flow modifications.

## Tasks

- [x] 1. Set up Design Tokens system and global stylesheet foundation
  - [x] 1.1 Create `src/components/resume-tailor/design-tokens.css` with all CSS custom properties
    - Define `:root` variables for colors (primary, secondary, accent, success, warning, error, surface, background, border)
    - Define spacing scale (4px base: 4px, 8px, 12px, 16px, 20px, 24px, 32px, 48px)
    - Define typography tokens (heading1, heading2, heading3, body, caption with size, weight, line-height)
    - Define shadow elevations (sm, md, lg, xl)
    - Define border radii (sm: 6px, md: 10px, lg: 14px, xl: 20px, full: 9999px)
    - Define transition tokens (fast, normal, slow durations and ease-default, ease-in, ease-out timing functions)
    - Add `prefers-reduced-motion: reduce` media query to set all animation/transition durations to 0ms
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 6.1, 7.3_

  - [x] 1.2 Create `src/components/resume-tailor/global.css` with base styles and card classes
    - Define `.card`, `.card--elevated`, `.card--interactive`, `.card--glass` CSS classes
    - Apply border-radius from `--radius-lg`, box-shadow from `--shadow-md`, padding from `--spacing-6`
    - Add hover/focus transition for interactive cards (shadow md → lg in 200ms)
    - Add glass-morphism styles (alpha opacity 0.7–0.85, backdrop-filter blur 8px)
    - Add `prefers-reduced-motion: reduce` override for instant transitions
    - Add focus indicator styles with 3:1 contrast ratio
    - Ensure hover transitions only animate transform and opacity (not layout properties)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 6.2, 7.1_

  - [x] 1.3 Import design-tokens.css and global.css in `src/main.tsx`
    - Add import statements for the new stylesheets before component imports
    - Ensure load order: design-tokens → global → component-specific CSS
    - _Requirements: 1.7, 7.4_

- [x] 2. Implement StepProgressBar component
  - [x] 2.1 Create `src/components/resume-tailor/StepProgressBar.tsx`
    - Define `StepDefinition` and `StepProgressBarProps` interfaces
    - Define `FLOW_STEPS` constant with 5 steps (Input, Analyze, Results, Preview, Download)
    - Implement `getStepIndex(flowState)` mapping function
    - Implement `getStepStatus(stepIndex, currentIndex)` returning 'completed' | 'active' | 'upcoming'
    - Render numbered step indicators with labels and connecting lines
    - Show checkmark icon for completed steps with opacity 0.5–0.7
    - Mark active step with `aria-current="step"`
    - Fill connecting lines between completed steps
    - Add responsive collapse: icons-only below 600px viewport width
    - Ensure 3:1 contrast ratio for all step states
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 6.4_

  - [x]* 2.2 Write property test for step status correctness
    - **Property 1: Step status correctness**
    - For any valid steps array (length >= 2) and currentStep in [0, steps.length - 1], verify exactly one step is active, all prior steps are completed, all later steps are upcoming
    - **Validates: Requirements 3.2, 3.3, 3.4, 3.7**

  - [x]* 2.3 Write property test for step count rendering
    - **Property 2: Step count rendering**
    - For any non-empty array of step definitions, verify the component renders exactly steps.length step indicator elements
    - **Validates: Requirement 3.1**

  - [x]* 2.4 Write property test for progress line proportionality
    - **Property 3: Progress line proportionality**
    - For any steps array and currentStep value, verify the connecting line fill percentage equals currentStep / (steps.length - 1) * 100
    - **Validates: Requirement 3.5**

  - [x]* 2.5 Write property test for step index bounds safety
    - **Property 6: Step index bounds safety**
    - For any valid FlowState value, verify getStepIndex returns a value in [0, FLOW_STEPS.length - 1]
    - **Validates: Requirement 3.2**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Enhance LoadingIndicator with skeleton loading states
  - [x] 4.1 Update `src/components/resume-tailor/LoadingIndicator.tsx` to support skeleton variant
    - Add `variant?: 'spinner' | 'skeleton'` prop with default value 'spinner'
    - When variant is 'skeleton': render circular skeleton (matching score gauge dimensions) and 4 rectangular skeletons (matching keyword category sections)
    - Apply pulse animation (opacity 0.4 ↔ 1.0 over 1.5s infinite)
    - Set `aria-hidden="true"` on skeleton placeholder elements
    - Ensure parent container has `role="status"` and `aria-live="polite"` with "Loading analysis results" text
    - Retain AI disclaimer text in both variants
    - Reserve exact layout dimensions to prevent CLS (width/height match content)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 6.5, 7.2_

  - [x]* 4.2 Write unit tests for LoadingIndicator skeleton variant
    - Test skeleton renders when variant="skeleton"
    - Test spinner renders when variant="spinner" or variant is undefined
    - Test aria attributes are correct on skeleton elements
    - Test AI disclaimer is present in both variants
    - _Requirements: 4.1, 4.2, 4.4, 4.5, 4.6, 4.7_

- [x] 5. Implement animated score gauge
  - [x] 5.1 Create `src/components/resume-tailor/useAnimatedValue.ts` custom hook
    - Implement `useAnimatedValue(target, duration)` using requestAnimationFrame
    - Use ease-out cubic timing function: `1 - Math.pow(1 - progress, 3)`
    - Return integer values from 0 to target, monotonically non-decreasing
    - Respect `prefers-reduced-motion: reduce` — return target immediately
    - Read layout properties only before animation loop begins (avoid forced reflows)
    - Re-trigger animation from 0 when target changes
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 7.5, 7.6_

  - [x] 5.2 Update `src/components/resume-tailor/MatchScoreGauge.tsx` to use animated values
    - Import and use `useAnimatedValue` hook for overall score
    - Animate score arc strokeDasharray from 0 to target over 1200ms
    - Animate category breakdown bars from 0% to target width over 1200ms
    - Display interpolated integer score in center during animation
    - Display exact target value when animation completes
    - When `prefers-reduced-motion: reduce`, show final values immediately
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x]* 5.3 Write property test for animated value bounds and convergence
    - **Property 4: Animated value bounds and convergence**
    - For any target in [0, 100], verify values are always integers in [0, target], starting at 0, monotonically non-decreasing, converging to target
    - **Validates: Requirements 5.1, 5.3, 5.4**

  - [x]* 5.4 Write property test for animation timing completion
    - **Property 5: Animation timing completion**
    - For any target in [0, 100] with 1200ms duration, verify the hook returns exact target after duration elapses
    - **Validates: Requirement 5.2**

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Integrate components into ResumeTailorPage and apply card styling
  - [x] 7.1 Update `src/components/resume-tailor/ResumeTailorPage.tsx` to add StepProgressBar
    - Import StepProgressBar component
    - Add StepProgressBar below the page header, passing current flowState via getStepIndex
    - Ensure step updates on every flowState change
    - _Requirements: 3.1, 3.2_

  - [x] 7.2 Apply card wrapper classes to panel components in ResumeTailorPage
    - Add `.card .card--elevated` className to input section wrapper
    - Add `.card .card--interactive` className to suggestion cards
    - Add `.card .card--elevated` to AnalysisView wrapper
    - Add `.card .card--elevated` to ResumePreview and DownloadPanel wrappers
    - Ensure all var() usages include fallback values
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 1.7_

  - [x] 7.3 Update `src/components/resume-tailor/ResumeTailorPage.tsx` to use skeleton loading
    - Pass `variant="skeleton"` to LoadingIndicator when in 'analyzing' state
    - Pass `variant="spinner"` when in 'applying' state
    - _Requirements: 4.1, 4.2, 4.7_

  - [x] 7.4 Ensure all interactive elements meet accessibility requirements
    - Verify all buttons, links, and inputs have minimum 44x44px touch targets
    - Apply focus indicator styles from global.css to all interactive elements
    - Ensure step progress bar states meet 3:1 contrast ratio
    - _Requirements: 6.2, 6.3, 6.4_

- [x] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All CSS animations use transform/opacity only to stay on the GPU compositor layer
- The design-tokens.css has zero JavaScript runtime cost — purely CSS custom properties
- All var() usages must include a hardcoded fallback for browser compatibility

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3", "2.1"] },
    { "id": 3, "tasks": ["2.2", "2.3", "2.4", "2.5", "4.1"] },
    { "id": 4, "tasks": ["4.2", "5.1"] },
    { "id": 5, "tasks": ["5.2", "5.3", "5.4"] },
    { "id": 6, "tasks": ["7.1", "7.2", "7.3"] },
    { "id": 7, "tasks": ["7.4"] }
  ]
}
```
