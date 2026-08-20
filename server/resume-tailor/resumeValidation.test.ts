import { describe, it, expect } from 'vitest'
import { validateResumeContent } from './resumeValidation'

describe('validateResumeContent', () => {
  it('rejects empty string with EMPTY code', () => {
    const result = validateResumeContent('')
    expect(result).toEqual({
      valid: false,
      error: 'Please provide resume content.',
      code: 'EMPTY',
    })
  })

  it('rejects whitespace-only string with WHITESPACE_ONLY code', () => {
    const result = validateResumeContent('   \t\n  ')
    expect(result).toEqual({
      valid: false,
      error: 'Resume content cannot contain only whitespace. Please provide valid content.',
      code: 'WHITESPACE_ONLY',
    })
  })

  it('rejects string shorter than 50 characters after trimming with TOO_SHORT code', () => {
    const result = validateResumeContent('Short resume text here.')
    expect(result).toEqual({
      valid: false,
      error: 'Please provide valid resume content with at least 50 characters.',
      code: 'TOO_SHORT',
    })
  })

  it('rejects string with leading/trailing whitespace that is too short after trimming', () => {
    const result = validateResumeContent('   short   ')
    expect(result).toEqual({
      valid: false,
      error: 'Please provide valid resume content with at least 50 characters.',
      code: 'TOO_SHORT',
    })
  })

  it('accepts string with exactly 50 characters after trimming', () => {
    const text = 'a'.repeat(50)
    const result = validateResumeContent(text)
    expect(result).toEqual({ valid: true })
  })

  it('accepts string with more than 50 characters after trimming', () => {
    const text = 'Experienced software engineer with 10 years of backend development expertise.'
    const result = validateResumeContent(text)
    expect(result).toEqual({ valid: true })
  })

  it('accepts string with leading/trailing whitespace when trimmed content is >= 50 chars', () => {
    const text = '   ' + 'a'.repeat(50) + '   '
    const result = validateResumeContent(text)
    expect(result).toEqual({ valid: true })
  })
})
