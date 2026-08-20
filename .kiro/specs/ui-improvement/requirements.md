# Requirements Document

## Introduction

This document defines the requirements for the UI Improvement feature of the Resume Tailor Tool. The feature introduces a CSS design tokens system, glass-morphism card styling, a step-progress indicator, skeleton loading states, an animated score gauge, and accessibility enhancements — all without modifying the existing component architecture or backend logic.

## Glossary

- **Design_Tokens_System**: A centralized set of CSS custom properties defining colors, spacing, typography, shadows, border radii, and animation timing values used across all components.
- **StepProgressBar**: A visual workflow indicator component that displays the user's current position across the resume tailoring flow steps.
- **FlowState**: An enumeration representing the current workflow stage: input, analyzing, results, applying, preview, or confirmed.
- **Skeleton_Loader**: Animated placeholder elements that mimic the shape of incoming content during loading states.
- **Card_Wrapper**: A CSS-based styling pattern providing consistent elevated styling (border-radius, shadow, padding) to panel sections.
- **MatchScoreGauge**: A circular SVG gauge component that visually represents the resume-to-job match score from 0 to 100.
- **Animated_Score_Gauge**: An enhanced version of the MatchScoreGauge that animates the score arc from 0 to the target value on render.
- **Reduced_Motion**: A user accessibility preference indicated by the `prefers-reduced-motion: reduce` media query that requests minimized animations.
- **Touch_Target**: The interactive area of a clickable or focusable element, measured in CSS pixels.

## Requirements

### Requirement 1: Design Tokens System

**User Story:** As a developer, I want a centralized design tokens system using CSS custom properties, so that styling is consistent across all components and easy to maintain.

#### Acceptance Criteria

1. THE Design_Tokens_System SHALL define CSS custom properties on the `:root` selector for colors: primary, secondary, accent, success, warning, error, surface, background, and border.
2. THE Design_Tokens_System SHALL define CSS custom properties for a spacing scale based on a 4px base unit, providing at minimum 8 steps (4px, 8px, 12px, 16px, 20px, 24px, 32px, 48px).
3. THE Design_Tokens_System SHALL define CSS custom properties for typography including font sizes, font weights, and line heights for each of: heading1, heading2, heading3, body, and caption.
4. THE Design_Tokens_System SHALL define CSS custom properties for shadow elevations at four levels: sm, md, lg, and xl.
5. THE Design_Tokens_System SHALL define CSS custom properties for border radii at five levels: sm, md, lg, xl, and full (where full produces a circular shape on square elements).
6. THE Design_Tokens_System SHALL define CSS custom properties for transitions including at least 3 duration tokens (fast, normal, slow) and at least 3 timing-function tokens (ease-default, ease-in, ease-out).
7. WHEN a CSS custom property is used in a component, THE Design_Tokens_System SHALL provide a hardcoded fallback value in the var() function so that the component renders with a valid style if the custom property is undefined.

### Requirement 2: Card Wrapper Styling

**User Story:** As a user, I want panel sections to have consistent elevated card styling with shadows and rounded corners, so that the interface looks cohesive and visually organized.

#### Acceptance Criteria

1. THE Card_Wrapper SHALL apply a border-radius using the design tokens lg radius value to all panel sections.
2. THE Card_Wrapper SHALL apply a box-shadow using the design tokens md elevation value to all panel sections.
3. THE Card_Wrapper SHALL apply padding using the design tokens spacing-6 (24px) value to all panel sections.
4. WHEN a card has the interactive variant and the user hovers or focuses, THE Card_Wrapper SHALL transition the box-shadow from the md elevation to the lg elevation within 200 milliseconds using the design tokens transition timing function.
5. WHEN a card has the interactive variant, THE Card_Wrapper SHALL apply a CSS transition on the box-shadow property with a duration of 200 milliseconds using the design tokens ease timing function for hover and focus states.
6. WHILE the glass-morphism style variant is applied, THE Card_Wrapper SHALL use a background with an alpha opacity between 0.7 and 0.85 and a backdrop-filter blur of 8px.
7. WHEN prefers-reduced-motion is set to reduce, THE Card_Wrapper SHALL apply elevation changes instantly without animated transitions.

### Requirement 3: Step Progress Bar

**User Story:** As a user, I want to see a visual progress indicator showing my current step in the resume tailoring workflow, so that I understand where I am in the process and what comes next.

#### Acceptance Criteria

1. THE StepProgressBar SHALL display exactly 5 workflow steps (Input, Analyze, Results, Preview, Download) as sequentially numbered indicators (1 through 5) with corresponding text labels.
2. WHEN the FlowState changes, THE StepProgressBar SHALL update the active step indicator according to the following mapping: "input" maps to step 1, "analyzing" maps to step 2, "results" maps to step 3, "applying" maps to step 3, "preview" maps to step 4, "confirmed" maps to step 5.
3. WHILE a step index is less than the current active step index, THE StepProgressBar SHALL display that step with a completed state indicated by a checkmark icon replacing the step number and a reduced-opacity visual treatment (opacity between 0.5 and 0.7).
4. THE StepProgressBar SHALL display exactly one step as active at any time, with no more than one step highlighted.
5. THE StepProgressBar SHALL render connecting lines between adjacent step indicators, where lines between completed steps display a filled style and lines between or after the active step display an unfilled style.
6. WHEN the viewport width is below 600px, THE StepProgressBar SHALL collapse step text labels and display only step icons or numbers.
7. WHEN a step is the active step, THE StepProgressBar SHALL mark it with aria-current="step" for screen reader accessibility.

### Requirement 4: Enhanced Loading Indicator with Skeleton States

**User Story:** As a user, I want to see skeleton placeholders during loading that mirror the layout of incoming content, so that I have a clear expectation of what will appear and experience less perceived waiting time.

#### Acceptance Criteria

1. WHEN the variant prop is set to "skeleton", THE LoadingIndicator SHALL display a circular skeleton placeholder matching the dimensions of the score gauge and four rectangular skeleton placeholders matching the dimensions of the keyword category sections.
2. WHEN the variant prop is set to "spinner", THE LoadingIndicator SHALL display the existing spinner with elapsed time.
3. THE Skeleton_Loader SHALL apply a pulse animation cycling opacity between 0.4 and 1.0 over a 1.5-second duration with infinite repetition to all skeleton placeholder elements.
4. THE Skeleton_Loader SHALL set aria-hidden="true" on all skeleton placeholder elements.
5. WHEN skeleton elements are displayed, THE LoadingIndicator parent container SHALL have role="status" and aria-live="polite".
6. THE LoadingIndicator SHALL retain the AI disclaimer text in both spinner and skeleton variants.
7. IF the variant prop is not provided, THEN THE LoadingIndicator SHALL default to the "spinner" variant.

### Requirement 5: Animated Score Gauge

**User Story:** As a user, I want the match score gauge to animate from 0 to the final value when results appear, so that the score reveal feels engaging and draws my attention to the result.

#### Acceptance Criteria

1. WHEN analysis results are displayed, THE Animated_Score_Gauge SHALL animate the score arc from 0 to the target value (0–100) using an ease-out cubic timing function over a duration of 1200 milliseconds.
2. WHILE the animation is in progress, THE Animated_Score_Gauge SHALL display the current interpolated integer score value (rounded down) in the center of the gauge.
3. WHEN the animation completes, THE Animated_Score_Gauge SHALL display the exact target score value as a static integer in the center of the gauge.
4. WHEN analysis results are displayed AND prefers-reduced-motion is set to reduce, THE Animated_Score_Gauge SHALL display the final score and filled arc at the target value immediately without animation, within a single rendered frame.
5. WHEN new analysis results replace previously displayed results, THE Animated_Score_Gauge SHALL re-animate the score arc starting from 0 to the new target value using the same timing function and duration.
6. WHEN analysis results are displayed, THE Animated_Score_Gauge SHALL animate each category breakdown bar from 0% width to the category's target score width over the same 1200 millisecond duration.

### Requirement 6: Accessibility

**User Story:** As a user with accessibility needs, I want the UI to respect my motion preferences, provide visible focus indicators, and meet minimum touch target sizes, so that I can use the application comfortably regardless of ability.

#### Acceptance Criteria

1. WHEN prefers-reduced-motion is set to reduce, THE Design_Tokens_System SHALL set all animation duration tokens to 0ms and all transition duration tokens to 0ms, resulting in instant state changes with no visible motion.
2. THE ResumeTailorPage SHALL provide a visible focus indicator on all interactive elements (buttons, links, inputs) with a minimum contrast ratio of 3:1 against adjacent colors as required by WCAG 2.1 AA (Success Criterion 2.4.7).
3. THE ResumeTailorPage SHALL ensure all interactive elements have a minimum touch target size of 44x44 CSS pixels as specified by WCAG 2.1 AA (Success Criterion 2.5.5).
4. WHEN the StepProgressBar renders step indicators, THE StepProgressBar SHALL provide a minimum contrast ratio of 3:1 between the foreground color of completed, active, and upcoming step states and their respective backgrounds.
5. WHEN skeleton loading is active, THE LoadingIndicator SHALL announce loading status to screen readers via an aria-live="polite" region with a text content of "Loading analysis results".

### Requirement 7: Performance and Compatibility

**User Story:** As a user on a range of devices, I want the UI enhancements to perform smoothly and not cause layout shifts, so that the application feels responsive regardless of hardware capability.

#### Acceptance Criteria

1. THE Card_Wrapper SHALL use only CSS transform and opacity properties for hover transitions with a duration between 150ms and 300ms, ensuring no properties that trigger layout or paint operations are animated.
2. THE Skeleton_Loader SHALL reserve the exact layout dimensions (width and height) of the content it replaces such that the Cumulative Layout Shift contribution from the skeleton-to-content swap is 0.
3. THE Design_Tokens_System SHALL have zero JavaScript runtime cost by using only CSS custom properties with no JavaScript executed to resolve or apply token values.
4. IF a browser does not support CSS custom properties, THEN THE Design_Tokens_System SHALL render all themed values using the hardcoded fallback specified as the second argument in each var() declaration.
5. THE Animated_Score_Gauge SHALL use requestAnimationFrame for score number counting without triggering forced layout reflows, reading layout properties only before the animation loop begins.
6. WHILE hover transitions or score animations are running, THE system SHALL maintain a frame rate of at least 30 frames per second with no individual frame exceeding 33ms of main-thread work.
