import { useState } from 'react';

/**
 * Product thumbnail with a generated fallback — sample-data products have no
 * image, and live providers' image URLs sometimes 404 or are blocked offline.
 */
export function ProductImage({ product, className = 'h-16 w-16', rounded = 'rounded-xl' }) {
  const [failed, setFailed] = useState(false);
  const src = product?.imageUrl;

  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className={`${className} ${rounded} bg-surface-2 object-contain ring-1 ring-line`}
      />
    );
  }

  const words = String(product?.brand || product?.title || '?')
    .split(/\s+/)
    .filter(Boolean);
  const label = (
    words.length > 1 ? words.slice(0, 2).map((word) => word[0]).join('') : words[0].slice(0, 2)
  ).toUpperCase();

  return (
    <div
      className={`${className} ${rounded} flex items-center justify-center bg-surface-2 font-semibold text-ink-2 ring-1 ring-line`}
      aria-hidden="true"
    >
      <span className="text-[0.9em]">{label}</span>
    </div>
  );
}
