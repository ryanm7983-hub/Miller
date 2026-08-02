# Deploying PriceScout

The app ships as **one container**: the Node API serves the built PWA from the same origin, so
there's one URL, no CORS, and one thing to deploy.

```
┌─ pricescout ────────────────────────────┐
│  GET /              → the PWA (web/dist)│
│  GET /api/*         → the API           │
│  cron (in-process)  → price refresh      │
│  /data/pricescout.db → SQLite on a disk │
└─────────────────────────────────────────┘
```

Two things only you can supply: a **provider API key** (for live prices) and a **hosting account**.
Everything else is committed.

---

## 1. Get a data source key

Without one, the app runs on clearly-labelled sample data — fine for a first deploy, but the prices
aren't real.

**[SerpApi](https://serpapi.com/users/sign_up)** is the one to start with — it covers every retailer
Google Shopping indexes, from one key.

1. Sign up, copy the key from your dashboard.
2. That's it. `PRICE_PROVIDERS=serpapi` + `SERPAPI_KEY=…` is the whole configuration.

Optional: **[Rainforest](https://www.rainforestapi.com/)** for a more accurate Amazon buybox price.
Set `PRICE_PROVIDERS=serpapi,rainforest` and `RAINFOREST_API_KEY=…`; the results merge automatically.

### Budgeting your quota

Every price check is one API call per provider. SerpApi's free tier is ~100 searches/month, so the
refresh schedule matters more than anything else:

| `PRICE_REFRESH_CRON` | Calls per tracked product / month | Products on a 100-call tier |
|---|---|---|
| `0 */6 * * *` (4×/day) | ~120 | under 1 |
| `0 7 * * *` (daily) | ~30 | ~3 |
| `0 7 * * 1` (weekly) | ~4 | ~25 |

The committed configs default to **daily** with `PRICE_REFRESH_BATCH=25`. Searches performed by
users also cost a call each, and `RATE_LIMIT_SEARCH` (default 20/min per IP) caps runaway clients.
On a paid SerpApi plan, move to `0 */6 * * *` for tighter history.

---

## 2. Pick a host

SQLite needs a **persistent disk** and the cron job needs the process to **stay awake** — that rules
out most free tiers and all serverless platforms. Both configs below account for this.

### Option A — Render (simplest)

[`render.yaml`](render.yaml) is a complete blueprint.

1. Push this repo to GitHub.
2. Render dashboard → **New → Blueprint** → select the repo.
3. Render reads the blueprint, builds the Dockerfile and attaches a 1 GB disk at `/data`.
4. It prompts for the values marked `sync: false` — paste `SERPAPI_KEY`, and set `APP_URL` to the
   URL Render assigns you (e.g. `https://pricescout.onrender.com`).
5. Deploy. `JWT_SECRET` is generated for you.

Needs the **Starter** instance type or above — disks aren't available on free, and free instances
sleep, which stops the price checks.

### Option B — Fly.io

[`fly.toml`](fly.toml) is committed. Edit the `app` name first, then:

```bash
fly launch --no-deploy --copy-config
fly volumes create pricescout_data --size 1
fly secrets set JWT_SECRET=$(openssl rand -hex 32) SERPAPI_KEY=your-key-here
fly deploy
```

`auto_stop_machines = "off"` and `min_machines_running = 1` are deliberate — a stopped machine runs
no cron. Keep it to **one** machine: a second would get its own copy of the SQLite file.

### Option C — Any Docker host (VPS, Cloud Run with a volume, your NAS)

```bash
docker build -t pricescout .
docker run -d --name pricescout -p 80:4000 \
  -v pricescout-data:/data \
  -e JWT_SECRET="$(openssl rand -hex 32)" \
  -e PRICE_PROVIDERS=serpapi \
  -e SERPAPI_KEY=your-key-here \
  -e APP_URL=https://yourdomain.com \
  --restart unless-stopped \
  pricescout
```

Put it behind a TLS terminator (Caddy, nginx, Cloudflare Tunnel). The image runs as a non-root user
and has a health check on `/api/health`.

### Option D — No container, just a box

```bash
npm ci
npm run build
NODE_ENV=production JWT_SECRET=… PRICE_PROVIDERS=serpapi SERPAPI_KEY=… npm start
```

`SERVE_STATIC` defaults on when `NODE_ENV=production`. Run it under systemd or pm2 so it restarts.

---

## 3. Verify it's actually live

```bash
curl https://your-app.example.com/api/health
```

```jsonc
{
  "ok": true,
  "usingMockData": false,                      // ← false means real prices
  "providers": [{ "name": "serpapi", "live": true, … }]
}
```

If `usingMockData` is `true`, the key didn't land — the server logs
`[providers] "serpapi" is enabled but not configured` at boot and falls back to sample data rather
than erroring. The app also shows a sample-data banner on every screen, so you'll see it in the UI.

Then search for something real. Prices, retailer names and buy links should be genuine; the price
history chart starts empty and fills in from the first search onward.

To force a price check without waiting for cron:

```bash
docker exec pricescout node server/src/scripts/refresh-once.js   # or: npm run refresh
```

---

## 4. Optional: email alerts

In-app notifications work with no configuration. For email, add a [Resend](https://resend.com) key:

```
RESEND_API_KEY=re_…
MAIL_FROM=PriceScout <alerts@yourdomain.com>
APP_URL=https://your-app.example.com
```

`MAIL_FROM` must be on a domain you've verified with Resend. Users opt in per tracked product.

---

## Operational notes

- **Back up `/data/pricescout.db`.** It holds every price observation — the one thing you can't
  re-fetch, since no API sells price history. `sqlite3 pricescout.db ".backup /backup/ps.db"` on a
  schedule is enough.
- **One instance.** SQLite plus an in-process cron means horizontal scaling needs Postgres and a
  real queue first. Only `server/src/db/index.js` opens the connection.
- **First deploy is empty.** Optionally seed the sample catalog to have something to look at:
  `docker exec pricescout node server/src/scripts/seed.js` — remember it writes sample data marked
  `mock`, which will sit alongside your live data.
- **Cost ceiling.** `PRICE_REFRESH_BATCH` caps products re-quoted per run and `MIN_REFRESH_MINUTES`
  stops repeat quotes; between them a large watchlist can't run away with your quota.
