# AuditReady

**Know exactly what you're missing before the auditor arrives.**

AuditReady is an audit-readiness platform. Teams upload the documents they
already have, the system reads them, matches them against the requirements of a
compliance framework, and produces an honest picture of where the organisation
stands: a readiness score, a requirement-by-requirement evidence matrix, a
ranked list of gaps, corrective actions, an auditor-style question simulator,
and an exportable readiness report.

Everything in this repository is real and working. There is no mocked UI, no
"coming soon" panel, and no fabricated data: the seeded demo organisation is
produced by running the actual pipeline — file storage, text extraction,
analysis, matching, gap detection and scoring — over twelve realistic documents
that contain deliberate, discoverable defects.

---

## 1. Complete feature list

### Accounts, organisations and access

- **Email + password authentication** — bcrypt hashing at cost 12, server-side
  session records that can be revoked, and a signed `jose` JWT cookie that
  carries only a session id plus an opaque half compared with
  `crypto.timingSafeEqual`.
- **Multi-tenancy** — a user may belong to many organisations and switches the
  active one from the sidebar. Every query is scoped by `orgId` inside the data
  layer, not in the UI.
- **Six roles** — `OWNER`, `ADMIN`, `MANAGER`, `CONTRIBUTOR`, `VIEWER`,
  `CONSULTANT`, implemented as additive permission sets rather than a numeric
  hierarchy, so a consultant can be powerful in one area and read-only in
  another.
- **Departments** for routing evidence ownership and actions.
- **Member management** — invite, change role, suspend, remove; the owner seat
  cannot be removed while it is the last one.
- **Activity log** — an append-only `AuditLog` of who did what, to which record,
  from which address, visible to owners and admins.

### Frameworks and audit projects

- **Framework architecture is generic.** Nothing about ISO, SOC 2, HACCP or any
  other standard is hard-coded. A framework has versions, categories,
  requirements, importance weights, guidance and expected-evidence hints.
  Adding a new standard is data entry, not code.
- **Three original demo frameworks** ship with the app — a 25-requirement
  Quality Management framework, an 11-requirement Workplace Safety framework
  and an 8-requirement Supplier Assurance framework. They are written from
  scratch for this product and deliberately **do not** reproduce the text of
  any copyrighted standard.
- **Audit projects** — name, framework version, audit type (certification,
  surveillance, recertification, internal, customer, regulatory), scope,
  auditor/body, target date, status. Creating a project snapshots the
  framework's requirements into `ProjectRequirement` rows so later framework
  edits never rewrite history.
- **Applicability** — any requirement can be marked *not applicable* with a
  justification, and is then excluded from scoring.

### Evidence

- **Upload** PDF, DOCX, XLSX, CSV, TXT, JPG and PNG, with per-file size limits
  and an allow-list enforced server-side.
- **Text extraction** — `unpdf` for PDFs, `mammoth` for DOCX, `exceljs` for
  spreadsheets, native parsing for CSV/TXT, and optional OCR for images.
- **Metadata** — document type, owning department, tags, document date,
  effective and expiry dates, version, and the person accountable.
- **Private by default** — documents are never served from a public path. Every
  download goes through `/api/evidence/[id]/download`, which re-checks tenancy
  and writes an audit-log entry. On S3 the URL is presigned and short-lived.
- **Freshness tracking** — the system infers an effective date from the document
  body (ignoring future dates) and flags evidence that has gone stale.

### AI analysis

- **Structured analysis** of every document: a summary, the requirements it
  appears to satisfy with a relevance score and a strength of `STRONG` /
  `PARTIAL` / `WEAK`, the concerns it raises, quality observations, extracted
  dates, and the questions an auditor is likely to ask about it.
- **Provenance on everything.** Each assessment stores the provider, model,
  prompt version, an input hash, latency and a confidence value. Facts in the
  UI are labelled *AI assessment*, *Human verified*, *User supplied* or
  *System generated* and are rendered differently.
- **AI output is never silently treated as fact.** An AI-proposed evidence link
  starts as `PENDING` and does not contribute to the readiness score until a
  human approves it. Any AI conclusion can be overridden, and the override is
  recorded.
- **The system never declares compliance.** It reports readiness and evidence
  coverage; language asserting certification, legal compliance or a guaranteed
  pass is absent by design, and every report carries the disclaimer.

### Matrix, gaps and actions

- **Evidence → requirement matrix** with a side panel showing, for any cell,
  the linked documents, the AI's reasoning, the human decision and the
  requirement's current status.
- **Six requirement statuses** — `NOT_ASSESSED`, `MISSING`, `NEEDS_REVIEW`,
  `PARTIALLY_SATISFIED`, `SATISFIED`, `NOT_APPLICABLE`.
- **Gap detection engine** covering missing evidence, weak evidence, stale
  evidence, unapproved links, missing approvals, expired documents and
  unanswered auditor questions. Each gap carries a stable fingerprint, so
  re-running detection updates gaps in place, auto-resolves ones that have been
  fixed, and never overwrites a human's decision to accept or dismiss.
- **Gap Center** with filters by severity, category, type and status.
- **Readiness score** — an importance-weighted proportion of applicable
  requirements, counting only human-approved evidence.
- **Risk score** — a configurable 0–100 pressure index blending unmet critical
  requirements, days remaining, open actions and evidence quality, surfaced as
  `LOW` / `MEDIUM` / `HIGH` / `CRITICAL`.
- **Actions** with five statuses (`OPEN`, `IN_PROGRESS`, `BLOCKED`, `COMPLETE`,
  `VERIFIED`), owners, due dates, priorities, attachments and comments.
- **AI-generated remediation actions** from any gap, editable before saving and
  clearly marked as AI-proposed.

### Preparation, simulation and reporting

- **Audit preparation mode** — a countdown and a ranked *top 10 priorities*
  list scored by impact × urgency ÷ effort, so the list is defensible rather
  than arbitrary.
- **"Ask Me Like an Auditor"** — a simulator that generates questions grounded
  in the organisation's own evidence, scores free-text answers, points out what
  a real auditor would probe next, and gates behind the Professional plan.
- **Readiness report** — an immutable JSON snapshot rendered on screen and
  exported as a real PDF via `pdfkit` (no headless browser required). Contains
  the executive summary, score, category breakdown, gap register, action plan,
  evidence inventory and recommendations, and always carries the disclaimer
  that it is a readiness assessment and **not** a certification, legal opinion,
  or guarantee of audit outcome.

### Platform

- **Notifications** — in-app inbox plus an email abstraction (console driver by
  default) for assignments, due dates, stale evidence and completed analyses.
- **Global search** across requirements, evidence (including extracted text),
  gaps, actions and projects — tenant-scoped.
- **Consultant mode** — consultancy organisations, client engagements and a
  client portfolio view with per-client readiness. Structured now; the
  self-service client-invitation flow is a future phase.
- **Billing** — plan catalogue with limits, upgrade/downgrade, trial handling,
  and a development simulator when no Stripe credentials are present.
- **Landing page** — hero, problem framing, how it works, feature grid,
  audience segments, sample readiness report, pricing, FAQ, trust/security, and
  a closing call to action.

### Security

- Passwords hashed with bcrypt (cost 12); no plaintext, no reversible storage.
- Authorisation checked on every server action and route handler; the frontend
  never decides access.
- Tenant isolation enforced at the query layer — a valid session plus a real id
  from another organisation returns 404, not data.
- Evidence downloads are authenticated, authorised, logged, and presigned on S3.
- Upload size limits and a MIME/extension allow-list.
- All input validated with Zod schemas at the boundary.
- Rate limiting on authentication, upload and AI-analysis endpoints.
- Security headers: `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `Permissions-Policy`.
- Session cookie is `httpOnly`, `SameSite=Lax`, and `Secure` in production.
- Stripe webhooks verified by HMAC with a five-minute replay window and a
  constant-time comparison.

---

## 2. Database schema summary

Prisma with SQLite in development, portable to PostgreSQL. Twenty-seven models.

> SQLite supports neither native enums nor a JSON column type, so enumerations
> are stored as `String` and constrained by TypeScript union types in
> `src/lib/enums.ts`, and structured payloads are stored as JSON text with
> typed helpers in `src/lib/json.ts`. Switching the datasource to PostgreSQL
> requires no application changes.

**Identity and tenancy**

| Model | Purpose |
| --- | --- |
| `User` | Person. Email, bcrypt hash, name, job title, avatar seed, active organisation. |
| `Session` | Server-side session for revocation: token hash, user agent, IP, expiry. |
| `Organization` | Tenant. Name, slug, industry, size band, country, kind (`STANDARD` \| `CONSULTANCY`). |
| `Membership` | User ↔ Organization with role, status and department. |
| `Invitation` | Pending membership with role and expiry. |
| `Department` | Named unit inside an organisation. |
| `ClientEngagement` | Consultancy → client organisation link, with scope and status. |

**Framework library**

| Model | Purpose |
| --- | --- |
| `Framework` | A standard or scheme. Key, name, publisher, description. Global or org-owned. |
| `FrameworkVersion` | A dated edition of a framework; requirements hang off the version. |
| `RequirementCategory` | Clause grouping within a version, ordered. |
| `Requirement` | Identifier, title, text, guidance, importance weight, expected-evidence hints. |

**Audit work**

| Model | Purpose |
| --- | --- |
| `AuditProject` | The engagement: framework version, audit type, scope, auditor, target date, readiness and risk scores. |
| `ProjectRequirement` | Snapshot of a requirement inside a project — status, applicability, owner, notes, human decision. |
| `Evidence` | An uploaded document: storage key, MIME, size, checksum, extracted text, extraction status, analysis status, dates, tags, owner. |
| `EvidenceLink` | Evidence ↔ ProjectRequirement with strength, relevance, source (`AI` \| `HUMAN`) and review state (`PENDING` \| `APPROVED` \| `REJECTED`). |
| `AiAssessment` | One analysis run: provider, model, prompt version, input hash, confidence, latency, payload, `ACTIVE`/superseded. |
| `Gap` | A detected shortfall: type, severity, fingerprint, status, rationale, resolution. |
| `Action` | Corrective action: title, description, priority, status, owner, due date, source. |
| `ActionAttachment` | File attached to an action. |
| `Comment` | Threaded note on a requirement, gap or action. |
| `AuditReport` | Immutable JSON snapshot of a readiness report plus its headline figures. |

**Simulator**

| Model | Purpose |
| --- | --- |
| `SimulatorSession` | An auditor-simulation run scoped to a project, with a score. |
| `SimulatorQuestion` | A generated question and the requirement it targets. |
| `SimulatorAnswer` | The user's answer, the score, and the follow-up an auditor would ask. |

**Platform**

| Model | Purpose |
| --- | --- |
| `Notification` | In-app notification with type, target link and read state. |
| `Subscription` | Organisation plan, billing status, period end, provider customer/subscription ids. |
| `AuditLog` | Append-only record of actor, action, entity, metadata, IP and user agent. |

Every tenant-owned model carries `orgId` and is indexed on it. Deletes cascade
from the organisation down, so removing a tenant removes its data.

---

## 3. Environment variables

Copy `.env.example` to `.env`. Every variable has a working default except
`AUTH_SECRET` in production, so the app runs with no credentials at all.

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `file:./dev.db` | Prisma datasource. |
| `AUTH_SECRET` | dev fallback; **required in production** | Signs session cookies. Generate with `openssl rand -base64 48`. |
| `APP_URL` | `http://localhost:3000` | Base URL for email links and billing redirects. |
| `SESSION_DAYS` | `14` | Session lifetime. |
| `AI_PROVIDER` | `mock`, or `anthropic` if a key is present | Analysis provider. |
| `ANTHROPIC_API_KEY` | — | Enables live analysis. |
| `AI_MODEL` | `claude-opus-5` | Model id. |
| `AI_MAX_INPUT_CHARS` | `24000` | Truncation ceiling for document text sent to the model. |
| `STORAGE_DRIVER` | `local`, or `s3` if `S3_BUCKET` is set | Where evidence is stored. |
| `STORAGE_LOCAL_DIR` | `./storage` | Local storage root. |
| `S3_BUCKET` / `S3_REGION` / `S3_ENDPOINT` | — | Bucket configuration; `S3_ENDPOINT` targets R2, MinIO or B2. |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | — | S3 credentials. |
| `MAX_UPLOAD_MB` | `25` | Per-file upload ceiling. |
| `OCR_ENABLED` | `false` | Enables OCR of image evidence. |
| `EMAIL_PROVIDER` | `console` | `console` or `http`. |
| `EMAIL_FROM` | `AuditReady <notifications@auditready.app>` | Sender identity. |
| `EMAIL_API_URL` / `EMAIL_API_KEY` | — | Transactional email endpoint and key. |
| `EMAIL_PAYLOAD_STYLE` | `resend` | `resend` or `postmark` body shape. |
| `BILLING_PROVIDER` | `simulator`, or `stripe` if a key is present | Billing backend. |
| `STRIPE_SECRET_KEY` | — | Stripe API key. |
| `STRIPE_WEBHOOK_SECRET` | — | Webhook signing secret. |
| `STRIPE_PRICE_STARTER` … `STRIPE_PRICE_CONSULTANT` | — | Price ids per plan. |

No secret is ever read from the client bundle: `src/lib/env.ts` is server-only.

---

## 4. Running locally

```bash
npm install
cp .env.example .env          # optional — sensible defaults are built in
npx prisma migrate deploy     # create the SQLite database
npm run db:seed               # load demo data (runs the real pipeline)
npm run dev                   # http://localhost:3000
```

For a production build:

```bash
npm run build
npm run start
```

### Demo accounts

Seeding creates two client organisations and one consultancy. The password for
every demo account is `AuditReady2026!`.

| Email | Role |
| --- | --- |
| `dana@northfield.example` | Owner of Northfield Manufacturing, viewer at Coastline Food Co |
| `tomas@northfield.example` | Manager |
| `sam@northfield.example` | Contributor |
| `priya@meridian.example` | Owner of Meridian Compliance Partners (consultancy) |

Northfield's seeded audit lands at roughly **78% readiness, MEDIUM risk, ~72
days to audit** — not written into the database, but computed by running the
real analysis and scoring pipeline over documents that contain genuine defects
(a training matrix with blank completion dates and a "TBD", two overdue
calibration instruments, a supplier evaluation 500 days stale).

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server. |
| `npm run build` / `npm run start` | Production build and server. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run db:migrate` | Create a migration from schema changes. |
| `npm run db:deploy` | Apply migrations. |
| `npm run db:seed` | Seed demo data. |
| `npm run db:reset` | Drop, re-migrate and re-seed. |
| `npm run db:studio` | Prisma Studio. |
| `npm run eval:matcher` | Score the document→requirement matcher against expected pairs. |

### Verification harnesses

Three harnesses in the repository exercise the running application rather than
mocks. Start the app on port 3100, then:

```bash
node flow-test.mjs        # 32 checks: signup → org → audit → upload → analysis
                          #            → gaps → action → report → PDF → search
node security-test.mjs    # 28 checks: cross-tenant probes with real ids, RBAC,
                          #            session forgery, headers, webhook signing
npm run eval:matcher      # retrieval quality: 15/17 expected pairs, 11/12 top-1
```

`security-test.mjs` signs in as a real user, switches to an organisation where
they are only a viewer, and then attacks genuine ids belonging to the other
organisation. If isolation were enforced only in the UI, those probes would
succeed and the test would fail.

---

## 5. Configuring AI

The provider lives behind the `AiProvider` interface in `src/lib/ai/types.ts`.
Two implementations ship:

**`mock` (default).** A deterministic offline analysis engine
(`src/lib/ai/heuristics.ts`) that does real work: it builds a weighted term map
from the document — including filename tokens, because a maintenance schedule
rarely contains the word "maintenance" in its body — scores it against every
requirement with field weights (`title` 2.0, expected evidence 2.6, text 1.0,
guidance 0.7), applies soft length normalisation so short structured records
are not punished, rank-normalises across requirements, extracts dates, and
detects defects such as blank required fields, "TBD" placeholders and overdue
entries. No network, no key, and identical output for identical input.

**`anthropic`.** Set `ANTHROPIC_API_KEY` and `AI_PROVIDER=anthropic`. Requests
use structured output with a JSON schema, handle refusal stop reasons, and
re-validate the response with Zod. Requirement identifiers the model invents are
dropped — only ids that exist in the project are accepted. **Any error, refusal
or schema failure falls back to the offline engine**, so analysis degrades in
quality rather than breaking.

To add a third provider, implement `AiProvider` and register it in
`src/lib/ai/index.ts`. Nothing else in the application changes.

Every result is persisted with provider, model, prompt version, input hash,
confidence and latency, so an assessment can always be traced back to what
produced it.

---

## 6. Configuring storage

The `StorageDriver` interface in `src/lib/storage/types.ts` has two
implementations.

**Local (default).** Files are written under `STORAGE_LOCAL_DIR`, outside the
public directory. The path is never exposed; downloads stream through the
authenticated API route.

**S3-compatible.** Set `STORAGE_DRIVER=s3` plus the bucket, region and
credentials. SigV4 is signed in-process over `fetch`, so no AWS SDK is
required, and any S3-compatible endpoint works — AWS, Cloudflare R2, MinIO,
Backblaze B2 — by pointing `S3_ENDPOINT` at it. Downloads use short-lived
presigned URLs.

Keep the bucket private. AuditReady never generates a public object URL, and
the download route re-checks organisation membership before issuing one.

---

## 7. Configuring billing

Plans, prices, limits and feature flags live in one place:
`src/lib/billing/plans.ts`. Prices are stored in cents and read from there by
the landing page, the pricing table, billing settings and limit enforcement —
they are not repeated anywhere. Shipping tiers: Free trial, Starter $29/mo,
Professional $79/mo, Business $199/mo, plus a Consultant tier marked as a
future phase.

**Simulator (default).** With no Stripe credentials, plan changes apply
immediately and every screen states plainly that the change was simulated and
that no payment was taken. Nothing pretends to be a real charge.

**Stripe.** Set `BILLING_PROVIDER=stripe`, `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET` and the four `STRIPE_PRICE_*` ids. Checkout and the
billing portal are created over the Stripe REST API. **The webhook is the
authority on subscription state** — the app never trusts a redirect back from
Checkout. Signatures are verified with HMAC over the `t=…,v1=…` header using a
constant-time comparison and a five-minute replay window.

Point Stripe at `POST /api/billing/webhook` and subscribe to
`checkout.session.completed`, `customer.subscription.updated` and
`customer.subscription.deleted`.

---

## 8. Known limitations

Stated plainly, because an audit-readiness product that overstates itself would
be self-defeating.

- **SQLite in development.** The schema is Postgres-portable, but SQLite has no
  native enum or JSON type, so enums are strings validated in TypeScript and
  structured payloads are JSON text. Production should switch the Prisma
  provider to `postgresql`.
- **No stock photography.** The sandbox this was built in blocks
  `images.unsplash.com` at the proxy (403 on CONNECT), so no external image URL
  could be verified as resolving. Rather than ship links that might 404, all
  landing-page imagery is self-contained SVG and CSS, including a hero "product
  screenshot" rendered from the application's own components and design tokens.
  It scales, prints, never breaks, and stays accurate as the product changes —
  but it is illustration, not photography. See *Next steps*.
- **OCR is off by default.** `tesseract.js` is an optional dependency and is
  loaded lazily. Scanned PDFs are not rasterised for OCR — only image files are
  processed when OCR is enabled.
- **Rate limiting is in-process.** It protects a single node. A multi-instance
  deployment needs Redis or the platform's own limiter.
- **Invitations use an admin-set temporary password** rather than an emailed
  signup link. The `Invitation` model and email abstraction are in place; the
  tokenised link flow is not built.
- **Consultant engagements are created directly in the database.** The
  consultancy portfolio view, cross-organisation access and permissions all
  work; the self-service "invite a client" flow does not exist yet.
- **The simulator asks good questions but does not adapt across sessions.** It
  does not remember which topics a user has already struggled with.
- **Report layout is functional PDF, not designed typography.** `pdfkit` gives
  a clean, dependency-light document; it is not a designed template.
- **One moderate transitive advisory** remains: `exceljs` → `uuid`, a buffer
  bounds check on a code path this application does not exercise. It clears
  when `exceljs` updates its dependency.
- **The demo frameworks are illustrative.** They are original content written
  for this product. Real deployments must license or author the frameworks they
  intend to audit against.

---

## 9. Recommended next development steps

1. **Move to PostgreSQL** and convert the string enums to native enums and the
   JSON-text columns to `jsonb`. Add full-text search on extracted evidence text
   — global search currently uses `LIKE`, which will not scale.
2. **Background job queue.** Extraction and analysis run inline today. Moving
   them to a queue with retries and progress reporting is the single biggest
   robustness win, and it is what makes bulk upload of a hundred documents
   pleasant instead of alarming.
3. **Tokenised invitation and password-reset emails**, replacing the temporary
   password flow, plus the self-service consultant→client invitation.
4. **Photography and brand art direction.** Commission or license real imagery
   for the landing page in an environment with outbound image access, and keep
   the SVG product mockup as the hero — it is more honest than a stock photo of
   people pointing at a laptop.
5. **Framework import.** A CSV/JSON importer and an editor UI so customers can
   load their own standards without a developer.
6. **Evidence versioning.** Supersede-in-place with a version history, so
   re-uploading a revised procedure preserves the link and the audit trail
   rather than creating an orphan.
7. **Analysis quality loop.** Every human approval or rejection of an AI link is
   already recorded — feed that back as a measurable accuracy metric per model
   and prompt version, and use it to tune retrieval. `npm run eval:matcher` is
   the beginning of this.
8. **Redis-backed rate limiting and sessions** for multi-node deployment.
9. **Automated regression suite in CI.** The three harnesses here are real and
   worth running on every push; they need a CI workflow, a seeded ephemeral
   database and Playwright installed in the runner.
10. **Accessibility audit.** The UI uses semantic markup, labelled controls and
    visible focus states throughout, but it has not been tested with a screen
    reader or run through an automated WCAG check.

---

## Project layout

```
prisma/
  schema.prisma          27 models
  migrations/            SQL migrations
  seed.ts                drives the real pipeline, not fixture inserts
  seed-documents.ts      12 realistic documents with deliberate defects
src/
  app/                   36 routes (App Router)
  components/            UI, marketing, and app-shell components
  lib/
    ai/                  provider interface, Anthropic, mock, offline engine
    auth/                password hashing, sessions, RBAC
    billing/             plan catalogue, Stripe, simulator
    documents/           extraction and OCR
    email/               console and HTTP drivers
    frameworks/          demo framework definitions
    storage/             local and S3-compatible drivers
    enums.ts             all enumerations + presentation metadata
    tenant.ts            tenancy context and permission enforcement
    scoring.ts           readiness and risk
    gaps.ts              gap detection engine
    prepare.ts           priority ranking
    reports.ts           report payload construction
scripts/match-report.ts  matcher evaluation harness
flow-test.mjs            end-to-end user-flow test
security-test.mjs        tenant-isolation and authorisation probe
```

## Disclaimer

AuditReady produces a readiness assessment. It is not a certification, a legal
opinion, or a guarantee of any audit outcome. AI-generated findings are
suggestions requiring human verification, and the platform is designed
throughout to keep that distinction visible rather than to hide it.
