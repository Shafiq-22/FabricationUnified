# BAF Workshop Job Book

Internal web application for the **BAF — Workshop Steel Fabrication** department.
It replaces the legacy Excel job book used to manage fabrication jobs,
procurement, consumables, workforce costs, quotations‑vs‑actuals, and supplier
performance for 10–20 concurrent users.

**Stack:** Next.js 14 (App Router) · TypeScript · Supabase (Postgres + Auth +
RLS + Realtime) · Tailwind CSS + shadcn/ui · `@react-pdf/renderer` · deployed on
Vercel. Industrial‑utilitarian dark UI.

---

## Modules

1. **Auth & Roles** — email/password sign‑in, 3 custom‑named tiers, 8‑hour idle logout.
2. **Dashboard** — numbers‑only month KPIs (No. of Jobs, Gross P/L, Daywork Charges, Consumables Cost, Avg Lead Time) + status breakdown (incl. Halt). Financials hidden for Tier 1.
3. **Jobs Register** — filter by status/site/month + search, colour‑coded status badges, auto‑generated job codes.
4. **Job Worksheet** — tabs **Quotation / Actual / Tentative / Analytics**. Material, Workforce (costed by Settings rates) and Consumables sections each apply a global Settings margin; computed Quotation Summary; Tentative estimator priced from historic procurement; Analytics with predicted‑vs‑actual P/L and a cost‑deviation chart; PDF quotation.
5. **Rough Sheet / Cut‑List** — cut‑list entry with auto‑aggregated order list (bars) + plate nesting, "Copy to Job Material Request".
6. **Procurement** — three sub‑tabs: **Job Material** (request/order/delivery, avg days‑to‑deliver KPI, CSV), **Consumables** (monthly register, CSV), **Historic Prices** (recorded prices by item & supplier).
7. **Handover & Forecast** — active vs forecasted items with per‑item drawings tracker.
8. **Sites** (admin) — manage the 116 site codes.
9. **Users** (admin) — invite, assign roles, deactivate, reset password.
10. **Settings** (admin) — rename role tiers, set section margins (Material/Workforce/Consumables), edit labour rates, company/department for PDF, change own password.

## Role tiers

| Tier | Default name | Capabilities |
|------|--------------|--------------|
| 1 | Plant Manager | Read‑only Dashboard / Jobs / status; add comments. **No financial figures.** |
| 2 | Fabrication Engineer | + create/edit jobs, worksheets, rough sheets, consumables, procurement, handover; sees all financials. |
| 3 | Fabrication Manager | + delete (soft), user management, config, audit log. |

Tier display names are admin‑editable in **Settings** (the underlying 1/2/3 ranks are fixed).

---

## Local development

```bash
npm install
cp .env.example .env.local   # fill in the values (see below)
npm run dev                  # http://localhost:3000
npm run build                # production build
npm run typecheck            # tsc --noEmit
```

### Environment variables

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project API URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable (`sb_publishable_…`) / anon key |
| `NEXT_PUBLIC_SITE_URL` | Base URL of the deployment |
| `NEXT_PUBLIC_INACTIVITY_TIMEOUT_MINUTES` | Idle‑logout window (default `480` = 8 h) |

> Secrets live only in `.env.local` (git‑ignored). User management uses an
> admin‑only Postgres RPC (`admin_create_user`), so the **service‑role key is
> not required** by the app at runtime.

---

## Supabase setup (fresh project)

The schema is fully reproducible from `supabase/migrations` (applied in order)
plus `supabase/seed/seed.sql`.

**Option A — Supabase CLI**

```bash
supabase link --project-ref <your-ref>
supabase db push                      # applies supabase/migrations in order
psql "$DATABASE_URL" -f supabase/seed/seed.sql
```

**Option B — SQL editor:** paste each `supabase/migrations/000*.sql` in numeric
order, then `supabase/seed/seed.sql`.

Migration order: `0001_schema` → `0002_functions` → `0003_triggers` →
`0004_views_rpcs` → `0005_rls` → `0006_realtime` → `0007_hardening` →
`0008_app_config`.

### First admin

No public sign‑up exists. Create the first Tier‑3 admin once, directly in SQL
(replace email / password):

```sql
with new_user as (
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous,
    confirmation_token, recovery_token, email_change, email_change_token_new
  )
  values (
    '00000000-0000-0000-0000-000000000000', gen_random_uuid(),
    'authenticated', 'authenticated', 'admin@company.com',
    extensions.crypt('CHANGE_ME', extensions.gen_salt('bf')),
    now(), now(), now(),
    jsonb_build_object('provider','email','providers', array['email']),
    jsonb_build_object('full_name','Fabrication Manager'), false, false,
    '', '', '', ''   -- GoTrue token columns must be '' (not NULL) or login fails
  ) returning id
), ident as (
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  select gen_random_uuid(), id, id::text,
    jsonb_build_object('sub', id::text, 'email','admin@company.com','email_verified',true),
    'email', now(), now(), now() from new_user returning user_id
)
insert into public.users (id, full_name, email, role_tier, active)
select user_id, 'Fabrication Manager', 'admin@company.com', 3, true from ident;
```

Thereafter, the admin invites everyone else from the **Users** page (setting a
temporary password each user changes after first sign‑in).

### Recommended Supabase Auth settings

- Enable **Leaked password protection** (Auth → Policies).
- Email confirmations are not required (users are admin‑provisioned).

---

## Deployment (Vercel)

1. Import the repo into Vercel.
2. Set the four env vars above in **Project → Settings → Environment Variables**
   (use the production Supabase URL + publishable key; set `NEXT_PUBLIC_SITE_URL`
   to the production domain).
3. Deploy. Default Next.js build settings work (`next build`).

---

## Architecture & security notes

- **All tables have RLS enabled**; `anon` has no access. Policies enforce the
  three tiers at the database level (not just the UI).
- **Tier‑1 financial hiding** is enforced in the DB three ways: cost‑bearing
  detail tables are Tier‑2+ SELECT only; `jobs` is read through a
  `SECURITY DEFINER` masking view (`jobs_view`) that returns `NULL` for all
  money columns to Tier 1 while direct `SELECT` on the base `jobs` table is
  revoked; financial dashboard aggregates come from a Tier‑2‑gated RPC.
- **Audit trail:** every mutation on business tables writes to `audit_log` via a
  generic trigger (append‑only, admin‑readable).
- **Soft delete:** records carry `deleted_at`; only Tier 3 may set it (enforced
  by trigger). Tier 2 cannot delete records.
- **Job codes** `BAF/{STATUS}/{SITE}/{MONTH}/{SEQ}` (STATUS ∈ QTN/INP/COM/DEL/HAL)
  are generated by a concurrency‑safe per‑month sequence; only the status prefix
  changes when status changes (the rest is immutable).
- **Financials are worksheet‑driven**: `recompute_job_financials` derives each
  job's quote‑before‑margin, final quote, effective margin %, actual cost and P&L
  from its Material/Workforce/Consumables sections using the global section
  margins in Settings (recomputed on every worksheet save, and across all jobs
  when a margin changes). Final Quote = Σ section subtotals × (1 + section margin).
- **Realtime:** job status (via a finance‑free `job_status_events` table to
  avoid leaking financials over the wire), job comments, and actual‑workforce
  log entries.

### Deviations from the original spec (intentional)

- A **`job_comments`** table backs the realtime comment thread (the spec's
  single `comments` text field can't support a multi‑user thread; it is kept as
  a free‑text "Notes" field).
- **`rough_sheet_aggregated`** and the plate aggregation are **views**
  (auto‑computed from the cut list) rather than physical tables.
- An **`app_config`** key/value table stores the company/department names.
- **Resolved ambiguities:** job‑code `SEQ` is sequential per month (globally);
  all monetary columns on a job are hidden from Tier 1; `time_to_deliver_days`
  = `delivery_date − order_date`; worksheet/rough‑sheet **line items** may be
  removed by Engineers as part of normal editing, while top‑level *records*
  (jobs, consumables, procurement, handover) are admin‑only soft‑delete.

### Project layout

```
app/                 (app)/ protected route group + /login
components/ui        shadcn/ui primitives
components/{jobs,dashboard,procurement,handover,sites,users,settings,records,pdf,layout}
lib/{supabase,types,utils,auth,date,config,hooks}
supabase/migrations  ordered SQL
supabase/seed        roles, labour rates, 116 sites
```
