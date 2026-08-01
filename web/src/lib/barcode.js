/**
 * Barcode decoding for uploaded/camera images.
 *
 * Prefers the native `BarcodeDetector` (Chrome, Android) and falls back to
 * ZXing, which is loaded lazily so the ~200 kB decoder never lands in the
 * initial bundle.
 */
const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf'];

async function decodeNative(bitmapSource) {
  if (typeof window === 'undefined' || !('BarcodeDetector' in window)) return null;
  try {
    const supported = await window.BarcodeDetector.getSupportedFormats();
    const formats = FORMATS.filter((f) => supported.includes(f));
    if (formats.length === 0) return null;
    const detector = new window.BarcodeDetector({ formats });
    const results = await detector.detect(bitmapSource);
    return results?.[0]?.rawValue ?? null;
  } catch {
    return null;
  }
}

async function decodeZxing(objectUrl) {
  const { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } = await import('@zxing/library');
  const hints = new Map([
    [
      DecodeHintType.POSSIBLE_FORMATS,
      [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.ITF,
      ],
    ],
    [DecodeHintType.TRY_HARDER, true],
  ]);
  const reader = new BrowserMultiFormatReader(hints);
  try {
    const result = await reader.decodeFromImageUrl(objectUrl);
    return result?.getText() ?? null;
  } finally {
    reader.reset?.();
  }
}

/**
 * @param {File} file An image of a barcode.
 * @returns {Promise<string>} The decoded digits.
 * @throws when nothing could be decoded.
 */
export async function decodeBarcodeFromFile(file) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);

    const native = await decodeNative(image);
    if (native) return native.replace(/\D/g, '') || native;

    const zxing = await decodeZxing(objectUrl);
    if (zxing) return zxing.replace(/\D/g, '') || zxing;

    throw new Error(
      "Couldn't read a barcode in that image. Try a straight-on, well-lit photo — or type the number in.",
    );
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('That file could not be opened as an image.'));
    image.src = src;
  });
}
