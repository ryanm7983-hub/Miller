# PriceScout

Search any product, compare prices across retailers, watch its price history, and get told when it
drops to your price.

- **Frontend** — React 19 + Tailwind v4, mobile-first, installable PWA with an offline shell
- **Backend** — Node/Express API with a swappable `PriceProvider` layer
- **Database** — SQLite (integer cents, append-only price snapshots)
- **Jobs** — cron-scheduled price refresh that appends history and fires alerts
- **Auth** — email + password (JWT), so a watchlist follows you across devices
- **Notifications** — in-app notification centre, optional email via Resend

> ### ⚠️ Out of the box, every price you see is fabricated
> The default provider is `mock`: a deterministic sample-data generator, including a year of
> back-filled price history so the charts have something to draw. It is labelled as sample data in
> the UI (banner, per-row `sample data` badges, `isMock` in every API response) and never mixed
> silently with live numbers. See [Data sources](#data-sources) to switch on real prices.

## Quick start

```bash
git clone <this repo> && cd Miller
npm install                       # installs both workspaces

cp server/.env.example server/.env   # defaults run entirely on sample data
npm run seed                      # 12 sample products, ~21k price snapshots, a demo account
npm run dev                       # API on :4000, web on :5173
```

Open http://localhost:5173 and sign in as `demo@pricescout.app` / `demo1234`.

| Command | What it does |
|---|---|
| `npm run dev` | API + web dev server together |
| `npm run seed` | Reset-safe sample catalog, history and demo user |
| `npm test` | 33 server tests (providers, pricing math, alert rules, HTTP flow) |
| `npm run build` | Production build of the PWA into `web/dist` |
| `npm run refresh --workspace server` | Run the scheduled price check once, now |

## What's built

Staged as requested — each stage works on its own.

1. **Single-product price comparison.** Search by name, pasted retailer URL, or a barcode photo.
   Matches normalize onto one tracked product id, offers sort by **total** (item + shipping), and
   the cheapest in-stock listing is flagged **Best deal**. Shipping, delivery estimate, condition
   and stock status are shown per row; buy links go straight out to the retailer.
2. **Price history.** 30 / 90 / 365-day line chart — blended best price by default, with a
   per-retailer breakdown, a data-table view, min/max/average, all-time-low detection and a
   "dropped X% this week" indicator.
3. **Tracking + scheduled checks.** Save a product with a target price; a cron job re-quotes tracked
   products, appends snapshots and evaluates alerts.
4. **Alerts.** In-app notification centre with unread badges; optional email per watch.
5. **PWA.** Installable, offline shell, cached API reads for pages already visited.

## Data sources

Everything that touches the outside world implements
[`PriceProvider`](server/src/providers/PriceProvider.js). Pick providers with one env var — they are
queried in parallel and their results merged (matched on UPC, else brand+model, else a normalized
title), keeping the cheapest offer per retailer.

```bash
PRICE_PROVIDERS=mock                # default: sample data, no keys
PRICE_PROVIDERS=serpapi             # live Google Shopping results
PRICE_PROVIDERS=serpapi,rainforest  # …plus a better Amazon price
```

| Provider | Data | Key needed | Notes |
|---|---|---|---|
| [`mock`](server/src/providers/MockProvider.js) | **Sample data** | none | Deterministic. The only provider that can back-fill history. |
| [`serpapi`](server/src/providers/SerpApiProvider.js) | Live, multi-retailer | `SERPAPI_KEY` | [SerpApi](https://serpapi.com/google-shopping-api) Google Shopping + Google Product engines. Paid, small free tier. |
| [`rainforest`](server/src/providers/RainforestProvider.js) | Live, Amazon only | `RAINFOREST_API_KEY` | [Rainforest API](https://www.rainforestapi.com/). Paid. Contributes an Amazon row to the merge. |

A provider that is enabled but missing its key is skipped with a warning rather than crashing, and
if none is usable the server falls back to sample data. Provider failures degrade — one source
timing out doesn't fail the request; the error is returned in `errors[]` and surfaced as-is.

### On retailer terms of service

**No scraping is used anywhere in this codebase.** Both live providers are commercial APIs that
carry their own agreements, and every listing links out to the retailer's own page — PriceScout
never proxies checkout or re-hosts retailer content. The interface has a `capabilities.scraping`
flag so that *if* you ever add a source that scrapes HTML, the app labels it in the UI and in
`/api/search/providers` instead of hiding it. Before adding one, check that retailer's ToS and
robots.txt; several explicitly forbid it, and most have an affiliate feed (Amazon PA-API, Walmart
I/O, eBay Browse API, Best Buy Developer API) that is the better route.

### Adding a provider

```js
// server/src/providers/MyProvider.js
import { PriceProvider, normalizeOffer, parsePriceToCents } from './PriceProvider.js';

export class MyProvider extends PriceProvider {
  static providerName = 'mysource';
  get label() { return 'My Source'; }
  get capabilities() {
    return { searchByText: true, searchByUrl: false, searchByBarcode: true, offers: true, live: true };
  }
  isConfigured() { return Boolean(process.env.MY_API_KEY); }

  async searchByText(query, { limit }) { /* → ProductMatch[] */ }
  async getOffers(product, ref)        { /* → Offer[]        */ }
}
```

Register it in [`server/src/providers/index.js`](server/src/providers/index.js) and add its name to
`PRICE_PROVIDERS`. Money is always integer cents; return `[]` rather than throwing when there are no
results, and throw `ProviderError` for auth/quota/transport failures.

## Configuration

All server config lives in `server/.env` ([full list with comments](server/.env.example)):

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `4000` | API port |
| `DATABASE_FILE` | `data/pricescout.db` | SQLite file, relative to `server/` |
| `JWT_SECRET` | dev placeholder | **Required** in production; the server refuses to boot otherwise |
| `CORS_ORIGIN` | `http://localhost:5173` | Comma-separated allowed origins |
| `PRICE_PROVIDERS` | `mock` | Active data sources, in priority order |
| `SERPAPI_KEY` / `RAINFOREST_API_KEY` | — | Live provider keys |
| `ENABLE_CRON` | `true` | Turn the scheduled refresh off |
| `PRICE_REFRESH_CRON` | `0 */6 * * *` | Standard 5-field cron |
| `PRICE_REFRESH_BATCH` | `50` | Max products re-quoted per run — caps paid API spend |
| `MIN_REFRESH_MINUTES` | `60` | Won't re-quote a product more often than this |
| `RESEND_API_KEY` | — | Optional; without it, alerts are in-app only |
| `MAIL_FROM`, `APP_URL` | — | Sender identity and link base for alert emails |

The web app talks to `/api` and Vite proxies that to the API in dev. For a split deployment, set
`VITE_API_URL=https://api.example.com` at build time.

## How it works

### Price history without a history API

No affordable API sells historical prices, so PriceScout builds its own: **every observation is
appended**. Searching a product records a snapshot, opening its page records one if the last is
stale, and the cron job records one per tracked product per run. Current price = the most recent
snapshot per retailer; the chart = the daily minimum per retailer over the window.

That means **history starts when you start looking**. To keep the demo honest, the mock provider
back-fills a year of sample snapshots marked `synthetic = 1`, and the API reports
`history.containsSyntheticData` so the UI can say so.

### Alerts

On each refresh, every active watch is evaluated in priority order — target reached → new all-time
low → below its average (needs ≥5 data points and a ≥2% gap). To avoid nagging, an alert re-fires
only if the price improves on the last alerted price, or after 7 days.

### Data model

```
users ──< watches >── products ──< price_snapshots
                        │
                        └──< product_sources   (per-provider id, for cheap re-quotes)
notifications ──> users, products, watches
```

Recently-viewed items and search history are deliberately client-side (`localStorage`): they are
per-device conveniences that work offline and need no account. The watchlist is server-side because
it has to follow the user.

## API

| Method | Path | Auth | |
|---|---|---|---|
| `GET` | `/api/health` | — | Status + active providers |
| `GET` | `/api/search?q=` | optional | Text, URL or barcode — the server classifies it |
| `GET` | `/api/search/providers` | — | Which sources are live vs sample |
| `GET` | `/api/products/:id?days=` | optional | Product, offers, stats, history, your watch |
| `GET` | `/api/products/:id/history?days=30\|90\|365` | — | Chart series + stats |
| `POST` | `/api/products/:id/refresh` | — | Force a re-quote now |
| `POST` | `/api/auth/register` · `/login` · `GET /me` | — / — / ✔ | JWT auth |
| `GET` `POST` | `/api/watchlist` | ✔ | List / start tracking |
| `PATCH` `DELETE` | `/api/watchlist/:id` | ✔ | Change target / stop tracking |
| `GET` | `/api/notifications` | ✔ | Notification centre + unread count |
| `POST` | `/api/notifications/:id/read` · `/read-all` | ✔ | Mark read |

## Design notes

The price chart follows a validated categorical palette (eight fixed slots, colourblind-checked in
both light and dark surfaces). Colour follows the *retailer*, never its rank, so switching the date
range never repaints the series; a legend is always present for ≥2 series, thresholds are keyed
below the plot rather than labelled inline, and a data-table view is available for anyone who
can't rely on colour. Icons pair with every status colour, so nothing means one thing by hue alone.

## Deploying

```bash
npm run build                                  # → web/dist (static)
NODE_ENV=production JWT_SECRET=… npm start     # API + cron
```

Serve `web/dist` from any static host and point it at the API. The SQLite file needs a persistent
volume; for multi-instance deployments, move to Postgres — the queries in
[`server/src/services/prices.js`](server/src/services/prices.js) are standard SQL apart from
SQLite's `datetime()`, and only [`server/src/db/index.js`](server/src/db/index.js) opens the
connection.

## Known limitations

- **History depth with live providers** builds from first use; only sample data is back-filled.
- **Product matching** is UPC → brand+model → normalized title. Google Shopping rarely returns UPCs,
  so distinct-but-similar listings can occasionally merge. A tighter matcher (embedding or GTIN
  lookup) is the natural next step.
- **SQLite + in-process cron** suits a single instance. At scale, move to Postgres and a real queue.
- **Email is fire-and-forget** — no retry queue, no bounce handling, no unsubscribe link yet.
- **No affiliate tagging.** Buy links are plain outbound links; adding affiliate parameters is a
  per-retailer decision with its own program terms.
