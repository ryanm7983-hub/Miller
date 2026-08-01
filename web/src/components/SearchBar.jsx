import { useRef, useState } from 'react';
import { CameraIcon, SearchIcon, Spinner } from './Icons.jsx';
import { decodeBarcodeFromFile } from '../lib/barcode.js';

/**
 * One input for all three entry points: a product name, a pasted retailer URL,
 * or a barcode photo. The server classifies the string, so the client only has
 * to turn an image into digits.
 */
export function SearchBar({ value, onChange, onSearch, busy = false, autoFocus = false }) {
  const fileRef = useRef(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState(null);

  async function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setScanError(null);
    setScanning(true);
    try {
      const code = await decodeBarcodeFromFile(file);
      onChange(code);
      onSearch(code);
    } catch (error) {
      setScanError(error.message);
    } finally {
      setScanning(false);
    }
  }

  return (
    <div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSearch(value);
        }}
        className="flex items-center gap-2"
        role="search"
      >
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 h-5 w-5 -translate-y-1/2 text-muted" />
          <input
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoFocus={autoFocus}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Product name, link, or barcode"
            aria-label="Search for a product by name, link or barcode"
            className="field pl-11"
          />
        </div>

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="btn-secondary shrink-0 px-3"
          aria-label="Scan or upload a barcode photo"
          disabled={scanning}
        >
          {scanning ? <Spinner className="h-5 w-5" /> : <CameraIcon />}
        </button>

        <button type="submit" className="btn-primary shrink-0" disabled={busy || !value.trim()}>
          {busy ? <Spinner className="h-5 w-5" /> : 'Search'}
        </button>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFile}
        />
      </form>

      {scanError && (
        <p role="alert" className="mt-2 text-sm text-critical">
          {scanError}
        </p>
      )}
    </div>
  );
}
