import 'server-only';

import { env } from '@/lib/env';

export interface OcrResult {
  text: string;
  confidence: number;
  engine: string;
}

/**
 * OCR abstraction for scanned PDFs and photographed records.
 *
 * `tesseract.js` is an optional dependency: when OCR_ENABLED is false, or the
 * package is not installed, extraction degrades gracefully and the evidence
 * record is marked `PARTIAL` with an explanatory note rather than failing.
 * Swap this module's `runOcr` body for AWS Textract / Google Document AI to
 * upgrade quality without touching any caller.
 */
export async function runOcr(image: Buffer, mimeType: string): Promise<OcrResult | null> {
  if (!env.ocrEnabled) return null;
  if (!mimeType.startsWith('image/')) return null;

  try {
    // Dynamic import keeps the (large) OCR engine out of the default bundle and
    // out of the install path for deployments that do not need it. The
    // specifier is built at runtime so the bundler leaves it alone and the
    // build does not require the optional package to be installed.
    const specifier = ['tesseract', 'js'].join('.');
    const mod: unknown = await import(/* webpackIgnore: true */ specifier).catch(() => null);
    if (!mod) return null;

    const { recognize } = mod as {
      recognize: (
        img: Buffer,
        langs: string,
        opts?: Record<string, unknown>
      ) => Promise<{ data: { text: string; confidence: number } }>;
    };

    const { data } = await recognize(image, 'eng');
    return {
      text: (data.text ?? '').trim(),
      confidence: Math.max(0, Math.min(1, (data.confidence ?? 0) / 100)),
      engine: 'tesseract.js',
    };
  } catch (error) {
    console.error('[ocr] recognition failed', error);
    return null;
  }
}

export function ocrAvailable(): boolean {
  return env.ocrEnabled;
}
