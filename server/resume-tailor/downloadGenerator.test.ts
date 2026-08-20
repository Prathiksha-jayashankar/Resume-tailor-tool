/**
 * Unit tests for DownloadGenerator service.
 * Tests filename generation, PDF generation, DOCX generation, and the orchestrator.
 */

import { describe, it, expect } from 'vitest'
import {
  generateFilename,
  generatePdf,
  generateDocx,
  generateDownload,
} from './downloadGenerator'

describe('generateFilename', () => {
  it('produces correct pattern for a simple job title', () => {
    const result = generateFilename('Software Engineer', 'pdf')
    expect(result).toBe('Resume_Software Engineer_Tailored.pdf')
  })

  it('produces correct pattern for docx format', () => {
    const result = generateFilename('Data Analyst', 'docx')
    expect(result).toBe('Resume_Data Analyst_Tailored.docx')
  })

  it('replaces invalid filename characters with underscores', () => {
    const result = generateFilename('Dev/Ops: "Lead" <Sr>', 'pdf')
    expect(result).toBe('Resume_Dev_Ops_ _Lead_ _Sr__Tailored.pdf')
    expect(result).not.toMatch(/[/\\:*?"<>|]/)
  })

  it('truncates title to 50 characters', () => {
    const longTitle = 'A'.repeat(60)
    const result = generateFilename(longTitle, 'docx')
    // Extract the title portion between Resume_ and _Tailored.
    const titleMatch = result.match(/^Resume_(.+)_Tailored\.docx$/)
    expect(titleMatch).not.toBeNull()
    expect(titleMatch![1].length).toBeLessThanOrEqual(50)
  })

  it('handles empty job title', () => {
    const result = generateFilename('', 'pdf')
    expect(result).toBe('Resume__Tailored.pdf')
  })

  it('replaces backslashes and pipes', () => {
    const result = generateFilename('Sr\\Lead|Manager', 'docx')
    expect(result).toBe('Resume_Sr_Lead_Manager_Tailored.docx')
  })
})

describe('generatePdf', () => {
  it('generates a valid PDF buffer', async () => {
    const content = `EXPERIENCE
- Led a team of 5 engineers
- Delivered project on time

SKILLS
JavaScript, TypeScript, React`

    const buffer = await generatePdf(content)
    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.length).toBeGreaterThan(0)
    // PDF files start with %PDF
    expect(buffer.toString('ascii', 0, 4)).toBe('%PDF')
  })

  it('handles empty content', async () => {
    const buffer = await generatePdf('')
    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.length).toBeGreaterThan(0)
  })

  it('handles content with markdown headings', async () => {
    const content = `# Professional Summary
Experienced engineer with 10+ years.

## Technical Skills
- JavaScript
- Python`

    const buffer = await generatePdf(content)
    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.toString('ascii', 0, 4)).toBe('%PDF')
  })
})

describe('generateDocx', () => {
  it('generates a valid DOCX buffer', async () => {
    const content = `EXPERIENCE
- Led a team of 5 engineers
- Delivered project on time

SKILLS
JavaScript, TypeScript, React`

    const buffer = await generateDocx(content)
    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.length).toBeGreaterThan(0)
    // DOCX files are ZIP archives, starting with PK signature
    expect(buffer[0]).toBe(0x50) // P
    expect(buffer[1]).toBe(0x4b) // K
  })

  it('handles empty content', async () => {
    const buffer = await generateDocx('')
    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.length).toBeGreaterThan(0)
  })

  it('handles content with bullet points', async () => {
    const content = `Skills:
- JavaScript
- TypeScript
• React
* Node.js`

    const buffer = await generateDocx(content)
    expect(buffer).toBeInstanceOf(Buffer)
  })
})

describe('generateDownload', () => {
  it('generates PDF download with correct metadata', async () => {
    const content = 'EXPERIENCE\n- Built scalable systems'
    const result = await generateDownload(content, 'Software Engineer', 'pdf')

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.filename).toBe('Resume_Software Engineer_Tailored.pdf')
      expect(result.mimeType).toBe('application/pdf')
      expect(result.buffer).toBeInstanceOf(Buffer)
      expect(result.buffer.length).toBeGreaterThan(0)
    }
  })

  it('generates DOCX download with correct metadata', async () => {
    const content = 'SKILLS\nJavaScript, Python'
    const result = await generateDownload(content, 'Data Analyst', 'docx')

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.filename).toBe('Resume_Data Analyst_Tailored.docx')
      expect(result.mimeType).toBe(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      )
      expect(result.buffer).toBeInstanceOf(Buffer)
    }
  })

  it('sanitizes job title in filename', async () => {
    const content = 'Some resume content here'
    const result = await generateDownload(content, 'Dev/Ops: "Lead"', 'pdf')

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.filename).not.toMatch(/[/\\:*?"<>|]/)
    }
  })

  it('completes within 5 seconds for reasonable content', async () => {
    const content = 'EXPERIENCE\n- Led development\n\nSKILLS\nJavaScript'
    const start = Date.now()
    const result = await generateDownload(content, 'Engineer', 'pdf')
    const elapsed = Date.now() - start

    expect(result.success).toBe(true)
    expect(elapsed).toBeLessThan(5000)
  })
})
