# FabricationUnified — Repository Review

**Reviewed:** 12/08/2026 at commit `fae13f8` · **Fixes applied:** 13/08/2026 · **Method:** static
review plus a live end‑to‑end run against the Supabase project (`gxupuxysfhmwdvztabtn`), executed as
the `authenticated` role with JWT claims set, so RLS policies, triggers and code allocators were
genuinely exercised rather than bypassed as superuser. Test data was created, followed through every
tab, then removed; the database was verified back to its exact pre‑test counts.

Every item on the original priority list has now been applied except the one that cannot be done from
here — see §6.

---

## 1. Overall Status

The system is **functional and internally consistent at the data layer**. The financial engine,
inventory ledger, code allocators, soft‑delete filtering, tier masking and search were each verified
against real data and produced arithmetically correct results.

At review time two defects made parts of the app **unusable in production**, and both came from the
same root cause: migration 0049 re‑cut the tier model (tier 1 became a full‑access administrator,
tier 2 became the restricted tier) and the sweep updated RLS policies and the TypeScript predicates
but **not** the places that compare tier numerically or that were written before the change. One
locked a whole role out of five routes; the other broke a button on three tabs. **Both are fixed and
verified** — the tier gate now resolves through named predicates, and the generated‑column write is
gone.

The safety net has also been repaired: lint runs clean instead of erroring out, a CI workflow runs
types + lint + tests on every push, and a smoke‑test suite guards the two defects specifically so
neither can return silently.

Gates: `tsc --noEmit` exit 0 · `next lint` clean · `npm test` 6/6 · `next build` compiles all 23 routes.

---

## 2. Working

Verified by execution, not by reading code.

**Financial engine — verified arithmetically.** A sample job with five populated cost sections
produced subtotals material 21,740 / workforce 11,600 / consumables 1,360 / equipment 2,400 /
services 5,100. Quote‑before‑margin came to **42,200** and final quote to **47,000**, both matching an
independently computed expectation, with the five section margins (10/15/10/10/10) applied
individually and a correct blended ratio of 0.1137. After entering actuals, `actual_cost` 44,832,
`profit_loss` 2,168 and `pl_percentage` 0.0461 were all correct.

**Code allocators.** Project minted `PRJ-2026-002` and job minted `BAF-INP-AP4-AUG-002` — correct
site, month and sequence. Changing status to `completed` rebuilt the code to `BAF-COM-AP4-AUG-002`
while preserving `code_tail`, and reverting restored the original.

**Inventory ↔ worksheet.** A stock item received 50, then a worksheet material line marked *In Stock*
raised an issue movement of −20; on‑hand read **30**. `quantity_on_hand` is fully derived from the
movement ledger.

**Rough sheet nesting.** 20 pieces × 2.4 m against 6 m bars returned `order_qty` **10** (2 pieces per
bar), correctly beating the naive 48 ÷ 6 = 8.

**Tier‑2 restriction (data layer).** As tier 2: job visible, `final_quote` returned NULL, worksheet
rows 0, while procurement lines and notes remained visible. Money masking works as designed.

**Cross‑tab data flow.** `projects_view` rolled the job up (job_count 1, quoted 47,000, actual
44,832); the dashboard RPC returned a correct portfolio P&L of 3,745 (1,577 + 2,168) and picked up
consumables at 1,012; a document attached to a job had `project_id` backfilled by trigger; a timesheet
entry surfaced in `job_workforce_contacts`; search found the new records across Document, Job, NCR,
Note, Project and Stock.

**Soft‑delete filtering.** Deleting one of three procurement lines left two visible.

**Generated columns.** `total_price`, `total_cost`, `total_hours`, `month_year`, `order_qty` all
compute correctly and the `CHILD_TABLES` write whitelist correctly excludes them.

**Job Material Request (re‑verified after the fix).** The action's exact column set now inserts
cleanly and Postgres computes `total_price` itself — 12 × 25 returned **300.00**.

**Project‑level documents (new).** A document filed against a project with no job keeps its
`project_id`; `tg_document_sync_project` only overwrites when a job is given, so the two paths do not
fight.

---

## 3. Issues Found — and what was done

### 3.1 Tier 1 was locked out of five routes — **fixed**
`sidebar.tsx` filtered with `tier >= i.minTier` and `requireTier()` redirected when
`role_tier < min`. Both assumed higher tier = more access. Since 0049 tier 1 is a full‑access
administrator, but numerically it is the lowest, so it lost 4 nav items and 5 routes — including the
ability to create a project — while the database granted it full administrative rights.

Access is now **named, not numeric**. `lib/types` gained `AccessLevel` (`"all"` / `"money"` /
`"admin"`) and `hasAccess()`, which resolves through the existing `isAdmin()` / `canSeeFinancials()`
predicates. `NavItem.minTier` became `NavItem.access`; `requireTier(min)` became
`requireAccess(level)`. `/sites` and `/settings` are `admin`; `/procurement`, `/records` and
`/projects/new` are `all`.

| | Tier 1 | Tier 2 | Tier 3 |
|---|---|---|---|
| Nav items hidden — before | 4 | 2 | 0 |
| Nav items hidden — after | **0** | 2 (`/sites`, `/settings`) | **0** |

### 3.2 "Job Material Request" failed 100% of the time — **fixed**
`copyWorksheetToProcurement` inserted `total_price` into `job_materials`, but that column is
`GENERATED ALWAYS`, so Postgres rejected the statement outright
(`cannot insert a non-DEFAULT value into column "total_price"`), breaking the button on all three
worksheet tabs. The two lines are gone. Verified live with the action's exact column set.

### 3.3 Procurement grouped view was read‑only — **fixed**
The default view (`group=project`) had no inputs at all, so suppliers, PR/LPO numbers and order or
delivery dates could only be set by switching to the flat view. Supplier (select), PR, LPO, Ordered
and Delivered are now editable inline, backed by a new narrow action `updateProcurementLine`, which
writes **only the keys it is handed** — editing one cell cannot blank its neighbours — and keeps the
legacy free‑text `supplier` column in step with `supplier_id`. Text cells commit on blur or Enter, so
one edit is one write. A supplier that has since been deactivated still renders on its row rather
than silently reading as unassigned.

### 3.4 Equipment usage disconnected from jobs — **decided and labelled**
`equipment_usage` has no `job_id` and no hours column; it records a daily status code per machine,
costed at that machine's bare and driver rates. Worksheet equipment charges are a separate, per‑job
figure. Linking them would be a schema and workflow change, not a bug fix, so the split is now
**explicit** rather than implied: both the worksheet Equipment Charges panel and the Personnel &
Equipment usage register carry a line saying the two registers are independent and are not expected
to reconcile.

### 3.5 Documents could not be filed against a project — **fixed**
`registerDocument` now accepts `project_id`, the upload dialog offers a Project select whenever no
job is chosen, and the Projects › Documents sub‑tab has its own Upload button. When a job *is*
chosen the project is left to the trigger, so the two can never contradict each other.

### 3.6 Point of Contact "Project Based" links — **fixed**
`app/(app)/contacts/page.tsx` hardcoded `href: "/projects"` behind a stale comment. Now
`/projects/${p.id}`.

### 3.7 Lint gate non‑functional — **fixed**
`.eslintrc.json` extended only `next/core-web-vitals`, which never registers the
`@typescript-eslint` plugin, so the `/* eslint-disable @typescript-eslint/no-explicit-any */` pragmas
in 11 files referenced an unknown rule and `npm run lint` exited 1 **without linting anything**.
Config now extends `next/typescript` as well. That surfaced 12 genuine findings (unused imports and
bindings across seven files) — all removed. Lint is clean.

`ignoreDuringBuilds` stays true, and the comment beside it is now true as well: types, lint and tests
run as their own CI job rather than inside a deploy build.

### 3.8 No automated tests — **fixed (smoke level)**
`tests/` runs on `node --test` with native TypeScript stripping — **no new dependencies**.

- `access.test.mts` — the tier predicates, and that every administrator tier sees every nav item.
  This test fails on the exact code that caused §3.1.
- `generated-columns.test.mts` — scans every server‑action module for object‑literal writes to a
  `GENERATED ALWAYS` column. Confirmed by negative control: re‑introducing a `total_price:` write
  fails the suite with the file and line.

`npm test` runs them; `npm run check` runs typecheck + lint + tests together;
`.github/workflows/ci.yml` runs all three on every push and pull request.

### 3.9 Unbounded list queries — **fixed (disclosure, not pagination)**
Capped queries returned silently truncated lists. The main lists now request PostgREST's exact count
alongside the capped page and render `CapNotice` — *"Showing the first 2,000 of 5,140 records"* —
when, and only when, the cap actually bit. Applied to Jobs, Documents, Procurement (job materials and
historic prices), Inventory movements, QA inspections and NCRs, and Maintenance. Full pagination is
still the eventual answer; this removes the silent part, which was the actual risk.

Queries feeding dropdowns and lookup maps are deliberately left alone — truncation there is not
user‑visible data.

### 3.10 `rfqs` dead in the app — **fixed**
The `Rfq` type alias and `RFQ_STATUSES` were unreferenced anywhere in the app. Both removed. The
table itself is empty (0 rows) and has been left in place — dropping it is a schema decision, not a
code cleanup, and nothing depends on it either way.

---

## 4. Remaining Improvements

1. **Full pagination** on the capped list queries. §3.9 makes truncation visible; it does not yet let
   the user page past it.
2. **Widen the test suite.** The two smoke tests cover the two defects that actually shipped. Auth
   flow, one write per module and the recompute invariant are the obvious next targets.
3. **Decide whether equipment usage should ever attribute to a job.** §3.4 documents the split
   honestly, but if the shop wants machine time to reconcile against worksheet charges, that is a
   schema change worth scoping properly.
4. **Drop or build out `rfqs`.** The table is empty and unreferenced.

---

## 5. End-to-End Test Result

**Result: completed successfully, with two blocking defects found en route — both since fixed.**

Sample data created through the RLS path:

- **Project** `PRJ-2026-002` — "Dubai Metro Blue Line — Pipe Rack Steelwork", site AP4,
  status `in_fabrication`, contract value 850,000.
- **Job** `BAF-INP-AP4-AUG-002` — "Fabrication of Pipe Rack Modules PR-01 to PR-06", 6 modules,
  linked to the project.

| Stage | Result |
|---|---|
| Project → job creation, code allocation | Pass |
| Worksheet quote, 5 sections, margins | Pass — 42,200 → 47,000 verified independently |
| Quote → actual, variance and P&L | Pass — 44,832 actual, 2,168 P&L, 4.61% |
| In‑stock material → inventory issue | Pass — 50 − 20 = 30 on hand |
| Job Material Request → Procurement | Fail at review (§3.2) → **Pass after fix**, total 300.00 |
| Rough sheet / cut list nesting | Pass — order_qty 10 |
| Notes, timesheet, handover, contacts | Pass |
| QA inspection + NCR | Pass |
| Document upload → project backfill | Pass — trigger set `project_id` |
| Project‑level document (no job) | **Pass** — added in this round |
| Inline procurement edit (supplier / PR / LPO / dates) | **Pass** — added in this round |
| Project roll‑ups | Pass — 1 job, quoted 47,000, actual 44,832 |
| Dashboard KPIs | Pass — P&L 3,745, consumables 1,012 |
| Universal search | Pass — 6 hits across 6 kinds |
| Soft delete → list refresh | Pass — 3 → 2 |
| Tier‑2 masking on live job | Pass — money NULL, worksheet 0 rows |
| Status change → code rebuild | Pass — INP → COM → INP |

**Testing note:** several probes ran inside transactions deliberately rolled back to print results.
Behaviour observed before rollback is valid, but the rows did not persist; an apparent "dashboard
consumables = 0" was that artifact, not a defect, and was re‑tested with persisted data (1,012).

**Cleanup:** all test rows removed, both in the original run and in the post‑fix verification.
Post‑test counts match pre‑test exactly (6 job_materials, 6 documents; leftover test rows 0). The
pre‑existing job `BAF-INP-AP4-AUG-001` still reads 15,770 / 17,347 / 0.1000 / 1,577 — unchanged.

---

## 6. Priority Fix List — status

| # | Priority | Item | Status |
|---|---|---|---|
| 1 | Critical | Tier 1 locked out of 5 routes and 4 nav items (§3.1) | **Applied** |
| 2 | Critical | Job Material Request broken on all three worksheet tabs (§3.2) | **Applied** |
| 3 | High | Procurement grouped view read‑only (§3.3) | **Applied** |
| 4 | High | Lint gate non‑functional, no CI, no tests (§3.7, §3.8) | **Applied** |
| 5 | Medium | Equipment usage disconnected from jobs (§3.4) | **Applied** — labelled as independent by decision |
| 6 | Medium | Documents cannot be filed against a project (§3.5) | **Applied** |
| 7 | Medium | Point of Contact "Project Based" dead‑end links (§3.6) | **Applied** |
| 8 | Medium | Numeric tier comparisons app‑wide | **Applied** — none remain |
| 9 | Low | Unbounded list queries without pagination (§3.9) | **Applied** — truncation now disclosed |
| 10 | Low | Leaked‑password protection disabled in Supabase Auth | **Outstanding — needs you** |
| 11 | Low | `rfqs` dead in the app (§3.10) | **Applied** — dead types removed |

### The one item that cannot be done from here

**Leaked‑password protection** is an Auth service setting, not schema and not application code. It
lives behind the Supabase Management API, which this environment has no token for, and the database
connection available here cannot reach it. It takes about ten seconds in the dashboard:

> Authentication → Providers → Email → **Leaked password protection** → enable

Once enabled, Supabase checks new and changed passwords against HaveIBeenPwned. Nothing in the
codebase needs to change for it to take effect.

### Advisor notes (reviewed, no action needed)

The Supabase security advisor also reports the four `SECURITY DEFINER` views and the
`auth_*` / `recompute_*` / `admin_*` definer functions. Both are deliberate: the definer views *are*
the money‑masking mechanism (0054 revoked `anon` on them), and the definer functions are the intended
RPC surface, each carrying its own tier guard internally. `job_code_sequences` and
`project_code_sequences` have RLS on with no policies, which is correct — they are written only by
`SECURITY DEFINER` allocators and nothing else may touch them.
