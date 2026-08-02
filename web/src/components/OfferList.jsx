import { useMemo } from 'react';
import { CheckIcon, ExternalIcon } from './Icons.jsx';
import { money, relativeTime } from '../lib/format.js';
import { retailerColor, retailerInitials } from '../lib/retailers.js';

/**
 * Retailer mark. The colour is the retailer's own — the same one its line uses
 * on the history chart — so the two views teach each other.
 */
function RetailerMark({ retailer, size = 'h-8 w-8 text-[11px]' }) {
  return (
    <span
      className={`${size} inline-grid shrink-0 place-items-center rounded-lg font-bold text-white`}
      style={{ background: retailerColor(retailer) }}
      aria-hidden="true"
    >
      {retailerInitials(retailer)}
    </span>
  );
}

/**
 * Price comparison, cheapest total first. Cards on phones, a table from `sm`
 * up — same data, laid out for the space.
 */
export function OfferList({ offers = [] }) {
  const sorted = useMemo(
    () =>
      [...offers].sort((a, b) => {
        if (a.inStock !== b.inStock) return a.inStock ? -1 : 1;
        return a.totalCents - b.totalCents;
      }),
    [offers],
  );

  if (sorted.length === 0) {
    return (
      <section className="card p-5 text-center text-sm text-muted">
        No retailer offers found for this product yet.
      </section>
    );
  }

  return (
    <section className="card overflow-hidden" aria-labelledby="offers-heading">
      <div className="flex items-baseline justify-between px-4 pt-4 sm:px-5">
        <h2 id="offers-heading" className="text-base font-semibold text-ink">
          Compare {sorted.length} retailers
        </h2>
        <p className="text-xs text-muted">Sorted by total price</p>
      </div>

      {/* Mobile: stacked cards */}
      <ul className="divide-y divide-line sm:hidden">
        {sorted.map((offer) => (
          <li
            key={offer.id}
            className={`p-4 ${offer.inStock ? '' : 'opacity-60'} ${
              offer.isBestDeal ? 'bg-good/6' : ''
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 gap-2.5">
                <RetailerMark retailer={offer.retailer} />
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                    {offer.retailer}
                    {offer.isBestDeal && <BestDealChip />}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-2">
                    {offer.shippingCents === 0 ? 'Free shipping' : `+${money(offer.shippingCents)} shipping`}
                    {offer.deliveryEstimate ? ` · ${offer.deliveryEstimate}` : ''}
                  </p>
                  <ConditionNote offer={offer} />
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="tabular text-lg font-bold text-ink">{money(offer.totalCents)}</p>
                <p className="tabular text-xs text-muted">{money(offer.priceCents)} + ship</p>
              </div>
            </div>
            <BuyLink offer={offer} className="mt-3 w-full" />
          </li>
        ))}
      </ul>

      {/* Tablet and up: table */}
      <div className="hidden sm:block">
        <table className="mt-3 w-full text-left text-sm">
          <thead className="border-b border-line text-xs text-muted">
            <tr>
              <th scope="col" className="px-5 py-2 font-medium">Retailer</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Item</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Shipping</th>
              <th scope="col" className="px-3 py-2 font-medium">Delivery</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Total</th>
              <th scope="col" className="px-5 py-2 text-right font-medium">
                <span className="sr-only">Buy</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {sorted.map((offer) => (
              <tr
                key={offer.id}
                className={`${offer.inStock ? '' : 'opacity-60'} ${
                  offer.isBestDeal ? 'bg-good/6' : ''
                }`}
              >
                <th scope="row" className="px-5 py-3 font-semibold text-ink">
                  <span className="flex items-center gap-2.5">
                    <RetailerMark retailer={offer.retailer} size="h-7 w-7 text-[10px]" />
                    <span className="flex flex-wrap items-center gap-2">
                      {offer.retailer}
                      {offer.isBestDeal && <BestDealChip />}
                    </span>
                  </span>
                  <ConditionNote offer={offer} />
                </th>
                <td className="tabular px-3 py-3 text-right text-ink-2">{money(offer.priceCents)}</td>
                <td className="tabular px-3 py-3 text-right text-ink-2">
                  {offer.shippingCents === 0 ? 'Free' : money(offer.shippingCents)}
                </td>
                <td className="px-3 py-3 text-xs text-ink-2">{offer.deliveryEstimate ?? '—'}</td>
                <td className="tabular px-3 py-3 text-right font-bold text-ink">
                  {money(offer.totalCents)}
                </td>
                <td className="px-5 py-3 text-right">
                  <BuyLink offer={offer} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="px-4 py-3 text-[11px] text-muted sm:px-5">
        Prices last checked {relativeTime(sorted[0]?.capturedAt)}. Buy links open the retailer's own
        site — PriceScout never handles checkout.
      </p>
    </section>
  );
}

function BestDealChip() {
  return (
    <span className="chip bg-good/12 text-good-text ring-1 ring-good/30">
      <CheckIcon className="h-3.5 w-3.5" />
      Best deal
    </span>
  );
}

function ConditionNote({ offer }) {
  const notes = [];
  if (!offer.inStock) notes.push('Out of stock');
  if (offer.condition && offer.condition !== 'new') notes.push(offer.condition);
  if (offer.isMock) notes.push('sample data');
  if (notes.length === 0) return null;
  return <p className="mt-0.5 text-[11px] font-normal text-muted capitalize">{notes.join(' · ')}</p>;
}

function BuyLink({ offer, className = '' }) {
  if (!offer.url) {
    return <span className={`text-xs text-muted ${className}`}>No link</span>;
  }
  return (
    <a
      href={offer.url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className={`btn-secondary px-3 py-2 text-xs ${className}`}
    >
      Buy at {offer.retailer}
      <ExternalIcon className="h-3.5 w-3.5" />
    </a>
  );
}
