import { useEffect, useState } from 'react';
import { productArtSvg } from '../lib/productArt.js';

/**
 * The image itself, with no chrome: the real photograph a live provider
 * returned, falling back to a drawn illustration of that kind of product when
 * there is no photo (sample data) or the photo fails to load.
 */
function ImageOrArt({ product, priority = false, padding = 'p-[6%]' }) {
  const src = product?.imageUrl ?? null;
  const [state, setState] = useState(src ? 'loading' : 'none');

  useEffect(() => {
    setState(src ? 'loading' : 'none');
  }, [src]);

  if (!src || state === 'error') {
    // The SVG carries a viewBox but no width/height, so it is sized here and
    // letterboxed by preserveAspectRatio rather than overflowing its box.
    return (
      <div
        className={`h-full w-full ${padding} [&>svg]:h-full [&>svg]:w-full`}
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: productArtSvg(product ?? {}) }}
      />
    );
  }

  return (
    <>
      {state === 'loading' && (
        <div className="absolute inset-0 animate-pulse bg-line/60" aria-hidden="true" />
      )}
      <img
        src={src}
        alt=""
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        // Retailer and Google thumbnail CDNs commonly 403 a cross-site referrer.
        referrerPolicy="no-referrer"
        onLoad={() => setState('loaded')}
        onError={() => setState('error')}
        className={`relative h-full w-full object-contain ${padding} transition-opacity duration-200 ${
          state === 'loaded' ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </>
  );
}

/**
 * Thumbnail. Photos sit on a light tile in both themes — retailer photography
 * is shot on white, so a dark tile would frame every product in a bright box.
 */
export function ProductImage({ product, className = 'h-16 w-16', rounded = 'rounded-xl' }) {
  return (
    <div className={`${className} ${rounded} relative overflow-hidden bg-[#f4f3f0] ring-1 ring-line`}>
      <ImageOrArt product={product} padding="p-[8%]" />
    </div>
  );
}

/**
 * The product page hero: larger, on a soft plinth with a grounding shadow so it
 * reads as an object rather than a floating cutout.
 */
export function ProductHero({ product, className = '' }) {
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden rounded-2xl ring-1 ring-line ${className}`}
      style={{
        background:
          'radial-gradient(120% 90% at 50% 0%, #ffffff 0%, #f5f4f1 55%, #e8e6e1 100%)',
      }}
    >
      <div
        className="pointer-events-none absolute bottom-[11%] left-1/2 h-3 w-[46%] -translate-x-1/2 rounded-[50%] bg-black/15 blur-md"
        aria-hidden="true"
      />
      <div className="relative h-[82%] w-[82%]">
        <ImageOrArt product={product} priority padding="p-0" />
      </div>
    </div>
  );
}
