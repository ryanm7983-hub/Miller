import { useMemo } from 'react';
import { Check, ExternalLink } from 'lucide-react';
import { Card, Badge } from './ui/Primitives.jsx';
import { ButtonLink } from './ui/Button.jsx';
import { money, relativeTime } from '../lib/format.js';
import { retailerColor, retailerInitials } from '../lib/retailers.js';

/**
 * Retailer mark. The colour is the retailer's own — the same one its line uses
 * on the history chart — so the two views teach each other.
 */
function RetailerMark({ retailer, className = 'h-8 w-8 text-[11px]' }) {
  return (
    <span
      className={`${className} inline-grid shrink-0 place-items-center rounded-lg font-bold text-white`}
      style={{ background: retailerColor(retailer) }}
      aria-hidden="true"
    >
      {retailerInitials(retailer)}
    </span>
  );
}

function ConditionNote({ offer }) {
  const notes = [];
  if (!offer.inStock) notes.push('Out of stock');
  if (offer.condition && offer.condition !== 'new') notes.push(offer.condition);
  if (offer.isMock) notes.push('sample data');
  if (notes.length === 0) return null;
  return <p className="text-help mt-0.5 text-muted capitalize">{notes.join(' · ')}</p>;
}

function BuyLink({ offer, className = '', size = 'sm' }) {
  if (!offer.url) return <span className="text-help text-muted">No link</span>;
  return (
    <ButtonLink
      href={offer.url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      variant={offer.isBestDeal ? 'primary' : 'secondary'}
      size={size}
      className={className}
    >
      Buy at {offer.retailer}
      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
    </ButtonLink>
  );
}

/**
 * Price comparison, cheapest total first. Cards on phones, a table from `sm`
 * up — same data, laid out for the space it has.
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
      <Card className="p-6 text-center">
        <p className="text-[13px] text-muted">No retailer offers found for this product yet.</p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden" aria-labelledby="offers-heading">
      <div className="flex items-baseline justify-between gap-3 px-4 pt-4 sm:px-5">
        <h2 id="offers-heading" className="text-section text-ink">
          Compare {sorted.length} retailers
        </h2>
        <p className="text-help text-muted">Sorted by total price</p>
      </div>

      {/* Phones: stacked cards */}
      <ul className="mt-3 divide-y divide-border sm:hidden">
        {sorted.map((offer) => (
          <li
            key={offer.id}
            className={`p-4 ${offer.inStock ? '' : 'opacity-60'} ${
              offer.isBestDeal ? 'bg-success-wash' : ''
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 gap-2.5">
                <RetailerMark retailer={offer.retailer} />
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-[14px] font-semibold text-ink">
                    {offer.retailer}
                    {offer.isBestDeal && (
                      <Badge tone="success" icon={Check}>
                        Best deal
                      </Badge>
                    )}
                  </p>
                  <p className="text-help mt-0.5 text-ink-2">
                    {offer.shippingCents === 0
                      ? 'Free shipping'
                      : `+${money(offer.shippingCents)} shipping`}
                    {offer.deliveryEstimate ? ` · ${offer.deliveryEstimate}` : ''}
                  </p>
                  <ConditionNote offer={offer} />
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="tabular text-[17px] leading-tight font-bold text-ink">
                  {money(offer.totalCents)}
                </p>
                <p className="text-help tabular text-muted">{money(offer.priceCents)} + ship</p>
              </div>
            </div>
            <BuyLink offer={offer} size="md" className="mt-3 w-full" />
          </li>
        ))}
      </ul>

      {/* Tablet and up: table. The scroll wrapper is a safety net for very
          narrow columns — the page gives this card full width. */}
      <div className="scroll-area hidden overflow-x-auto sm:block">
        <table className="mt-3 w-full min-w-[640px] text-left">
          <thead className="border-b border-border bg-surface-2/60">
            <tr className="text-label text-muted">
              <th scope="col" className="px-5 py-2.5 font-semibold">Retailer</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">Item</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">Shipping</th>
              <th scope="col" className="px-3 py-2.5 font-semibold">Delivery</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">Total</th>
              <th scope="col" className="px-5 py-2.5 text-right font-semibold">
                <span className="sr-only">Buy</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.map((offer) => (
              <tr
                key={offer.id}
                className={`transition-colors ${offer.inStock ? '' : 'opacity-60'} ${
                  offer.isBestDeal ? 'bg-success-wash' : 'hover:bg-surface-2'
                }`}
              >
                <th scope="row" className="px-5 py-3 font-normal">
                  <span className="flex items-center gap-2.5">
                    <RetailerMark retailer={offer.retailer} className="h-7 w-7 text-[10px]" />
                    <span className="flex flex-wrap items-center gap-2 text-[13.5px] font-semibold text-ink">
                      {offer.retailer}
                      {offer.isBestDeal && (
                        <Badge tone="success" icon={Check}>
                          Best deal
                        </Badge>
                      )}
                    </span>
                  </span>
                  <ConditionNote offer={offer} />
                </th>
                <td className="tabular px-3 py-3 text-right text-[13px] text-ink-2">
                  {money(offer.priceCents)}
                </td>
                <td className="tabular px-3 py-3 text-right text-[13px] text-ink-2">
                  {offer.shippingCents === 0 ? 'Free' : money(offer.shippingCents)}
                </td>
                <td className="text-help px-3 py-3 text-ink-2">{offer.deliveryEstimate ?? '—'}</td>
                <td className="tabular px-3 py-3 text-right text-[14px] font-bold text-ink">
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

      <p className="text-help border-t border-border px-4 py-3 text-muted sm:px-5">
        Prices last checked {relativeTime(sorted[0]?.capturedAt)}. Buy links open the retailer's own
        site — PriceScout never handles checkout.
      </p>
    </Card>
  );
}
