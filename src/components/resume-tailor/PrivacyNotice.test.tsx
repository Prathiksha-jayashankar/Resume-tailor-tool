/**
 * Tests for PrivacyNotice component.
 * Covers Requirements: 9.5
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PrivacyNotice } from './PrivacyNotice'

describe('PrivacyNotice', () => {
  it('renders nothing when isVisible is false', () => {
    const { container } = render(
      <PrivacyNotice isVisible={false} onAcknowledge={() => {}} />
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders modal overlay and dialog when isVisible is true', () => {
    render(<PrivacyNotice isVisible={true} onAcknowledge={() => {}} />)

    expect(screen.getByTestId('privacy-notice-overlay')).toBeTruthy()
    expect(screen.getByTestId('privacy-notice-dialog')).toBeTruthy()
  })

  it('displays "Privacy Notice" title', () => {
    render(<PrivacyNotice isVisible={true} onAcknowledge={() => {}} />)

    const title = screen.getByTestId('privacy-notice-title')
    expect(title.textContent).toBe('Privacy Notice')
  })

  it('describes data collection and LLM processing', () => {
    render(<PrivacyNotice isVisible={true} onAcknowledge={() => {}} />)

    const body = screen.getByTestId('privacy-notice-body')
    expect(body.textContent).toContain('sent to our server for AI-powered analysis')
    expect(body.textContent).toContain('Large Language Model')
  })

  it('describes session timeout and deletion', () => {
    render(<PrivacyNotice isVisible={true} onAcknowledge={() => {}} />)

    const body = screen.getByTestId('privacy-notice-body')
    expect(body.textContent).toContain('30 minutes of inactivity')
    expect(body.textContent).toContain('deleted from server memory at session end')
  })

  it('has accessible dialog role with aria-modal and aria-labelledby', () => {
    render(<PrivacyNotice isVisible={true} onAcknowledge={() => {}} />)

    const dialog = screen.getByTestId('privacy-notice-dialog')
    expect(dialog.getAttribute('role')).toBe('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.getAttribute('aria-labelledby')).toBe('privacy-notice-title')
  })

  it('calls onAcknowledge when button is clicked', () => {
    const onAcknowledge = vi.fn()
    render(<PrivacyNotice isVisible={true} onAcknowledge={onAcknowledge} />)

    fireEvent.click(screen.getByTestId('privacy-acknowledge-btn'))
    expect(onAcknowledge).toHaveBeenCalledTimes(1)
  })

  it('displays "I Understand and Accept" button text', () => {
    render(<PrivacyNotice isVisible={true} onAcknowledge={() => {}} />)

    const button = screen.getByTestId('privacy-acknowledge-btn')
    expect(button.textContent).toBe('I Understand and Accept')
  })

  it('focuses the acknowledge button when visible', () => {
    render(<PrivacyNotice isVisible={true} onAcknowledge={() => {}} />)

    const button = screen.getByTestId('privacy-acknowledge-btn')
    expect(document.activeElement).toBe(button)
  })
})
