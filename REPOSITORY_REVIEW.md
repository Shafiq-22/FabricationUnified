# FabricationUnified — Repository Review

**Date:** 12/08/2026 · **Commit reviewed:** `fae13f8` · **Method:** static review plus a live end‑to‑end
run against the Supabase project (`gxupuxysfhmwdvztabtn`), executed as the `authenticated` role with
JWT claims set, so RLS policies, triggers and code allocators were genuinely exercised rather than
bypassed as superuser. Test data was created, followed through every tab, then removed; the database
was verified back to its exact pre‑test counts.

---

## 1. Overall Status

The system is **functional and internally consistent at the data layer**. The financial engine,
inventory ledger, code allocators, soft‑delete filtering, tier masking and search were each verified
against real data and produced arithmetically correct results.

Two defects make parts of the app **unusable in production today**, and both come from the same root
cause: migration 0049 re‑cut the tier model (tier 1 became a full‑access administrator, tier 2 became
the restricted tier) and the sweep updated RLS policies and the TypeScript predicates but **not** the
places that compare tier numerically or that were written before the change. One of these locks a
whole role out of five routes; the other breaks a button on three tabs.

Build and type gates are clean (`tsc --noEmit` exit 0, `next build` compiles all 16 routes). The lint
gate is non‑functional and has been providing no coverage.

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

**Soft‑delete filtering.** Deleting one of three procurement lines left two visible — the fix applied
earlier this round holds.

**Generated columns.** `total_price`, `total_cost`, `total_hours`, `month_year`, `order_qty` all
compute correctly and the `CHILD_TABLES` write whitelist correctly excludes them.

---

## 3. Issues / Not Working

### 3.1 Tier 1 is locked out of five routes — **not working**
`sidebar.tsx:15` filters with `tier >= i.minTier` and `requireTier()` redirects when
`role_tier < min`. Both assume higher tier = more access. Since 0049, tier 1 is a full‑access
administrator, but numerically it is the lowest.

| | Tier 1 | Tier 2 | Tier 3 |
|---|---|---|---|
| Nav items hidden | **4** (`/procurement`, `/records`, `/sites`, `/settings`) | 2 | 0 |
| Routes redirected | **5** (+ `/projects/new`) | 2 | 0 |

A tier‑1 user cannot open Settings, Sites, Procurement or Personnel & Equipment, and **cannot create a
project**, while the database grants them full administrative rights (`auth_is_admin()` returns true
for tiers 1 and 3). The UI and the database disagree completely for this role.

### 3.2 "Job Material Request" fails 100% of the time — **not working**
`app/(app)/jobs/[id]/worksheet/actions.ts:387` inserts `total_price` into `job_materials`, but that
column is `GENERATED ALWAYS`. Postgres rejects the insert:

```
cannot insert a non-DEFAULT value into column "total_price"
```

Reproduced with the action's exact column set; the same insert without `total_price` succeeds and the
generated total computes correctly (200.00). This breaks the button on **all three** worksheet tabs
(Quotation, Actual, Tentative). It is the only generated‑column write in the codebase — the rough‑sheet
equivalent and the consumables action both correctly omit it.

### 3.3 Procurement grouped view is read‑only — **partially working**
The default view (`group=project`) contains zero inputs or selects. Suppliers, PR/LPO numbers and
ordered status cannot be assigned without switching to the flat view. Delete was added; editing was
not. This is the outstanding half of Changes III item 5.

### 3.4 Equipment usage is disconnected from jobs — **partially working**
`equipment_usage` has no `job_id` and no hours column; it records a daily status code per machine.
Machine time booked on a job worksheet (`job_quote_equipment` / `job_actual_equipment`) has no
relationship to it. Neither view can reconcile against the other.

### 3.5 Documents cannot be filed against a project — **missing**
`uploadDocument` accepts `job_id` and `welder_certificate_id` only; `project_id` is derived by trigger
from the job. A project‑level document (contract, specification) cannot be uploaded, yet the Projects
tab has a Documents sub‑tab that reads `project_id`.

### 3.6 Point of Contact "Project Based" links to the wrong page — **broken link**
`app/(app)/contacts/page.tsx:104` hardcodes `href: "/projects"` with the comment *"Project detail pages
land in step C; the list is the target until then."* Project detail pages exist at `/projects/[id]`.
Every project in that tab is a dead‑end link to the list.

### 3.7 Lint gate is non‑functional — **not working**
`.eslintrc.json` extends only `next/core-web-vitals`, which does not register the `@typescript-eslint`
plugin. The 11 files carrying `/* eslint-disable @typescript-eslint/no-explicit-any */` reference an
unknown rule, so `npm run lint` exits 1 without linting. Combined with `ignoreDuringBuilds: true` and
no CI, lint provides zero coverage; the config comment claiming "Lint is run explicitly in CI" is
inaccurate — there is no `.github/` directory.

### 3.8 No automated tests — **missing**
No runner, no `test` script, no spec files. All regression safety rests on `tsc`, `next build` and
manual SQL probes.

### 3.9 Unbounded list queries — **watch**
Thirteen queries use `.limit(2000)`, others 1000/3000/5000, with no pagination and no "showing N of M"
indicator. Correct at current volume; silently truncating at real volume.

---

## 4. Improvements

Ordered by value.

1. **Replace numeric tier comparison with the named predicates.** `minTier` and `requireTier` should
   use `isAdmin()` / `canSeeFinancials()` / `canEdit()` rather than `>=`. The tier numbers are no
   longer ordinal, and every numeric comparison is now a latent bug of the kind in 3.1.
2. **Add a schema guard against generated‑column writes.** A single query
   (`is_generated = 'ALWAYS'`) cross‑checked against action payloads would have caught 3.2 before
   release; worth a small test.
3. **Make the grouped procurement view editable** (supplier, PR/LPO, ordered status) so the default
   view is usable without switching modes.
4. **Decide the equipment model.** Either link `equipment_usage` to jobs, or state explicitly that
   worksheet equipment charges and the usage register are independent and label them accordingly.
5. **Allow project‑level document upload**, or remove the Projects › Documents sub‑tab.
6. **Repair lint** (`extends: ["next/core-web-vitals", "next/typescript"]`), then either fix or keep
   the `any` pragmas deliberately.
7. **Minimal smoke tests** covering auth, one write per module, and the recompute invariant.
8. **Pagination** on the capped list queries before real data volume arrives.
9. **Enable leaked‑password protection** in Supabase Auth (still off).

---

## 5. End-to-End Test Result

**Result: completed successfully, with two blocking defects found en route.**

Sample data created through the RLS path:

- **Project** `PRJ-2026-002` — "Dubai Metro Blue Line — Pipe Rack Steelwork", site AP4,
  status `in_fabrication`, contract value 850,000.
- **Job** `BAF-INP-AP4-AUG-002` — "Fabrication of Pipe Rack Modules PR-01 to PR-06", 6 modules,
  linked to the project.

Workflow followed through every stage:

| Stage | Result |
|---|---|
| Project → job creation, code allocation | Pass |
| Worksheet quote, 5 sections, margins | Pass — 42,200 → 47,000 verified independently |
| Quote → actual, variance and P&L | Pass — 44,832 actual, 2,168 P&L, 4.61% |
| In‑stock material → inventory issue | Pass — 50 − 20 = 30 on hand |
| Job Material Request → Procurement | **Fail** — insert rejected (§3.2); simulated manually to continue |
| Rough sheet / cut list nesting | Pass — order_qty 10 |
| Notes, timesheet, handover, contacts | Pass |
| QA inspection + NCR | Pass |
| Document upload → project backfill | Pass — trigger set `project_id` |
| Project roll‑ups | Pass — 1 job, quoted 47,000, actual 44,832 |
| Dashboard KPIs | Pass — P&L 3,745, consumables 1,012 |
| Universal search | Pass — 6 hits across 6 kinds |
| Soft delete → list refresh | Pass — 3 → 2 |
| Tier‑2 masking on live job | Pass — money NULL, worksheet 0 rows |
| Status change → code rebuild | Pass — INP → COM → INP |

**Testing note:** several probes ran inside transactions deliberately rolled back to print results.
Behaviour observed before rollback is valid, but the rows did not persist; an apparent "dashboard
consumables = 0" was that artifact, not a defect, and was re‑tested with persisted data (1,012).

**Cleanup:** all test rows removed. Post‑test counts match pre‑test exactly (projects 1, jobs 1,
quote_mat 17, actual_mat 11, procurement 0, stock 0, movements 0, notes 0, docs 5, timesheets 0,
handover 0, contact_assignments 2; leftover test rows 0). The pre‑existing job
`BAF-INP-AP4-AUG-001` still reads 15,770 / 17,347 / 0.1000 / 1,577 — unchanged.

---

## 6. Priority Fix List

### Critical
1. **Tier 1 locked out of 5 routes and 4 nav items** (§3.1) — a role defined as full‑access
   administrator cannot reach Settings, Sites, Procurement, Personnel & Equipment, or create a
   project. Blocks onboarding any tier‑1 user.
2. **Job Material Request broken on all three worksheet tabs** (§3.2) — one‑line fix: remove
   `total_price` from the insert payload.

### High
3. Procurement grouped view read‑only — supplier / PR / LPO / ordered status unassignable in the
   default view (§3.3).
4. Lint gate non‑functional, no CI, no tests — no automated safety net (§3.7, §3.8).

### Medium
5. Equipment usage disconnected from jobs (§3.4).
6. Documents cannot be filed against a project (§3.5).
7. Point of Contact "Project Based" dead‑end links (§3.6).
8. Replace numeric tier comparisons app‑wide to prevent recurrence of §3.1 (§4.1).

### Low
9. Unbounded list queries without pagination (§3.9).
10. Leaked‑password protection disabled in Supabase Auth.
11. `rfqs` table is dead in the app — a type alias and nothing else.
