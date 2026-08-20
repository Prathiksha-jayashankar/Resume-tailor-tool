/**
 * DownloadGenerator service for the Resume Tailor Tool.
 * Generates PDF and DOCX files from tailored resume text.
 * Preserves formatting: section headings, bullet points, font styles, spacing, and layout.
 */

import PDFDocument from 'pdfkit'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from 'docx'
import { DOWNLOAD_GENERATION_TIMEOUT, FILENAME_MAX_TITLE_CHARS } from './constants'

// ── Types ─────────────────────────────────────────────────────────────────────

export type DownloadResult =
  | { success: true; buffer: Buffer; filename: string; mimeType: string }
  | { success: false; error: string }

// ── Filename Generation ───────────────────────────────────────────────────────

/** Characters not permitted in filenames */
const INVALID_FILENAME_CHARS = /[/\\:*?"<>|]/g

/**
 * Generates a sanitized filename from a job title and format.
 *
 * - Replaces invalid filename characters (/\:*?"<>|) with underscores
 * - Truncates sanitized title to FILENAME_MAX_TITLE_CHARS (50) characters
 * - Produces pattern: Resume_[sanitizedTitle]_Tailored.[ext]
 *
 * Pure function with no side effects.
 */
export function generateFilename(jobTitle: string, format: 'pdf' | 'docx'): string {
  const sanitized = jobTitle.replace(INVALID_FILENAME_CHARS, '_')
  const truncated = sanitized.slice(0, FILENAME_MAX_TITLE_CHARS)
  return `Resume_${truncated}_Tailored.${format}`
}

// ── Content Parsing Helpers ───────────────────────────────────────────────────

interface ContentLine {
  type: 'heading' | 'bullet' | 'body' | 'empty'
  text: string
}

/**
 * Parses resume text content into structured lines for formatting.
 * Detects section headings, bullet points, and body text.
 */
function parseContentLines(content: string): ContentLine[] {
  const lines = content.split('\n')
  const result: ContentLine[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.trim() === '') {
      result.push({ type: 'empty', text: '' })
    } else if (isHeading(line, lines, i)) {
      result.push({ type: 'heading', text: line.trim() })
    } else if (isBulletPoint(line)) {
      result.push({ type: 'bullet', text: extractBulletText(line) })
    } else {
      result.push({ type: 'body', text: line })
    }
  }

  return result
}

/**
 * Determines if a line is a section heading.
 * A heading is detected when:
 * - Line is all uppercase (and > 2 chars)
 * - Line ends with a colon
 * - Line starts with markdown heading syntax (#, ##, etc.)
 * - Line is followed by a separator (---, ===, or empty line then content)
 */
function isHeading(line: string, allLines: string[], index: number): boolean {
  const trimmed = line.trim()

  // Markdown heading syntax
  if (/^#{1,6}\s+/.test(trimmed)) {
    return true
  }

  // All uppercase lines (at least 3 characters, no punctuation except spaces)
  if (trimmed.length >= 3 && trimmed === trimmed.toUpperCase() && /^[A-Z\s&]+$/.test(trimmed)) {
    return true
  }

  // Line ending with colon (common resume section headers like "Experience:")
  if (trimmed.endsWith(':') && trimmed.length > 2 && !trimmed.includes('  ')) {
    return true
  }

  // Line followed by separator (--- or ===)
  if (index < allLines.length - 1) {
    const nextLine = allLines[index + 1].trim()
    if (/^[-=]{3,}$/.test(nextLine)) {
      return true
    }
  }

  return false
}

/**
 * Determines if a line is a bullet point.
 */
function isBulletPoint(line: string): boolean {
  const trimmed = line.trimStart()
  return trimmed.startsWith('- ') || trimmed.startsWith('• ') || trimmed.startsWith('* ')
}

/**
 * Extracts the text content from a bullet point line.
 */
function extractBulletText(line: string): string {
  const trimmed = line.trimStart()
  if (trimmed.startsWith('- ') || trimmed.startsWith('• ') || trimmed.startsWith('* ')) {
    return trimmed.slice(2)
  }
  return trimmed
}

/**
 * Strips markdown heading syntax from heading text.
 */
function stripHeadingMarkers(text: string): string {
  return text.replace(/^#{1,6}\s+/, '').replace(/:$/, '').trim()
}

// ── PDF Generation ────────────────────────────────────────────────────────────

/**
 * Generates a PDF buffer from resume text content.
 *
 * Formatting:
 * - Section headings: Helvetica-Bold, 16pt
 * - Body text: Helvetica, 12pt
 * - Bullet points: Helvetica, 12pt with bullet prefix and indent
 * - Spacing between sections
 */
export function generatePdf(content: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
      })

      const chunks: Buffer[] = []

      doc.on('data', (chunk: Buffer) => {
        chunks.push(chunk)
      })

      doc.on('end', () => {
        resolve(Buffer.concat(chunks))
      })

      doc.on('error', (err: Error) => {
        reject(err)
      })

      const lines = parseContentLines(content)

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]

        switch (line.type) {
          case 'heading': {
            // Add spacing before heading (except first)
            if (i > 0) {
              doc.moveDown(0.5)
            }
            const headingText = stripHeadingMarkers(line.text)
            doc.font('Helvetica-Bold').fontSize(16).text(headingText)
            doc.moveDown(0.3)
            break
          }

          case 'bullet': {
            doc.font('Helvetica').fontSize(12).text(`• ${line.text}`, {
              indent: 20,
            })
            doc.moveDown(0.2)
            break
          }

          case 'body': {
            doc.font('Helvetica').fontSize(12).text(line.text)
            doc.moveDown(0.2)
            break
          }

          case 'empty': {
            doc.moveDown(0.4)
            break
          }
        }
      }

      doc.end()
    } catch (err) {
      reject(err)
    }
  })
}

// ── DOCX Generation ───────────────────────────────────────────────────────────

/**
 * Generates a DOCX buffer from resume text content.
 *
 * Formatting:
 * - Section headings: Heading1 level, bold
 * - Body text: Normal paragraphs
 * - Bullet points: Bullet paragraphs with indentation
 */
export function generateDocx(content: string): Promise<Buffer> {
  const lines = parseContentLines(content)
  const paragraphs: Paragraph[] = []

  for (const line of lines) {
    switch (line.type) {
      case 'heading': {
        const headingText = stripHeadingMarkers(line.text)
        paragraphs.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 240, after: 120 },
            children: [
              new TextRun({
                text: headingText,
                bold: true,
                size: 32, // 16pt = 32 half-points
              }),
            ],
          })
        )
        break
      }

      case 'bullet': {
        paragraphs.push(
          new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 60 },
            children: [
              new TextRun({
                text: line.text,
                size: 24, // 12pt = 24 half-points
              }),
            ],
          })
        )
        break
      }

      case 'body': {
        paragraphs.push(
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { after: 60 },
            children: [
              new TextRun({
                text: line.text,
                size: 24, // 12pt = 24 half-points
              }),
            ],
          })
        )
        break
      }

      case 'empty': {
        paragraphs.push(
          new Paragraph({
            spacing: { after: 120 },
            children: [],
          })
        )
        break
      }
    }
  }

  const doc = new Document({
    sections: [
      {
        children: paragraphs,
      },
    ],
  })

  return Packer.toBuffer(doc)
}

// ── Download Orchestrator ─────────────────────────────────────────────────────

/**
 * Generates a downloadable file from tailored resume content.
 *
 * - Generates a sanitized filename from the job title
 * - Produces the file in the requested format (PDF or DOCX)
 * - Enforces a 5-second timeout (DOWNLOAD_GENERATION_TIMEOUT)
 *
 * Returns a DownloadResult with either the buffer and metadata, or an error.
 */
export async function generateDownload(
  content: string,
  jobTitle: string,
  format: 'pdf' | 'docx'
): Promise<DownloadResult> {
  const filename = generateFilename(jobTitle, format)

  const mimeType =
    format === 'pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

  try {
    const generationPromise =
      format === 'pdf' ? generatePdf(content) : generateDocx(content)

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error('Download generation timed out')),
        DOWNLOAD_GENERATION_TIMEOUT
      )
    })

    const buffer = await Promise.race([generationPromise, timeoutPromise])

    return {
      success: true,
      buffer,
      filename,
      mimeType,
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Unknown error during download generation'
    return {
      success: false,
      error: message,
    }
  }
}
