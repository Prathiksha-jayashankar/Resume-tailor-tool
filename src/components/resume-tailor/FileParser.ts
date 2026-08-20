/**
 * Client-side file parser utility for the Resume Tailor Tool.
 * Extracts text from PDF, DOCX, and TXT files with validation.
 *
 * Requirements: 1.2 (file upload accepts PDF, DOCX, TXT with max 5 MB)
 *               1.3 (extract text content within 10 seconds)
 *               1.4 (display error for unsupported file format)
 *               1.7 (display error for corrupted/unreadable files)
 */

import * as pdfjsLib from 'pdfjs-dist'
import mammoth from 'mammoth'

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString()

// ── Constants ─────────────────────────────────────────────────────────────────

/** Maximum file size in bytes (5 MB) */
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024

/** Accepted file extensions for resume upload */
export const VALID_FILE_EXTENSIONS = ['.pdf', '.docx', '.txt'] as const

// ── Types ─────────────────────────────────────────────────────────────────────

export type FileParseErrorCode =
  | 'UNSUPPORTED_FORMAT'
  | 'FILE_TOO_LARGE'
  | 'CORRUPTED_FILE'
  | 'PARSE_ERROR'

export type FileParseResult =
  | { success: true; text: string }
  | { success: false; error: string; code: FileParseErrorCode }

export type ValidationResult =
  | { valid: true }
  | { valid: false; error: string; code: FileParseErrorCode }

// ── Validation Functions ──────────────────────────────────────────────────────

/**
 * Validates that the file has an accepted extension (PDF, DOCX, TXT).
 */
export function validateFileFormat(file: File): ValidationResult {
  const fileName = file.name.toLowerCase()
  const extension = getFileExtension(fileName)

  if (!VALID_FILE_EXTENSIONS.includes(extension as typeof VALID_FILE_EXTENSIONS[number])) {
    return {
      valid: false,
      error: 'Unsupported file format. Please upload a PDF, DOCX, or TXT file.',
      code: 'UNSUPPORTED_FORMAT',
    }
  }

  return { valid: true }
}

/**
 * Validates that the file size does not exceed 5 MB.
 */
export function validateFileSize(file: File): ValidationResult {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: 'File size exceeds the 5 MB limit. Please reduce the file size or paste content directly.',
      code: 'FILE_TOO_LARGE',
    }
  }

  return { valid: true }
}

// ── Main Parse Function ───────────────────────────────────────────────────────

/**
 * Parses a file and extracts its text content.
 * Validates format and size before attempting extraction.
 */
export async function parseFile(file: File): Promise<FileParseResult> {
  // Validate file format
  const formatResult = validateFileFormat(file)
  if (!formatResult.valid) {
    return { success: false, error: formatResult.error, code: formatResult.code }
  }

  // Validate file size
  const sizeResult = validateFileSize(file)
  if (!sizeResult.valid) {
    return { success: false, error: sizeResult.error, code: sizeResult.code }
  }

  // Extract text based on file type
  const extension = getFileExtension(file.name.toLowerCase())

  try {
    switch (extension) {
      case '.pdf':
        return await parsePdf(file)
      case '.docx':
        return await parseDocx(file)
      case '.txt':
        return await parseTxt(file)
      default:
        return {
          success: false,
          error: 'Unsupported file format. Please upload a PDF, DOCX, or TXT file.',
          code: 'UNSUPPORTED_FORMAT',
        }
    }
  } catch {
    return {
      success: false,
      error: 'This file could not be processed. Please upload a different file or paste your resume content directly.',
      code: 'CORRUPTED_FILE',
    }
  }
}

// ── Internal Parsers ──────────────────────────────────────────────────────────

/**
 * Extracts text from a PDF file using pdfjs-dist.
 */
async function parsePdf(file: File): Promise<FileParseResult> {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const textParts: string[] = []

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const textContent = await page.getTextContent()
    const pageText = textContent.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
    textParts.push(pageText)
  }

  const text = textParts.join('\n').trim()

  if (!text) {
    return {
      success: false,
      error: 'This file could not be processed. Please upload a different file or paste your resume content directly.',
      code: 'CORRUPTED_FILE',
    }
  }

  return { success: true, text }
}

/**
 * Extracts text from a DOCX file using mammoth.
 */
async function parseDocx(file: File): Promise<FileParseResult> {
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer })
  const text = result.value.trim()

  if (!text) {
    return {
      success: false,
      error: 'This file could not be processed. Please upload a different file or paste your resume content directly.',
      code: 'CORRUPTED_FILE',
    }
  }

  return { success: true, text }
}

/**
 * Reads a TXT file as plain text using FileReader.
 */
async function parseTxt(file: File): Promise<FileParseResult> {
  const text = await file.text()
  const trimmed = text.trim()

  if (!trimmed) {
    return {
      success: false,
      error: 'This file could not be processed. Please upload a different file or paste your resume content directly.',
      code: 'CORRUPTED_FILE',
    }
  }

  return { success: true, text: trimmed }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Extracts the file extension from a filename (including the dot).
 */
function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.')
  if (lastDot === -1) return ''
  return fileName.slice(lastDot)
}
