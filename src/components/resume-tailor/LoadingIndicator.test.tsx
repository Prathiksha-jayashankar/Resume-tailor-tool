/**
 * Unit tests for LoadingIndicator component.
 *
 * Requirements: 8.6, 8.7
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { LoadingIndicator } from './LoadingIndicator'

describe('LoadingIndicator', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders nothing when isLoading is false', () => {
    const { container } = render(<LoadingIndicator isLoading={false} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders spinner, elapsed time, and disclaimer when isLoading is true', () => {
    const now = Date.now()
    const { container } = render(<LoadingIndicator isLoading={true} startTime={now} />)

    expect(container.querySelector('[data-testid="loading-indicator"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="loading-spinner"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="loading-elapsed-time"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="ai-disclaimer"]')).not.toBeNull()
  })

  it('displays elapsed time in seconds', () => {
    const now = Date.now()

    const { container } = render(<LoadingIndicator isLoading={true} startTime={now} />)
    const elapsed = container.querySelector('[data-testid="loading-elapsed-time"]')!
    expect(elapsed.textContent).toBe('Processing... 0s')

    // Advance 1 second — advanceTimersByTime also advances Date.now()
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(elapsed.textContent).toBe('Processing... 1s')

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(elapsed.textContent).toBe('Processing... 2s')

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(elapsed.textContent).toBe('Processing... 3s')
  })

  it('updates elapsed time every second', () => {
    const now = Date.now()

    const { container } = render(<LoadingIndicator isLoading={true} startTime={now} />)
    const elapsed = container.querySelector('[data-testid="loading-elapsed-time"]')!
    expect(elapsed.textContent).toBe('Processing... 0s')

    // After 5 seconds
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(elapsed.textContent).toBe('Processing... 5s')
  })

  it('shows the AI disclaimer text', () => {
    const { container } = render(<LoadingIndicator isLoading={true} startTime={Date.now()} />)
    const disclaimer = container.querySelector('[data-testid="ai-disclaimer"]')!

    expect(disclaimer.textContent).toBe(
      'AI suggestions are machine-generated and should be reviewed and verified before submission.'
    )
  })

  it('has role="status" for accessibility', () => {
    const { container } = render(<LoadingIndicator isLoading={true} startTime={Date.now()} />)
    const indicator = container.querySelector('[data-testid="loading-indicator"]')!

    expect(indicator.getAttribute('role')).toBe('status')
  })

  it('has aria-live="polite" on elapsed time for screen readers', () => {
    const { container } = render(<LoadingIndicator isLoading={true} startTime={Date.now()} />)
    const elapsed = container.querySelector('[data-testid="loading-elapsed-time"]')!

    expect(elapsed.getAttribute('aria-live')).toBe('polite')
  })

  it('shows 0s elapsed when startTime is not provided', () => {
    const { container } = render(<LoadingIndicator isLoading={true} />)
    const elapsed = container.querySelector('[data-testid="loading-elapsed-time"]')!

    expect(elapsed.textContent).toBe('Processing... 0s')
  })
})

describe('LoadingIndicator skeleton variant', () => {
  it('renders skeleton container when variant="skeleton"', () => {
    render(<LoadingIndicator isLoading={true} variant="skeleton" />)
    expect(screen.getByTestId('skeleton-container')).toBeTruthy()
  })

  it('renders spinner when variant="spinner"', () => {
    render(<LoadingIndicator isLoading={true} variant="spinner" startTime={Date.now()} />)
    expect(screen.getByTestId('loading-spinner')).toBeTruthy()
  })

  it('renders spinner when variant is undefined (default behavior)', () => {
    render(<LoadingIndicator isLoading={true} startTime={Date.now()} />)
    expect(screen.getByTestId('loading-spinner')).toBeTruthy()
  })

  it('sets aria-hidden="true" on skeleton elements', () => {
    render(<LoadingIndicator isLoading={true} variant="skeleton" />)

    const gauge = screen.getByTestId('skeleton-gauge')
    expect(gauge.getAttribute('aria-hidden')).toBe('true')

    for (let i = 0; i < 4; i++) {
      const category = screen.getByTestId(`skeleton-category-${i}`)
      expect(category.getAttribute('aria-hidden')).toBe('true')
    }
  })

  it('parent has role="status" and aria-live="polite"', () => {
    render(<LoadingIndicator isLoading={true} variant="skeleton" />)

    const indicator = screen.getByTestId('loading-indicator')
    expect(indicator.getAttribute('role')).toBe('status')
    expect(indicator.getAttribute('aria-live')).toBe('polite')
  })

  it('shows AI disclaimer text in skeleton variant', () => {
    render(<LoadingIndicator isLoading={true} variant="skeleton" />)

    const disclaimer = screen.getByTestId('ai-disclaimer')
    expect(disclaimer.textContent).toBe(
      'AI suggestions are machine-generated and should be reviewed and verified before submission.'
    )
  })

  it('shows AI disclaimer text in spinner variant', () => {
    render(<LoadingIndicator isLoading={true} variant="spinner" startTime={Date.now()} />)

    const disclaimer = screen.getByTestId('ai-disclaimer')
    expect(disclaimer.textContent).toBe(
      'AI suggestions are machine-generated and should be reviewed and verified before submission.'
    )
  })

  it('"Loading analysis results" text exists for screen readers', () => {
    render(<LoadingIndicator isLoading={true} variant="skeleton" />)

    const srText = screen.getByTestId('loading-status-text')
    expect(srText.textContent).toBe('Loading analysis results')
  })
})
