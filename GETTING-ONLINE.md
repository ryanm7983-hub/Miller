# Getting PriceScout online — the cheap way

A step-by-step guide to putting this app on the internet, from **completely free** to about
**$7/month**, depending on how much fiddling you want to do.

Read the first section, pick a path, then follow only that path.

> **A note on prices.** Hosting pricing changes constantly. Every figure below was accurate when
> this was written; check the provider's own pricing page before you commit. Nothing here needs a
> long-term contract — you can move between these options in an afternoon.

---

## What this app actually needs

Three things, and they rule out a lot of "free tier" hosting:

| Requirement | Why | What it rules out |
|---|---|---|
| A **Node process that stays running** | The price-checking job runs on a schedule inside the app | Netlify, Vercel, GitHub Pages, Cloudflare Pages (all serverless — no long-lived process) |
| A **persistent disk** | Your price history is a SQLite file. No disk = history wiped on every deploy | Most free tiers |
| **No sleeping** | A sleeping app runs no price checks | Render's free tier, Fly's scale-to-zero |

Everything below respects those three.

---

## Pick your path

| | Path A — Free forever | Path B — Cheapest paid | Path C — Easiest |
|---|---|---|---|
| **Cost** | $0 | ~$2–4/month | ~$7/month |
| **Where** | Oracle Cloud Always Free | Fly.io | Render |
| **Setup time** | ~40 min | ~15 min | ~10 min |
| **Needs a card?** | Yes (verification only) | Yes | Yes |
| **You manage the server?** | Yes | No | No |
| **Best for** | Never paying anything | Low cost, still managed | Getting it done today |

There's also **Path D — your own computer**, which is free and takes 10 minutes, if you just want
it running for yourself.

**My recommendation:** start with **Path C** to see it live today. If $7/month annoys you, move to
Path A later — it's the same Docker image, so migrating is quick.

---

## Before any path: get a price API key (5 minutes, free)

Without this the app runs on clearly-labelled sample data. With it you get real prices.

1. Go to **[serpapi.com](https://serpapi.com/users/sign_up)** and create an account.
2. Copy your key from the dashboard (it looks like a long string of letters and numbers).
3. Keep it somewhere safe — you'll paste it into the hosting provider, never into the code.

The free plan includes roughly **100 searches per month**. That sounds tiny, but it's enough if you
set the refresh schedule sensibly — the configs in this repo default to one check per day, which
supports about 3 tracked products on the free plan. Each search you run in the app also costs one.

> **You can skip this entirely for now.** Deploy on sample data, confirm it works, and add the key
> later — it's one environment variable.

---

## Path C — Render (easiest, ~$7/month)

### Step 1 — Put the code on GitHub

If it isn't already:

```bash
cd Miller
git remote -v          # if this shows a GitHub URL, you're done
```

Otherwise create an empty repo on GitHub and follow its "push an existing repository" instructions.

### Step 2 — Create the service

1. Sign up at **[render.com](https://render.com)**.
2. Click **New → Blueprint**.
3. Connect your GitHub account and pick this repository.
4. Render finds [`render.yaml`](render.yaml) and shows you what it will create: one web service and
   a 1 GB disk. Click **Apply**.

### Step 3 — Fill in the values it asks for

Render prompts for the variables marked "sync: false":

| Variable | What to put |
|---|---|
| `SERPAPI_KEY` | Your key from earlier, or leave blank to run on sample data |
| `APP_URL` | Your Render URL, e.g. `https://pricescout.onrender.com` — you'll know it after the first deploy, so set it then |
| `RESEND_API_KEY`, `MAIL_FROM` | Leave blank unless you want email alerts |

`JWT_SECRET` is generated automatically. Don't touch it.

### Step 4 — Choose the instance type

Pick **Starter** (about $7/month). This is not optional:

- the **free** instance has no disk, so your price history would vanish on every deploy;
- the free instance also sleeps after inactivity, which stops the price checks.

The 1 GB disk adds roughly $0.25/month.

### Step 5 — Deploy and check

Click deploy and wait ~4 minutes. Then visit `https://your-app.onrender.com/api/health`:

```jsonc
{ "ok": true, "usingMockData": false }
```

`usingMockData: false` means real prices. If it says `true`, your API key didn't land — go to
**Environment** in the Render dashboard, check `SERPAPI_KEY`, and redeploy.

**Done.** Open the app, create an account, and track something.

---

## Path B — Fly.io (~$2–4/month)

Cheaper because you pay for a small machine by the second rather than a fixed plan.

### Step 1 — Install the CLI and sign in

```bash
curl -L https://fly.io/install.sh | sh     # macOS/Linux
fly auth signup                            # or: fly auth login
```

Windows: `iwr https://fly.io/install.ps1 -useb | iex` in PowerShell.

### Step 2 — Name your app

Open [`fly.toml`](fly.toml) and change the first line to something unique:

```toml
app = "pricescout-yourname"
```

### Step 3 — Create it

```bash
fly launch --no-deploy --copy-config
fly volumes create pricescout_data --size 1
```

The volume is the persistent disk. 1 GB is plenty — price history is tiny.

### Step 4 — Set your secrets

```bash
fly secrets set \
  JWT_SECRET=$(openssl rand -hex 32) \
  SERPAPI_KEY=your-key-here
```

(No `openssl`? Use any long random string you make up — it just has to be secret.)

### Step 5 — Deploy

```bash
fly deploy
fly open
```

### Keeping the bill low

- `fly.toml` already pins **one** machine and disables auto-stop, because a stopped machine runs no
  price checks. Leave those settings alone.
- Check spend any time with `fly dashboard`.
- Do **not** scale to more than one machine — each would get its own copy of the database.

---

## Path A — Free forever (Oracle Cloud Always Free)

Oracle gives away a genuinely free virtual machine that doesn't expire. It's more setup, but the
bill is $0 permanently.

### Step 1 — Create the VM

1. Sign up at **[oracle.com/cloud/free](https://www.oracle.com/cloud/free/)**. A card is needed for
   identity verification; the Always Free resources don't charge it.
2. Create a **Compute instance**:
   - Image: **Ubuntu 22.04**
   - Shape: **VM.Standard.A1.Flex** (Ampere ARM) — set 1 CPU and 6 GB RAM, comfortably inside the
     free allowance
   - Save the SSH key it offers you
3. Under **Networking → Virtual Cloud Network → Security List**, add ingress rules allowing TCP
   **80** and **443** from `0.0.0.0/0`.

### Step 2 — Connect and install Docker

```bash
ssh -i your-key.pem ubuntu@YOUR_SERVER_IP

sudo apt update && sudo apt install -y docker.io git
sudo usermod -aG docker $USER && newgrp docker
```

Ubuntu on Oracle also runs a local firewall that blocks everything by default:

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

### Step 3 — Build and run PriceScout

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git pricescout
cd pricescout
docker build -t pricescout .

docker run -d --name pricescout \
  -p 80:4000 \
  -v pricescout-data:/data \
  -e JWT_SECRET="$(openssl rand -hex 32)" \
  -e PRICE_PROVIDERS=serpapi \
  -e SERPAPI_KEY=your-key-here \
  --restart unless-stopped \
  pricescout
```

Visit `http://YOUR_SERVER_IP` — the app is live.

### Step 4 — Add HTTPS (free)

Plain HTTP is fine for testing, but browsers will nag and passwords shouldn't travel unencrypted.
The free options:

**Easiest — Cloudflare Tunnel** (no domain, no open ports, no certificates):

```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 -o cloudflared
chmod +x cloudflared && sudo mv cloudflared /usr/local/bin/
cloudflared tunnel --url http://localhost:80
```

It prints a public `https://something.trycloudflare.com` URL immediately. For a permanent one,
follow Cloudflare's "named tunnel" setup (still free).

**If you own a domain — Caddy** (automatic Let's Encrypt certificates):

```bash
sudo apt install -y caddy
echo "yourdomain.com { reverse_proxy localhost:4000 }" | sudo tee /etc/caddy/Caddyfile
sudo systemctl restart caddy
```

Point your domain's A record at the server's IP first. Caddy handles the certificate itself.

### Step 5 — Updating later

```bash
cd pricescout && git pull
docker build -t pricescout . && docker rm -f pricescout
# then re-run the same `docker run` command from Step 3
```

---

## Path D — Just run it at home (free, 10 minutes)

Perfect if it's only for you.

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd Miller
npm install
cp server/.env.example server/.env
npm run seed        # optional: sample products to look at
npm run serve       # build + run, exactly as production does
```

Open **http://localhost:4000**.

To reach it from your phone, run a Cloudflare Tunnel alongside it:

```bash
cloudflared tunnel --url http://localhost:4000
```

Caveat: it only works while your computer is awake. A Raspberry Pi (~$40 once) fixes that and is
still cheaper than a year of hosting.

---

## After you're live: the five-minute checklist

- [ ] **Real prices?** `curl https://your-app/api/health` → `"usingMockData": false`
- [ ] **Sign up** with a real email so you can test alerts
- [ ] **Track a product** and set a target just above its current price — you should get an alert
      almost immediately
- [ ] **Set `APP_URL`** to your public URL so links in alert emails work
- [ ] **Back up the database.** It holds every price observation, which is the one thing you can't
      re-fetch. Once a week is plenty:
      ```bash
      docker exec pricescout sqlite3 /data/pricescout.db ".backup /data/backup.db"
      ```
- [ ] **Watch your API usage** on the SerpApi dashboard for the first few days

---

## Keeping the bill at zero (or near it)

**Hosting**

| Trick | Saving |
|---|---|
| Oracle Always Free VM | The whole hosting bill |
| One machine, not two | Halves any per-instance cost — and required anyway for SQLite |
| 1 GB disk, not 10 | Price history is measured in megabytes |

**API quota** — this is where surprise costs actually come from. All three settings are already
in the committed configs:

| Setting | Default here | What it does |
|---|---|---|
| `PRICE_REFRESH_CRON` | `0 7 * * *` | Checks once a day instead of four times |
| `PRICE_REFRESH_BATCH` | `25` | Never re-quotes more than 25 products in one run |
| `MIN_REFRESH_MINUTES` | `720` | Won't re-check the same product within 12 hours |
| `RATE_LIMIT_SEARCH` | `20` | Caps searches per minute per visitor |

If you're the only user, the free SerpApi tier covers roughly **3 tracked products**. For more,
either use a weekly schedule (`0 7 * * 1`, ~25 products) or move to a paid SerpApi plan.

**Domain** — you don't need one. `your-app.onrender.com` and `your-app.fly.dev` are free and work
fine. If you want your own, Cloudflare Registrar sells them at cost (~$10/year for `.com`).

---

## When something's wrong

**The site loads but every price says "sample data"**
Your `SERPAPI_KEY` isn't reaching the app. Check the environment variables in your host's
dashboard, then redeploy. The server logs `[providers] "serpapi" is enabled but not configured` at
startup when the key is missing — it falls back to sample data rather than crashing.

**"Application error" or a blank page**
Check the logs: `fly logs`, Render's **Logs** tab, or `docker logs pricescout`. The usual cause is
a missing `JWT_SECRET` — the server refuses to start in production without one, on purpose.

**My watchlist emptied itself after a deploy**
The database isn't on a persistent disk. On Render, confirm the disk is mounted at `/data`; on Fly,
`fly volumes list` should show one attached; with Docker, make sure you passed
`-v pricescout-data:/data`.

**Prices never update on their own**
The scheduled job needs the process alive. On Render that means a paid instance (free ones sleep);
on Fly, `auto_stop_machines = "off"`. Force a check by hand to confirm the rest works:
```bash
docker exec pricescout node server/src/scripts/refresh-once.js
```

**I'm getting rate-limited by SerpApi**
Lower `PRICE_REFRESH_BATCH`, move `PRICE_REFRESH_CRON` to weekly, or upgrade the plan. Nothing
breaks — the app logs the error and keeps serving the prices it already has.

---

## What everything costs, all in

| | Path A | Path B | Path C | Path D |
|---|---|---|---|---|
| Server | $0 | ~$2–4 | ~$7 | $0 |
| Disk | $0 | included | ~$0.25 | $0 |
| HTTPS | $0 (Cloudflare/Caddy) | included | included | $0 |
| Domain | $0 (or ~$10/yr) | $0 | $0 | $0 |
| Price API | $0 (free tier) | $0 | $0 | $0 |
| **Monthly** | **$0** | **~$2–4** | **~$7** | **$0** |
