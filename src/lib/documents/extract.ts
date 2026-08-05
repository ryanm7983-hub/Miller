import 'server-only';

import mammoth from 'mammoth';

import { runOcr, ocrAvailable } from './ocr';
import type { ExtractionStatus } from '@/lib/enums';

export interface ExtractionResult {
  text: string;
  status: ExtractionStatus;
  note?: string;
  pageCount?: number;
  ocrUsed: boolean;
}

const MAX_TEXT_CHARS = 400_000;

function truncate(text: string): string {
  const clean = text
    // Strip control characters that survive some PDF and OCR extractions.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
  return clean.length > MAX_TEXT_CHARS ? `${clean.slice(0, MAX_TEXT_CHARS)}\n…[truncated]` : clean;
}

async function extractPdf(buffer: Buffer): Promise<ExtractionResult> {
  try {
    const { extractText, getDocumentProxy } = await import('unpdf');
    const doc = await getDocumentProxy(new Uint8Array(buffer));
    const { text, totalPages } = await extractText(doc, { mergePages: true });
    const merged = Array.isArray(text) ? text.join('\n') : text;

    if (merged.trim().length < 40) {
      return {
        text: truncate(merged),
        status: 'PARTIAL',
        pageCount: totalPages,
        ocrUsed: false,
        note: ocrAvailable()
          ? 'This PDF contains little machine-readable text. It appears to be a scan — page-image OCR is not applied to PDFs in this build.'
          : 'This PDF contains little machine-readable text (likely a scan). Enable OCR_ENABLED, or upload a text-based PDF, for full analysis.',
      };
    }

    return { text: truncate(merged), status: 'COMPLETE', pageCount: totalPages, ocrUsed: false };
  } catch (error) {
    return {
      text: '',
      status: 'FAILED',
      ocrUsed: false,
      note: `Could not read the PDF: ${(error as Error).message}`,
    };
  }
}

async function extractDocx(buffer: Buffer): Promise<ExtractionResult> {
  try {
    const { value, messages } = await mammoth.extractRawText({ buffer });
    const warnings = messages.filter((m) => m.type === 'warning').length;
    return {
      text: truncate(value),
      status: value.trim().length > 0 ? 'COMPLETE' : 'PARTIAL',
      ocrUsed: false,
      note: warnings > 0 ? `${warnings} formatting element(s) could not be converted to text.` : undefined,
    };
  } catch (error) {
    return { text: '', status: 'FAILED', ocrUsed: false, note: (error as Error).message };
  }
}

async function extractXlsx(buffer: Buffer): Promise<ExtractionResult> {
  try {
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

    const parts: string[] = [];
    workbook.eachSheet((sheet) => {
      parts.push(`## Sheet: ${sheet.name}`);
      sheet.eachRow({ includeEmpty: false }, (row) => {
        const cells: string[] = [];
        row.eachCell({ includeEmpty: true }, (cell) => {
          const value = cell.value;
          if (value === null || value === undefined) {
            cells.push('');
          } else if (value instanceof Date) {
            cells.push(value.toISOString().slice(0, 10));
          } else if (typeof value === 'object' && 'text' in value) {
            cells.push(String((value as { text: unknown }).text ?? ''));
          } else if (typeof value === 'object' && 'result' in value) {
            cells.push(String((value as { result: unknown }).result ?? ''));
          } else {
            cells.push(String(value));
          }
        });
        if (cells.some((c) => c.trim().length > 0)) parts.push(cells.join(' | '));
      });
    });

    const text = parts.join('\n');
    return {
      text: truncate(text),
      status: text.trim().length > 0 ? 'COMPLETE' : 'PARTIAL',
      pageCount: workbook.worksheets.length,
      ocrUsed: false,
    };
  } catch (error) {
    return {
      text: '',
      status: 'FAILED',
      ocrUsed: false,
      note: `Could not read the spreadsheet: ${(error as Error).message}`,
    };
  }
}

function extractText(buffer: Buffer): ExtractionResult {
  return { text: truncate(buffer.toString('utf8')), status: 'COMPLETE', ocrUsed: false };
}

function extractCsv(buffer: Buffer): ExtractionResult {
  // CSV is already text; normalising separators makes the AI layer's job easier
  // and keeps the searchable representation readable in the UI.
  const raw = buffer.toString('utf8');
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const normalised = lines.map((line) => line.split(',').map((c) => c.trim().replace(/^"|"$/g, '')).join(' | '));
  return { text: truncate(normalised.join('\n')), status: 'COMPLETE', ocrUsed: false };
}

async function extractImage(buffer: Buffer, mimeType: string): Promise<ExtractionResult> {
  const ocr = await runOcr(buffer, mimeType);
  if (!ocr) {
    return {
      text: '',
      status: 'UNSUPPORTED',
      ocrUsed: false,
      note: ocrAvailable()
        ? 'OCR did not return any readable text from this image.'
        : 'Images require OCR to be analysed. Set OCR_ENABLED=true and install tesseract.js, or add a text description in the notes field.',
    };
  }
  return {
    text: truncate(ocr.text),
    status: ocr.text.trim().length > 20 ? 'COMPLETE' : 'PARTIAL',
    ocrUsed: true,
    note: `Text recovered by OCR (${ocr.engine}, ${(ocr.confidence * 100).toFixed(0)}% engine confidence). Verify accuracy before relying on it.`,
  };
}

/**
 * Produces the searchable text representation of an uploaded document.
 * Never throws — failures are reported through `status` + `note` so the
 * evidence record still exists and remains manageable by a human.
 */
export async function extractDocumentText(buffer: Buffer, mimeType: string): Promise<ExtractionResult> {
  switch (mimeType) {
    case 'application/pdf':
      return extractPdf(buffer);
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return extractDocx(buffer);
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    case 'application/vnd.ms-excel':
      return extractXlsx(buffer);
    case 'text/csv':
      return extractCsv(buffer);
    case 'text/plain':
      return extractText(buffer);
    case 'image/jpeg':
    case 'image/png':
      return extractImage(buffer, mimeType);
    default:
      return {
        text: '',
        status: 'UNSUPPORTED',
        ocrUsed: false,
        note: `No text extractor is registered for ${mimeType}.`,
      };
  }
}

/** Heuristic date finder used for freshness and consistency gap detection. */
export interface FoundDate {
  raw: string;
  iso: string;
  context: string;
}

const DATE_PATTERNS: Array<{ re: RegExp; parse: (m: RegExpMatchArray) => Date | null }> = [
  {
    re: /\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/g,
    parse: (m) => safeDate(Number(m[1]), Number(m[2]), Number(m[3])),
  },
  {
    re: /\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/g,
    parse: (m) => safeDate(Number(m[3]), Number(m[1]), Number(m[2])),
  },
  {
    re: /\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(20\d{2})\b/gi,
    parse: (m) => safeDate(Number(m[3]), monthIndex(m[2]), Number(m[1])),
  },
  {
    re: /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2}),?\s+(20\d{2})\b/gi,
    parse: (m) => safeDate(Number(m[3]), monthIndex(m[1]), Number(m[2])),
  },
];

function monthIndex(name: string): number {
  return (
    ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(
      name.slice(0, 3).toLowerCase()
    ) + 1
  );
}

function safeDate(year: number, month: number, day: number): Date | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function findDates(text: string, limit = 40): FoundDate[] {
  const found: FoundDate[] = [];
  const seen = new Set<string>();

  for (const { re, parse } of DATE_PATTERNS) {
    for (const match of text.matchAll(re)) {
      const date = parse(match);
      if (!date) continue;
      const iso = date.toISOString().slice(0, 10);
      const key = `${iso}:${match.index}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const start = Math.max(0, (match.index ?? 0) - 60);
      found.push({
        raw: match[0],
        iso,
        context: text.slice(start, (match.index ?? 0) + match[0].length + 40).replace(/\s+/g, ' ').trim(),
      });
      if (found.length >= limit) return found;
    }
  }
  return found;
}
