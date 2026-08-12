# CONTINUATION.md — Fabrication Job Book

> **Session‑continuity / handoff document.** A fresh Claude Code session should read this
> file completely before touching anything, then verify it against the live repository.
> **This file is meant to be kept up to date** — after any material change (new migration,
> new feature, new bug, changed decision), update the relevant section and the
> `CLAUDE QUICK START` + `MACHINE‑READABLE STATE` at the bottom. Keep edits surgical to save
> tokens: change the lines that changed, don't rewrite the whole file.
>
> **Last updated:** after **Changes I (12/08/2026)** — **all six items delivered**, including the
> re-cut role model (0049). Migrations 0001–0049 in repo; see **§5 migration bookkeeping**.

---

# CLAUDE QUICK START

- **Project:** "Fabrication Job Book" — internal web app for the **BAF (Workshop Steel Fabrication)** department of **Six Construct / Besix** (Dubai). Replaces a complex Excel job book. 10–20 concurrent users.
- **Stack:** Next.js 14 (App Router) + TypeScript · Supabase (Postgres + Auth + RLS + Realtime + Storage) · Tailwind + shadcn/ui (Radix) · `@react-pdf/renderer` · recharts · exceljs. Deployed on Vercel.
- **Repo state:** branch is **per-session — read it from `git status`, don't trust a name written here.** Work to date landed on `claude/busy-mccarthy-W0FZV` (through `732a36e`); the audit pass ran on `claude/continuation-md-validation-0anxqi`. Push **only** to the branch the current session was assigned.
- **Supabase project ref:** `gxupuxysfhmwdvztabtn` (region ap-south-1, **free tier — auto-pauses after ~7 days idle; has paused several times; restore via `restore_project` MCP tool or the dashboard**).
- **DB migrations:** `supabase/migrations/0001…0049` (49 files, **52 live history rows**). Schema is in sync with live, but the file list and the live migration history are **not 1:1** — see **§5 migration bookkeeping** before counting. New schema work = new numbered migration file **and** apply it live via the Supabase MCP `apply_migration`.
- **Hard constraint (original + still in force):** **No AI/LLM API calls inside the app.** It is a data‑management tool. All "email" features are `mailto:` drafts, never sent by the app. Notifications are **in‑app only** (bell), by explicit user decision.
- **Security model (do not break):** 3 tiers. Money columns masked from **Tier 2** (0049; it was Tier 1 before) at the DB level via definer "masking views" (`jobs_view`, `projects_view`, `inventory_items_view`) keyed on **`auth_can_see_money()`**; the money columns are additionally revoked from `authenticated` on the base tables, for every tier. See **AUTH & SECURITY**.
- **Critical files:** `lib/types/index.ts` (aliases + enums), `lib/types/database.ts` (generated types — regenerate after every schema change), `lib/auth.ts`, `lib/supabase/{client,server,middleware}.ts`, `components/ui/table.tsx` (all tables centred + resizable), `lib/email-draft.ts`.
- **Regression invariant:** after any change touching financials, the recompute must leave existing job quotes byte‑identical. Historically verified values were 2500.00/2750.00/0.1000 etc.; the live DB was renumbered/emptied for testing (0046) so re‑derive current live values before asserting.
- **EXACT NEXT STEP:** There is **no committed pending task.** Changes I (12/08/2026) is fully delivered, including the re-cut role model (0049). Await the next `Changes_*.md`. The user drives work via dated `Changes_*.md` uploads. When one arrives: reproduce each reported bug against the live DB first (many "permission" bugs were RLS misconfigurations, not UI bugs), then implement + verify + commit per logical group. If asked to continue with nothing pending, ask the user for the next `Changes.md` or confirm the app is in acceptance.

---

# 1. WHAT THIS IS / WHY

**One sentence:** A role‑gated Next.js + Supabase web app that runs the full lifecycle of a steel‑fabrication workshop — quoting jobs, tracking material/workforce/equipment/service costs vs. actuals, procurement, cut‑list ordering, QA/welder certificates, personnel timesheets & transfers, documents, and point‑of‑contact registry — replacing an unwieldy shared Excel workbook.

**Problem:** The BAF department ran everything from one enormous Excel "job book": job register, quotations, procurement, consumables, timesheets, handover. It was error‑prone, un‑auditable, single‑writer, and leaked financials to everyone who opened it.

**Solution:** A multi‑user web app with per‑tier access, an append‑only audit log on every table, worksheet‑driven financials that recompute deterministically, and DB‑level masking so lower tiers physically cannot read money.

**Users / roles (3 tiers, names are admin‑configurable in `roles_config`) — RE‑CUT in 0049:**
- **Tier 1 — Plant Manager** (default name): **full access, including financials and admin rights.**
- **Tier 2 — Fabrication Engineer**: full operational edit, **no financials at all** (masked at DB, and the worksheet is hidden entirely); may delete **only within a job it is assigned to**.
- **Tier 3 — Fabrication Manager / admin**: full access, including financials and admin rights.

**Tier 2 is now the only restricted tier; 1 and 3 are peers.** This is the inverse of the original
design (where tier 1 was the restricted one) — do not "correct" it back. "Assigned" means a
`job_collaborators()` match: the job's creator, anyone who commented, staff linked through a
timesheet, or an explicit watcher.

---

# 2. TECHNOLOGY STACK

| Tech | Version | Purpose / notes |
|---|---|---|
| Next.js | 14.2.18 | App Router. Route group `app/(app)/` = protected. Pages are `export const dynamic = "force-dynamic"`. Server Actions in `actions.ts` (`"use server"` — may export only async functions). |
| React | 18.3.1 | Server Components by default; `"use client"` where interactive. |
| TypeScript | ^5 | Strict enough that `tsc --noEmit` is the primary gate. |
| Supabase JS | 2.107.0 | **Version‑locked with @supabase/ssr 0.10.3** — older ssr broke `.from()` typing (see FAILED APPROACHES). |
| @supabase/ssr | 0.10.3 | Cookie‑based auth for RSC/middleware. |
| Tailwind | 3.4.14 | Light "match‑Excel" theme (see below). |
| shadcn/ui + Radix | various | `components/ui/*`. Dialog, Select, Tabs, Toast, Tooltip, Checkbox, Dropdown, Label, Separator, Slot. |
| @react-pdf/renderer | 3.4.5 | Client‑side PDF (quotation, timesheet, equipment). Dynamically imported so it never loads on the server. |
| recharts | 2.15.4 | Dashboard charts + worksheet analytics. |
| exceljs | 4.4.0 | Excel/CSV import parsing (`lib/parsers/excel.ts`). DSTV/NC1 parser is hand‑written (`lib/parsers/dstv.ts`). |
| react-hook-form + zod + @hookform/resolvers | — | Validation. Server actions **also** re‑validate with zod. |
| lucide-react | 0.439 | Icons. |
| date-fns | 3.6 | Dates (`lib/date.ts`). |

~~`@tanstack/react-table`~~ — **removed** during the audit pass. It was carried in `package.json` but had **zero imports** anywhere in the repo; every table is hand‑rolled on the `ui/table` primitives. `tsc --noEmit` and `next build` both stayed green after `npm uninstall`. Don't re‑add it without a real consumer.

**Package manager:** npm (there is a `package-lock.json`). **No Docker, no CI config** committed — verified: there is no `.github/` directory at all.

**Theme tokens (light "match‑Excel"):** teal `#156082` (primary), orange `#E97132` (accent), navy `#0E2841`, blue‑grey `#D6DCE4` (header bands), gold `#FFC000` / green `#00B050` (status). Originally spec'd a *dark* industrial theme; the user switched to light to match an uploaded Excel workbook (decision, not a bug).

---

# 3. DIRECTORY / FILE ARCHITECTURE

```
FabricationUnified/
├── middleware.ts                       # THE Next.js middleware entry (delegates to lib/supabase/middleware.ts)
├── app/
│   ├── layout.tsx, page.tsx            # root; page.tsx redirects to /dashboard or /login
│   ├── globals.css                     # theme tokens live here
│   ├── login/{page,actions}.tsx, login-form.tsx   # email/password sign-in
│   └── (app)/                          # PROTECTED route group
│       ├── layout.tsx                  # getProfile() gate + Providers + Sidebar + Topbar(bell)
│       ├── dashboard/page.tsx          # month KPIs + charts (dashboard-charts.tsx)
│       ├── projects/{page,actions}.tsx, projects/new/page.tsx, projects/[id]/page.tsx
│       ├── jobs/{page,actions}.tsx, jobs/[id]/worksheet/{page,actions}.tsx, jobs/[id]/roughsheet/{page,actions}.tsx
│       │   └── jobs/[id]/import-actions.ts   # Excel/DSTV import server actions
│       ├── contacts/{page,actions}.tsx # "Point of Contact" (was Clients)
│       ├── clients/page.tsx            # legacy path, still present — redirects to /contacts
│       ├── documents/{page,actions}.tsx
│       ├── procurement/{page,actions}.tsx, procurement/supplier-actions.ts   # 4 sub-tabs via ?tab=
│       ├── consumables/{page,actions}.tsx    # (also surfaced inside procurement)
│       ├── inventory/{page,actions}.tsx
│       ├── qa/{page,actions}.tsx, qa/certificates-actions.ts   # Inspections | NCRs | Welder Certificates
│       ├── handover/{page,actions}.tsx
│       ├── records/{page,actions}.tsx, records/transfers-actions.ts  # Timesheet|Equipment|Maintenance|Transfers|Manage Lists
│       ├── sites/{page,actions}.tsx (admin)
│       ├── users/{page,actions}.tsx  → redirects into /settings?tab=users
│       ├── settings/{page,actions}.tsx (admin; General | Users tabs)
│       ├── notifications/actions.ts  # markRead/markAllRead/dismiss/setJobWatch (no page; bell only)
│       └── search/page.tsx           # global_search RPC
├── components/
│   ├── ui/                 # shadcn primitives. table.tsx = client, centred cells + resizable columns
│   ├── layout/             # sidebar.tsx, topbar.tsx (+notification-bell.tsx), nav.ts, page-header.tsx, inactivity-logout.tsx
│   ├── jobs/               # worksheet-panels, editable-table, equipment-charges-table, rough-sheet-editors,
│   │                       #   comments-thread(@mentions+watch), tentative-panel(inflation), analytics-panel,
│   │                       #   delete-job-button, job-status-control/-badge, import-dialog, new-job-dialog,
│   │                       #   job-meta-form, jobs-filter-bar, workforce-editor, copy-to-procurement-button
│   ├── projects/           # projects-manager, project-form(full-page create), project-detail(rollups+dedup),
│   │                       #   clients-manager (legacy, still present after the PoC rename)
│   ├── contacts/           # contacts-registry, contacts-by-entity, types.ts
│   ├── documents/          # document-upload(multi-file), documents-table, documents-grouped, documents-filters
│   ├── procurement/        # procurement-manager, procurement-grouped, suppliers-manager, procurement-filters
│   ├── consumables/        # consumables-manager
│   ├── qa/                 # qa-managers, certificates-manager, certificate-files
│   ├── records/            # timesheet-grid, timesheet-monthly, equipment-usage-grid, maintenance-manager,
│   │                       #   master-lists, transfers-manager, record-form-dialog, date-selector, csv-export-button
│   ├── handover/           # handover-manager
│   ├── inventory/          # inventory-manager, movements-table
│   ├── dashboard/          # kpi-card, dashboard-charts, month-selector
│   ├── pdf/                # quotation/timesheet/equipment -document.tsx + -pdf-button.tsx
│   ├── settings/settings-client · sites/sites-manager · users/users-manager · search/search-box
│   └── providers.tsx       # profile context provider
├── lib/
│   ├── types/index.ts      # row aliases + all domain enums/const arrays (DOC_TYPES, CONTACT_ROLES, JOB_STATUSES, PROJECT_STATUSES, etc.)
│   ├── types/database.ts   # GENERATED Supabase types — regenerate after schema changes
│   ├── auth.ts             # getProfile (cached), requireTier, getRoleNames
│   ├── supabase/{client,server,middleware}.ts
│   ├── email-draft.ts      # materialRequestDraft, transferNoticeDraft, certRenewalDraft, certExpiryNoticeDraft (all mailto:)
│   ├── parsers/{excel,dstv}.ts
│   ├── storage.ts          # DOCUMENTS_BUCKET const + documentObjectPath()
│   ├── equipment.ts, date.ts, utils.ts (formatAED, formatPercent, cn), config.ts
│   └── hooks/{use-toast,use-resizable-columns}.ts
├── supabase/migrations/0001…0047.sql   # authoritative schema history
├── public/baf-logo.jpg     # Six Construct logo (extracted from quote PDF)
├── .env.example            # variable names only
├── .env.production         # COMMITTED, and safe — NEXT_PUBLIC_* only (see §6/§7)
├── README.md               # module overview — STALE: still says "Clients" and "dark UI"
└── next.config.mjs · tailwind.config.ts · postcss.config.mjs · tsconfig.json · components.json · .eslintrc.json
```

**Do not casually modify:** `components/ui/table.tsx` (every table depends on its centred‑cell + resize behaviour), `lib/types/index.ts` enums (used app‑wide), the masking views/RLS in migrations.

---

# 4. ARCHITECTURE & DATA FLOW

```
Browser (RSC + Client Components)
   │  server action (form) / supabase-js (reads, storage, realtime)
   ▼
Next.js middleware (lib/supabase/middleware.ts) — refreshes auth cookie on every request
   │
   ▼
app/(app)/layout.tsx → getProfile() → redirect to /login if no session / inactive
   │
   ├── Page (RSC): createClient() (server) → supabase.from(view/table).select(...)  [reads via masking views]
   └── Server Action ("use server"): zod validate → supabase mutation → revalidatePath()
             │
             ▼
        Supabase Postgres
          - RLS policies enforce tier
          - masking VIEWS null-out money for Tier 1
          - triggers: audit_log, recompute_job_financials, code allocators, notifications fan-out, transfer apply, document project sync
          - Realtime publication: job_comments, job_status_events, job_actual_workforce, notifications
```

**Typical write flow (e.g. add worksheet material line):** client `EditableTable` collects rows → calls `replaceJobLines(jobId, table, rows)` server action → action checks tier, whitelists columns, deletes removed rows + upserts, then calls `recompute_job_financials(jobId)` RPC → `revalidatePath`. UI re‑renders with recomputed job totals.

**Read masking:** pages read `jobs_view` / `projects_view` / `inventory_items_view` (definer views, `security_invoker=false`) which wrap money columns in `case when public.auth_user_tier() >= 2 then col end`. Base tables also have SELECT column grants + row policies (added later; see history).

---

# 5. DATABASE

**Authoritative schema = `supabase/migrations/*.sql` (0001–0047), applied to project `gxupuxysfhmwdvztabtn`.** Regenerate `lib/types/database.ts` after any change (Supabase MCP `generate_typescript_types`; output is large — save to file and copy in).

### Migration bookkeeping (read before counting)
The repo has **49 files**; the live `supabase_migrations` history has **52 rows**. Verified: **the
schema itself is in sync** — the mismatch is bookkeeping only, from how the work was applied.

Sources of the drift, in order:

- **`0046_renumber_live_codes` is not in the live history at all.** It is pure DML (a one-off code
  renumber), applied via `execute_sql` rather than `apply_migration`, so it never registered. Its
  effects *are* live and confirmed: the surviving job is `BAF-INP-AP4-AUG-001` and the project is
  `PRJ-2026-001`. Don't "re-apply" it — it is not idempotent.
- **Two live rows have no repo file:** `notifications_realtime` and `revoke_job_collaborators_execute`.
  Both were applied incrementally mid-session and then consolidated into repo file `0041`; their
  content is verified present there (`alter publication supabase_realtime add table notifications`,
  `revoke execute on function job_collaborators`). No action needed.

- **File `0049` was applied as three live rows**: the main body, then
  `last_admin_guard_covers_tier1` and `revoke_anon_execute_auth_can_see_money`, both written back
  into the same file after live verification caught them. The file is the authoritative, complete
  version — re-running it from scratch reproduces the live state.

So: `list_migrations` will never match `ls supabase/migrations` exactly. Compare **schema objects**, not counts.

### Core tables (not exhaustive; read migrations for columns)
- **users** — app profile mirror of `auth.users` (id FK, full_name, email, role_tier→roles_config, active). `guard_last_admin` prevents removing the last admin.
- **roles_config** — tier (1/2/3) → display_name.
- **sites** — 116 site codes (code, name, location, active).
- **jobs** — the central entity. `job_code` (e.g. `BAF-INP-OSS-JUN-001`), `code_tail` (SITE-MON-NNN), status, site_id, `project_id` (nullable), qty/unit, dates, **money columns** (charge_to_site, quote_before_margin, margin, final_quote, actual_cost, profit_loss, pl_percentage — all masked from Tier 1), `deleted_at`. Codes minted by `set_job_code` trigger via `next_job_seq`.
- **jobs_view / projects_view / inventory_items_view** — definer masking views. `projects_view` also derives `job_count`, `completed_job_count`, `quoted_value`, `actual_value` from the project's jobs. **`inventory_low_stock` is a 4th SECURITY DEFINER view** (reorder-level report) — it shows up in the advisors alongside the three masking views.
- **job_quote_/job_actual_ {materials, workforce, consumables, equipment, services}** — worksheet line tables (10 tables). Materials have `part_ref`, `dimension`, `grade`. Equipment/services added in 0034 with own margins. `total_cost` generated columns on equipment/services.
- **job_quotation_summary / job_actual_summary** — computed summary rows.
- **rough_sheet_items / cut_list_plates** (+ `_aggregated` views) — cut lists; grade columns; order‑qty via **nesting** (see BUSINESS LOGIC).
- **suppliers, job_materials, consumables** — procurement. `historic_prices` view aggregates by item+supplier. Consumables and job_materials carry `dimension`/`grade`; consumables carry `job_id`.
- **clients, projects, rfqs** — hierarchy above jobs. `project_code` = `PRJ-YYYY-NNN`.
- **contacts, contact_assignments** — Point of Contact. Unique indexes (0045) prevent duplicate (contact, job/project, role). `job_workforce_contacts` view derives crew from timesheets.
- **documents** — private Storage bucket `documents` + table. Nullable `job_id`, `project_id` (synced by trigger from the job), `welder_certificate_id` (0047). `doc_type` check includes `requisition`, `certificate`.
- **inspection_reports, ncrs, welder_certificates, personnel_transfers, maintenance_records** — QA & records.
- **personnel, equipment, timesheet_entries, equipment_usage** — records module. `personnel` has `site_id`, `user_id` (link to login), `welder_qualification` (labelled "Position" in UI), `qualification_expiry`.
- **inventory_items, inventory_movements** — stock ledger; on‑hand derived by trigger.
- **job_comments** (+ `mentions uuid[]`), **job_watchers, notifications** — collaboration/inbox (0041).
- **audit_log** — append‑only; generic `audit_trigger()` on **44 of the 49 base tables**. Deliberately excluded: `audit_log` itself (would recurse), `job_code_sequences`, `project_code_sequences` (counters), `job_status_events`, `notifications` (already append‑only event logs). A new business table should get the trigger.
- **app_config** — key/value settings (margins, timesheet rates, `inflation_rate_pct`, `bar_length_m`, `section_waste_pct`, `plate_waste_pct`, `cert_expiry_warn_days`, `cert_expiry_notify_email`, company/department names).
- **job_code_sequences / project_code_sequences** — allocator counters. Derive next number from **live** rows (deleted codes free up — 0043).

### Key functions / triggers
- `auth_user_tier()`, `auth_is_admin()` — SECURITY DEFINER, `set search_path=public`, avoid RLS recursion. **EXECUTE not revoked from authenticated** (flagged by advisor but intentional — used inside policies).
- `recompute_job_financials(uuid)` — derives all money from worksheet lines × settings margins; **if a completed/delivered job has no quoted lines, prices from actuals** (0043). `recompute_all_jobs()` for margin changes.
- `next_job_seq` / `next_project_seq` — self‑healing allocators, live rows only.
- `tg_notify_comment` — fans out notifications (mention → named users; else all collaborators minus author; mute suppresses broadcast not mentions).
- `job_collaborators(uuid)` — derives collaborators; **EXECUTE revoked** from all client roles.
- `tg_apply_transfer` — completing a transfer moves the person's site.
- `guard_soft_delete` — only admins may set/clear `deleted_at`.
- `tg_document_sync_project` / `tg_job_project_changed` — keep `documents.project_id` in step with its job.

---

# 6. AUTH & SECURITY

- **Auth:** Supabase email/password. Cookie session refreshed in middleware. `getProfile()` (React‑cached) resolves profile; signs out inactive users. 8‑hour idle logout (`components/layout/inactivity-logout.tsx`, `NEXT_PUBLIC_INACTIVITY_TIMEOUT_MINUTES`).
- **Admin user creation:** `admin_create_user` / `admin_reset_password` RPCs (SECURITY DEFINER). Manually‑created `auth.users` rows must have `''` (not NULL) for `confirmation_token`, `recovery_token`, `email_change`, `email_change_token_new` or GoTrue login fails (see FAILED APPROACHES / migration 0010).
- **Tier gating:** UI via `nav.ts` `minTier` + `requireTier()`; **enforced at DB** via RLS. Money masked via definer views + column grants.
- **The three predicates (0049) — change these together, never one alone:**
  | Question | Database | TypeScript (`lib/types/index.ts`) | True for |
  |---|---|---|---|
  | May they see money? | `auth_can_see_money()` | `canSeeFinancials(tier)` | tiers 1, 3 |
  | Are they an administrator? | `auth_is_admin()` | `isAdmin(tier)` | tiers 1, 3 |
  | May they edit at all? | `auth_user_tier() >= 1` | `canEdit(tier)` | all tiers |
  | May they act inside this job? | `auth_can_act_on_job(job_id)` | — (DB only) | admins anywhere; tier 2 on collaborator jobs |

  The **12 worksheet tables** (`job_quote_*`, `job_actual_*`, both summaries) are pure cost data, so
  their policies use `auth_can_see_money()` — tier 2 cannot read them at all, exactly as tier 1
  could not before. Every other operational table dropped from `>= 2` to `>= 1` so tier 1 is not
  locked out. `import-actions.ts` writes quotation tables, so it follows **money**, not `canEdit`.
- **Residue worth knowing:** `labour_rates` and `equipment` carry rates and are still readable by
  tier 2 (`>= 1`), because timesheets and equipment usage need them. That is unchanged from before
  and was left alone deliberately — tightening it would break tier 2's operational work. Revisit
  with the user if "no financials" is meant to cover trade and machine rates too.
- **RLS soft‑delete rule (critical, learned three times — 0042, then again in 0049):** Postgres checks the *new* row of an UPDATE against SELECT policies. A SELECT policy of `... and deleted_at is null` makes setting `deleted_at` fail its own policy → 0 rows, silent no‑op. Fixed in 0042 by letting admins see deleted rows: `using ((tier>=N and deleted_at is null) or auth_is_admin())`. **0049 hit the same wall giving tier 2 a scoped delete** — the seven job-scoped tables (`documents`, `job_materials`, `consumables`, `handover_items`, `inspection_reports`, `ncrs`, `rfqs`) now also carry `or public.auth_can_act_on_job(job_id)` on SELECT/UPDATE/DELETE, **unqualified by `deleted_at`**, exactly the escape `auth_is_admin()` gets. Verified live: tier 2 soft-deleting on an assigned job affects 1 row; on a foreign job it is refused by name.
- **RLS filtered‑write rule (critical):** a table with RLS enabled but **no SELECT policy** makes every filtered UPDATE/DELETE match 0 rows (Postgres needs SELECT on WHERE columns). Fixed for `jobs`/`projects` in 0039. If a new masked table is added, it needs a SELECT policy too.
- **Secrets:** `.env.local` holds the real secrets and is **never committed** (it is git‑ignored). `.env.example` has names only. Server‑only `SUPABASE_SERVICE_ROLE_KEY` lives only in `.env.local` / the Vercel dashboard and is used solely by admin actions — **it is not in any committed file.**
- **`.env.production` IS committed, deliberately.** It carries only `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_INACTIVITY_TIMEOUT_MINUTES` — all `NEXT_PUBLIC_*`, all shipped to the browser anyway, with RLS as the actual security boundary. Committing it keeps production builds reproducible. **Do not put a service‑role key or any non‑public value in it.** (Note `.gitignore` covers `.env`, `.env.local` and `.env.production.local`, but *not* `.env.production` — that is intentional, not an oversight.)

### Advisor baseline (verified — treat these as the known-good set)
Supabase advisors are checked after every migration. Everything below is **standing and intentional**;
anything *not* on this list is new and must be resolved.

| Advisor | Level | Objects | Why it's accepted |
|---|---|---|---|
| `security_definer_view` | **ERROR** | `jobs_view`, `projects_view`, `inventory_items_view`, `inventory_low_stock` | Definer is the whole mechanism — it's how money is masked from Tier 1. Making these invoker breaks the security model. |
| `authenticated_security_definer_function_executable` | WARN | `auth_user_tier`, `auth_is_admin`, `auth_can_see_money`, `auth_can_act_on_job`, `admin_create_user`, `admin_reset_password`, `dashboard_financial_kpis`, `recompute_job_financials`, `recompute_all_jobs` | All are callable by `authenticated` by design. **Audit-verified: every one guards its own tier internally** (`auth_is_admin()` / `auth_user_tier()` / `role_tier` check in the body). The auth helpers must stay executable — RLS policies call them. |
| `rls_enabled_no_policy` | INFO | `job_code_sequences`, `project_code_sequences` | Counter tables. RLS on + no policy = no client access at all, which is the intent; only definer allocators touch them. |
| `auth_leaked_password_protection` | WARN | Auth config | HaveIBeenPwned check is **disabled**. Not enabled to date — reasonable to turn on in the Supabase dashboard as part of production hardening (see §19 P1). |

`job_collaborators(uuid)` has **EXECUTE revoked** from `authenticated`/`anon` (verified) so it raises no
advisor — which is why `auth_can_act_on_job()` exists: policies run as the caller, so they cannot
call `job_collaborators` directly. `global_search` is SECURITY **INVOKER**, so RLS applies normally.

⚠️ **When adding a SECURITY DEFINER function, revoke EXECUTE from `public, anon` explicitly.** A new
function grants EXECUTE to PUBLIC by default; `auth_can_see_money()` tripped a fresh
`anon_security_definer_function_executable` **ERROR-adjacent WARN** in 0049 until it was revoked.
`create or replace` on an *existing* function keeps its ACL, which is why the older helpers were fine.

---

# 7. ENVIRONMENT VARIABLES

| Variable | Required | Purpose | Used by |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase API URL | client + server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Publishable/anon key | client + server |
| `SUPABASE_SERVICE_ROLE_KEY` | yes (for admin actions) | Bypass RLS for user invites/role changes | server actions only |
| `NEXT_PUBLIC_SITE_URL` | yes | Auth redirects | auth |
| `NEXT_PUBLIC_INACTIVITY_TIMEOUT_MINUTES` | optional (default 480) | Idle logout window | client |

Never print the **service‑role key**. `.env.local` is git‑ignored. The three `NEXT_PUBLIC_*` values are also present in the committed `.env.production` and are public by design (see §6) — the service‑role key is not, and must never be committed.

---

# 8. COMMANDS

```bash
npm install                 # deps (node_modules is not persisted between fresh containers)
npm run dev                 # local dev
npm run build               # production build (also the type/route gate)
npm run start               # serve build
npm run lint                # eslint (next lint)
npm run typecheck           # = tsc --noEmit (script exists; use either form)
npx tsc --noEmit            # PRIMARY type gate — run after every change
```
- **DB migrations:** author `supabase/migrations/NNNN_name.sql` **and** apply live via Supabase MCP `apply_migration` (project id `gxupuxysfhmwdvztabtn`). There is no local supabase stack in this environment.
- **Regenerate types:** Supabase MCP `generate_typescript_types` → write JSON `.types` into `lib/types/database.ts`.
- **Testing:** **No test suite exists.** `tsc --noEmit` + `next build` + live SQL verification probes are the de‑facto tests.

---

# 9. BUSINESS LOGIC (precise)

- **Job codes:** `BAF-{STATUS3}-{SITE}-{MON}-{NNN}`. Status prefixes QTN/INP/COM/DEL/HAL. Separator is **hyphen throughout** (0033; was mixed `/` and `-`). Status change rebuilds the code from `code_tail` (trigger `t30`). `NNN` counts **live** jobs in that site+month, so deleting all frees the numbers (0043/0046).
- **Project codes:** `PRJ-YYYY-NNN`, same live‑only rule.
- **Worksheet financials (`recompute_job_financials`):** `quote_before_margin = Σ(material+workforce+consumables+equipment+services quoted)`; `final_quote = Σ(section_subtotal × (1+section_margin/100))` with **five independent margins** in `app_config` (material/workforce/consumables/equipment/services; equipment & services default to material margin). `actual_cost = Σ actual sections`. `profit_loss = final_quote − actual_cost`. **If no quoted lines and status ∈ {completed,delivered}, quote is derived from actuals** section‑by‑section (0043).
- **Section order qty (rough sheet):** **nesting**, not area×waste. Pieces per bar = `floor(bar_length_m / length_m)`; each piece consumes `1/pieces_per_bar` of a bar; sum + ceil. Oversize/lengthless rows fall back to `total_length/bar × (1+section_waste%)`. (0044; earlier the formula had a bogus `×2` and rounded exact fits up.)
- **Plate sheets required:** pieces‑per‑sheet nesting (best of both orientations) + `plate_sheet_area()` parse of "A x B" size; oversize falls back to area×waste (0032/0043). Plate order list also shows in‑stock match by thickness+grade.
- **Tentative quoting:** re‑prices MTO from `historic_prices`, **aged forward by `inflation_rate_pct`/yr pro‑rata to price age**; prices <30 days old used as‑is (0035).
- **Timesheet costing:** each person costed at their **trade's** `labour_rates` normal/OT rate; the single `timesheet_normal_rate`/`_ot_rate` in settings are fallbacks only (0035). Job description/site/ref autofill from the selected job, never overwriting hand‑typed values.
- **Notifications:** comment with `@mentions` → only mentioned users; no mentions → all collaborators (creator + commenters + timesheet‑with‑login + explicit watchers) minus author. Mute suppresses broadcasts but not mentions.
- **Welder certificate expiry:** `cert_expiry_warn_days` (default 7) window; expiring rows get a `mailto:` renewal/expiry draft. Certificates carry scanned documents via `documents.welder_certificate_id` (shared, not copied).
- **Margin toggle (Quotation tab, 0048 round):** a **display-only** switch. Off = every section shows its cost base and the summary reads "Cost before margin". Nothing is written and `recompute_job_financials` is untouched, so the regression invariant holds. Do not wire this to stored financials without revisiting §17.
- **Quotation → Actual transfer:** `copyQuoteToActual` copies all five sections and **replaces** the Actual side (the UI confirms first), then recomputes once. Destination-only columns (`from_stock`, `inventory_item_id`) are omitted from the copy so they take their defaults.
- **In-stock actual material (0048):** `job_actual_materials.from_stock` + `inventory_item_id`. Picking a stock item prices the line at the item's carried `unit_cost` (only when the cell is still empty, so a typed figure is never overwritten) and implies `from_stock`; unticking clears the item. The Actual tab shows an **Actual vs Quoted** table per section with the stock-drawn share called out. Quotation lines deliberately have no such columns — a quote is a price regardless of where the steel later comes from.

---

# 10. STATUS / STATE MACHINES

- **Job status:** quotation → in_progress → completed → delivered, plus **halt** (any). Code prefix follows status. Set via `JobStatusControl`; emits `job_status_events` (realtime, finance‑free).
- **Project status:** rfq, quoted, won, in_fabrication, qa, dispatch, installed, closed, lost.
- **Personnel transfer:** requested → approved → completed (moves the person by trigger) | rejected | cancelled.
- **NCR:** open → in_progress → closed. **Inspection result:** pass/fail/conditional.

---

# 11. FEATURE MATRIX

| Feature | Status | Location | Notes |
|---|---|---|---|
| Auth / 3 tiers / idle logout | COMPLETE | lib/auth, middleware | |
| Dashboard KPIs + charts | COMPLETE | dashboard/, dashboard-charts | Finance hidden Tier 1 |
| Jobs register + delete | COMPLETE | jobs/ | admin delete (0039/0042) |
| Worksheet (quote/actual/tentative/analytics) | COMPLETE | jobs/[id]/worksheet | 5 cost sections incl. equipment/services; part grouping |
| Rough sheet / cut lists + nesting + stock | COMPLETE | jobs/[id]/roughsheet | 0032/0043/0044 |
| Quotation/Timesheet/Equipment PDF | COMPLETE | components/pdf | quotation = price‑only |
| Projects (full‑page create, rollups, dedup) | COMPLETE | projects/ | |
| Point of Contact + Sites link | COMPLETE | contacts/, sites/ | dedup 0045 |
| Documents (group modes, multi‑file, open‑in‑browser, cert link) | COMPLETE | documents/ | 0047 |
| Procurement (grouped + draft email) + Suppliers + Historic | COMPLETE | procurement/ | |
| Consumables (job link + grouping) | COMPLETE | consumables/, procurement | |
| Inventory + movements ledger | COMPLETE | inventory/ | |
| QA: Inspections, NCRs, Welder Certificates | COMPLETE | qa/ | |
| Handover + transfer notice draft | COMPLETE | handover/ | |
| Records: timesheet, equipment, maintenance, transfers, master lists | COMPLETE | records/ | |
| In‑app notifications + @mentions + watch | COMPLETE | notification-bell, comments-thread | in‑app only |
| Margin on/off toggle (Quotation) | COMPLETE | worksheet-panels | display only, nothing written |
| Quotation → Actual transfer | COMPLETE | worksheet/actions `copyQuoteToActual` | replaces Actual, confirms first |
| In-stock actual material + Actual vs Quoted | COMPLETE | worksheet-panels, 0048 | `from_stock` + `inventory_item_id` |
| Delete: Contacts / Sites / Labour Rates | COMPLETE | contacts, sites, settings actions | admin-only, in-use guards |
| Tentative → Quotation re-pricing | COMPLETE | tentative-panel, `applyTentativeToQuote` | name match; unmatched lines untouched |
| Re-cut tier model (T2 restricted) | COMPLETE | 0049 + `lib/types/index.ts` | see §6 predicate table |
| Resizable table columns | COMPLETE | ui/table + use-resizable-columns | localStorage per table |
| Global search | COMPLETE | search/ | `global_search` RPC, SECURITY INVOKER |
| Email sending | NOT PLANNED | — | mailto: drafts only, by decision |
| Automated tests | NOT STARTED | — | none |

---

# 12. DESIGN DECISIONS (with reasons)

- **Masking views over row‑level money hiding:** column‑masking definer views keep `select *` working while nulling money for Tier 1. Column GRANTs alone break `select=*`; hence views. Reversal: moderate.
- **Server actions re‑validate with zod even though forms validate client‑side:** never trust the client. Cheap. Keep.
- **`mailto:` drafts, never sending:** original "no AI, data‑tool only" + no outbound mail infra; keeps everything auditable in the user's own sent items. In‑app notifications chosen over email by explicit user pick this session.
- **Nesting for order quantities:** waste‑factor math rounds exact fits up and (historically) had a `×2`; nesting matches how the shop actually cuts. Waste factors kept as settings for the fallback path.
- **Codes count live rows only:** so a register emptied during testing restarts at 001; partial unique indexes allow reissue after delete.
- **Notifications in‑app, collaborators derived:** avoids a second list to maintain; PoC contacts are *not* logins so they aren't notified unless linked via `personnel.user_id`.
- **One migration per logical change, applied live immediately, then regenerate types:** keeps DB and code in lockstep; every migration file mirrors what's live.

---

# 13. FAILED APPROACHES / DO NOT REPEAT

1. **@supabase/ssr 0.5.x with supabase-js 2.107** → `.from()` resolved to `never`, cookie types broke. **Fix:** upgrade ssr to 0.10.3. Don't downgrade.
2. **Exporting non‑async consts from a `"use server"` file** (e.g. `export const BUCKET`) → build error. **Fix:** put constants in a normal module (`lib/storage.ts`).
3. **`type: "hidden"` FieldDef** — `RecordFormDialog`'s `FieldDef` supports only text/number/date/select. Pass hidden ids via the `onSubmit` closure, not a hidden field.
4. **Assuming a write "worked" because no exception was thrown** — RLS silently returns 0 rows. **Always assert `rows affected` in verification probes**, not just absence of error. (This masked the soft‑delete and filtered‑write bugs for a whole round.)
5. **Renumbering `code_tail` with the `t30_update_code_status` trigger enabled** — it pins `code_tail` to the old value on UPDATE and silently reverts. Disable the trigger around a bulk renumber (0046 does this).
6. **Regex `\p{...}`/`u` flag in client TS** — fails under the project's TS target. Use ASCII classes (`\w`) in the mention regex.
7. **cytoscape graph explorer** — built then removed this session (unused on the floor; PoC tab replaced its value). Don't re‑add.

---

# 14. BUGS

### RESOLVED (this project)
- Login "invalid" — NULL GoTrue token columns (0010) and free‑tier auto‑pause (restore project).
- Code allocators handed out duplicates / drifted counters (0029, then 0043 live‑only).
- `jobs`/`projects` had no SELECT policy → all filtered writes were silent no‑ops for everyone (0039).
- **Soft delete impossible on 7 tables** (documents, job_materials, consumables, ncrs, inspection_reports, rfqs, handover_items) — SELECT policy `deleted_at is null` rejected the delete (0042).
- Plate/section order qty wrong (`×2`, exact‑fit rounding) (0032/0043/0044).
- PoC duplicate contact on job + its project (0045 unique indexes + view dedup).
- `requisition` doc_type in app but not in DB check constraint → insert failure (fixed 0047).
- Column SELECT permission denied on masked tables for updates (0031).
- **Saving a worksheet section that mixed saved and new rows failed with `null value in column "id" … violates not-null constraint`** (Changes I item 6). Not a DB fault — every line table has `gen_random_uuid()`. PostgREST builds one INSERT for a batch from the **union of the objects' keys**, so a batch containing any row with an `id` sent `id => NULL` for the rows without one instead of falling back to the default. Fixed by minting the id server-side in `replaceJobLines` so every object has the same shape. Reproduced and re-verified live. **Watch for this in any other multi-row upsert.**
- **Contacts, Sites and Labour Rates could only be deactivated, never deleted** (Changes I item 1). The DB policies (`con_del`, `sites_admin_del`, `lr_admin_del`) had existed all along — the server actions and buttons were simply missing. Added, admin-only, with in-use guards.

### OPEN / KNOWN
- None tracked as blocking. Working tree clean, build green as of `732a36e`.

### POTENTIAL / WATCH
- **Free‑tier Supabase** will keep auto‑pausing and may hit storage/row limits with real use — flagged repeatedly as a **pre‑production prerequisite to upgrade to Pro**. NEEDS the user's action. (Project was `ACTIVE_HEALTHY` at the audit pass.)
- ~~`@tanstack/react-table` may be dead weight~~ — **verified unused and removed.**
- README is stale: still says "Industrial‑utilitarian dark UI" and "Projects & **Clients**". Confirmed, low impact.
- Leaked‑password protection is off in Supabase Auth (see §6 advisor baseline).

---

# 15. SESSION HISTORY (reconstructed; commit‑anchored)

The app was largely built across earlier sessions (steps 1–8: suppliers, inventory, documents, clients/projects/rfqs, QA, import, search, graph — commits up to `75a444d`). **This session** executed several dated `Changes*.md` request batches. Exact intra‑batch order is captured by commits:

- `6ae669d` Rename Clients→Point of Contact, fold Users into Settings, remove Graph.
- `df7e305` Rebuild Projects around jobs (full‑page create, rollups); self‑healing code allocators.
- `5b780a3` Jobs: centred headers, grade/dimension columns, price‑only quotation PDF.
- `eb1557f` Documents: project→job grouping, view modes, open in browser.
- `b1012a8` Procurement: group by project/job + per‑job material request draft.
- `f73150c` Dashboard graphs + handover transfer notice draft.
- `16a06e9` Fix blocked writes, plate nesting, comment deletion, job‑code hyphens.
- `48d5967` Worksheet part‑level lines, equipment charges, service charges.
- `99393b1` Inflation‑aged historic prices; per‑trade timesheet rates.
- `8cab4a0` Procurement dimensions; trimmed enquiry draft; consumables/handover job links.
- `9eed254` Fix silent no‑op writes; welder certificates; transfers; job delete.
- `9a39405` Job collaborators, @mentions, in‑app notification inbox.
- `b856cd4` Fix soft delete everywhere; drop ×2 on section orders; Changes II (codes restart, multi‑file upload, requisition type, cert reminder setting, timesheet autofill, resizable columns, quote‑from‑actual, PoC dedup).
- `732a36e` Welder‑certificate documents shared with Documents (no copy); fix requisition constraint.

Live DB was also **renumbered/cleaned** (0046 + manual): user emptied jobs/projects for a fresh start; current live state had 1 job renumbered to `-001` and 1 project `PRJ-2026-001` at that point.

---

# 16. INSTRUCTIONS FOR THE NEXT CLAUDE SESSION

1. **Read this file fully**, then verify against the repo — do not trust it blindly.
2. **Startup procedure:**
   - `git status` (expect clean) and `git log --oneline -10`. **Take the branch name from `git status`/your session assignment — this file does not pin one.**
   - `ls supabase/migrations | tail` to see the latest migration number. Expect it to disagree with `list_migrations` by design — see §5.
   - If Supabase calls fail with 401/paused: the free project is paused — restore it (MCP `restore_project` or dashboard) before doing DB work.
   - `npm install` if `node_modules` is missing (fresh container).
3. **Working method that this project expects:**
   - The user drives work by uploading a dated `Changes_*.md`. For each item: **reproduce the reported behaviour against the live DB first** (write a guarded SQL probe that asserts *rows affected*, cleans up its own `ZZ`‑prefixed test data, and restores state). Many "I can't delete/add" reports are RLS policy bugs, not UI bugs.
   - Make the change: new migration file(s) **+ apply live + regenerate `lib/types/database.ts`**; UI/action code; `npx tsc --noEmit`; `npm run build`; live verification probe; commit per logical group; push to the branch.
   - **Commit messages:** end with the two trailer lines the environment requires (Co‑Authored‑By + Claude‑Session). Author is set to `Claude`/`noreply@anthropic.com` in this environment.
4. **Never:** add AI/LLM calls; send real email; expose money to Tier 1; commit secrets; push to another branch; break the masking‑view/RLS model; re‑add cytoscape.
5. **After any material change, update this CONTINUATION.md** (the changed section + Quick Start + machine‑readable block). Keep edits minimal.

---

# 17. DO NOT CHANGE WITHOUT DISCUSSING

- The 3‑tier model and DB‑level money masking (views + grants + policies).
- `recompute_job_financials` formula & the five margins (regression‑critical).
- Job/project code format and the live‑only allocator logic.
- `components/ui/table.tsx` behaviour (centred cells, resizable columns) — app‑wide.
- The "no AI / mailto‑only / in‑app‑notifications‑only" product constraints.
- The `guard_soft_delete` admin‑only delete rule and the soft‑delete SELECT‑policy pattern (0042).

---

# 18. TECHNICAL DEBT / RISK

| Item | Severity | Note |
|---|---|---|
| No automated tests | HIGH | Only tsc/build/manual SQL. Regressions rely on discipline. |
| Free‑tier Supabase | HIGH (ops) | Auto‑pause + limits; upgrade before production. |
| `lib/types/database.ts` manual regen | MEDIUM | Easy to forget after a migration → type drift. Always regen. |
| README stale (Clients/dark theme) | LOW | Cosmetic. Confirmed stale at the audit pass. |
| Migration files ≠ live migration history | LOW | Bookkeeping only, schema verified in sync. See §5. |
| Many `any` casts in page files (`/* eslint-disable @typescript-eslint/no-explicit-any */`) | LOW | Pragmatic around generated types. |

---

# 19. NEXT ACTIONS

- **P0 — none pending.** No uncommitted work, no open bug. Await the next `Changes.md`, or confirm acceptance testing.
- **P1:** If moving toward production — upgrade Supabase to Pro; enable leaked‑password protection in Auth; add a minimal smoke test (auth + one write per module); reconcile README with current features (PoC rename, light theme, new modules).
- **P2:** Consider a real notifications page (currently bell‑only); optional welder‑certificate scheduled expiry emails (needs the email decision revisited); consider deleting the now‑dead `app/(app)/clients/page.tsx` redirect and `components/projects/clients-manager.tsx` if nothing links to them.
- **P3:** Broader test coverage; performance review of dashboard/rollup queries at real data volume.

### Changes I (12/08/2026) — CLOSED

All six items delivered. Items 2 and 5(b) were settled by the user after the questions below were
put to them; both answers are recorded here because the reasoning still matters.

- **Item 2 — role model.** Confirmed: tiers 1 and 3 both get everything, tier 2 is the only
  restricted tier, and "assigned" reuses `job_collaborators()` rather than a new assignment table.
  Implemented in **0049** (see §6 for the predicate table). The original wording and the risks are
  kept below since they explain why the change is shaped the way it is.
- **Item 5(b) — quotation → tentative.** Confirmed: what was wanted is the **reverse** direction —
  push the re-priced historic figures **back into** the quoted lines. Implemented as
  `applyTentativeToQuote`, matching on item name, leaving unmatched lines untouched.

<details>
<summary>Original open-questions write-up (kept for context)</summary>

**Item 2 — role model.** As written: Tier 1 "exclusive access to everything", Tier 2 "full
operational edit, can't see financials, can delete within assigned project/job", Tier 3
"exclusive access to everything". This is **not** a tweak to the current model, it inverts it:

- Today money is revealed by `auth_user_tier() >= 2` in the three masking views. The request makes
  **Tier 2 the only tier without financials**, so the predicate becomes roughly `tier <> 2`. That
  touches `jobs_view`, `projects_view`, `inventory_items_view`, the column grants, and every
  `showMoney`/`canSeeFinancials` call site. §17 says do not change this without discussing.
- Tier 1 and Tier 3 would become **identical**, which is worth confirming before building.
- "delete within assigned project/job" has **no schema representation** — there is no user↔job or
  user↔project assignment table. `job_collaborators()` derives something similar (creator,
  commenters, timesheet-linked staff, watchers) and could serve, or a real assignment table could
  be added. This must be settled before the delete policies can be written.

**Item 5(b) — quotation → tentative.** Tentative is a read-only estimator that **already**
auto-derives from the quote's Material and Consumable lines and re-prices them from
`historic_prices`. There is nothing to "transfer". The plausible real asks are: extend it to the
other three sections (workforce/equipment/services — none of which have procurement history), or
push its re-priced figures **back into** the quotation as unit costs. Needs the user to say which.

</details>

**EXACT NEXT STEP:** Await the next `Changes_*.md`. Do not start speculative refactors. If the role
model comes up again, read §6's predicate table first — the tier numbering is deliberately *not*
"higher = more access" any more.

---

# 20. MACHINE‑READABLE STATE

```yaml
project:
  name: Fabrication Job Book (BAF Workshop Steel Fabrication, Six Construct/Besix)
  status: functional; feature-complete against all Changes.md rounds to date
  stack:
    framework: Next.js 14.2.18 (App Router, TS)
    db: Supabase Postgres (ref gxupuxysfhmwdvztabtn, free tier, ap-south-1)
    auth: Supabase email/password, 3 tiers, RLS + masking views
    ui: Tailwind + shadcn/ui (Radix), light "match-Excel" theme
    pdf: "@react-pdf/renderer"; charts: recharts; import: exceljs + hand DSTV
  constraints:
    - no AI/LLM calls in app
    - email = mailto drafts only; notifications in-app only
    - money masked from Tier 2 at DB level (re-cut in 0049; tiers 1 and 3 are peers)
repository:
  branch: per-session — read from `git status`, not from this file
  branch_history: [claude/busy-mccarthy-W0FZV (through 732a36e), claude/continuation-md-validation-0anxqi (audit pass)]
  clean: true
  head: 732a36e + CONTINUATION.md audit commits
  migrations:
    files: 0001..0049 (49 in repo)
    live_history_rows: 52
    in_sync: true   # schema verified object-by-object; counts differ by design, see section 5
  tests: none
  gates_verified: [tsc --noEmit clean, next build green]
regression_invariant: recompute_job_financials must not change existing job quotes
issues:
  blocking: []
  watch:
    - free-tier auto-pause/limits
    - manual database.ts regen
    - stale README (dark UI / Clients)
    - leaked-password protection disabled in Supabase Auth
    - migration files vs live history counts differ (bookkeeping only)
next_action:
  priority: P0
  task: await next Changes.md; reproduce each reported bug against live DB before fixing
maintenance:
  keep_this_file_updated: true
  update_when: [new migration, new/changed feature, new/resolved bug, changed decision]
  also_update: [CLAUDE QUICK START, this MACHINE-READABLE STATE block]
```
