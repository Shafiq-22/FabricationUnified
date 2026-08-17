# FabricationUnified — How To Use

A practical guide to running and using the BAF Workshop Steel Fabrication job book.
It reflects what the application actually does today. Where something is
incomplete or intentionally not built, it is marked.

---

## 1. What this application is

FabricationUnified is the internal job book for the **BAF — Workshop Steel
Fabrication** department. It replaces the old Excel workbook and keeps, in one
place:

- **Projects** and the **jobs** that make them up.
- Each job's **worksheet** — quoted costs, actual costs, and the profit/loss
  between them.
- A **Manufacturing Data Book** per job — the handover dossier, exported as a
  single PDF with its certificates merged in, or as a Word shell.
- **Procurement** (material requests, orders, deliveries), **consumables**, and
  a **historic price** memory built from past orders.
- **Inventory** with a movement ledger, low‑stock flags and remnants.
- **Quality** — inspections, NCRs, welder certificates.
- **Personnel & Equipment** — timesheets, equipment usage, maintenance,
  transfers.
- **Handover & Forecast**, **Documents**, **Point of Contact**, **Sites**, and a
  global **Search**.

The financial engine is worksheet‑driven: enter the cost lines, and the system
computes the quote (cost + margin), the actual cost, and the P&L. Numbers roll
up from jobs to their project and to the dashboard automatically.

**Stack:** Next.js 14 (App Router) + Supabase (Postgres, Auth, RLS, Realtime,
Storage). Rules are enforced in the database, not just the screen.

---

## 2. Prerequisites & setup

### 2.1 Requirements

- Node.js 20+ (22 is used in CI).
- A Supabase project (Postgres + Auth + Storage).

### 2.2 Environment variables

Copy `.env.example` to `.env.local` and fill in:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project API URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable / anon key |
| `NEXT_PUBLIC_SITE_URL` | Base URL of the deployment (auth redirects) |
| `NEXT_PUBLIC_INACTIVITY_TIMEOUT_MINUTES` | Idle auto‑logout, default `480` (8 h) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server‑only; used only by admin user actions. Keep secret. |

Secrets live only in `.env.local` (git‑ignored). Never expose the service‑role
key to the browser.

### 2.3 Database

The schema is reproducible from `supabase/migrations` (applied in numeric order)
plus `supabase/seed/seed.sql`, which loads the role tiers, labour rates and the
116 site codes.

```bash
supabase link --project-ref <your-ref>
supabase db push
psql "$DATABASE_URL" -f supabase/seed/seed.sql
```

### 2.4 First administrator

There is **no public sign‑up**. Create the first Tier‑3 admin once, directly in
SQL — see the block in `README.md` under *First admin*. GoTrue token columns must
be empty strings (`''`), not `NULL`, or login fails. After that, the admin
invites everyone else from **Settings → Users**.

### 2.5 Run

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm run check      # typecheck + lint + tests
```

---

## 3. Signing in, roles & permissions

Sign in at `/login` with the email/password an administrator gave you. There is
no self‑registration. After 8 hours of inactivity you are logged out
automatically.

### 3.1 The three tiers

Every user has one of three tiers. **The tier numbers are not a ranking** — tier
2 is the restricted one; tiers 1 and 3 are equals.

| Tier | Default name | Can see money? | Admin? | In practice |
|---|---|---|---|---|
| **1** | Plant Manager | **Yes** | **Yes** | Full access, including financials and administration. |
| **2** | Fabrication Engineer | **No** | No | Full operational editing, but **no financial figures** and no admin. |
| **3** | Fabrication Manager | **Yes** | **Yes** | Full access, including financials and administration. Peer of tier 1. |

The display names above are editable in **Settings → General → Role Display
Names**; the underlying behaviour is fixed.

### 3.2 What each capability means

- **See money** (tiers 1 & 3): the Job Worksheet, all P&L columns, the dashboard
  financial KPIs, the quotation PDF and inventory values. A tier‑2 user sees the
  job, its status, notes and comments — but the worksheet is replaced with a
  "restricted for your role" panel and money columns come back blank.
- **Edit** (all tiers): create and edit jobs, worksheets, rough sheets,
  procurement, handover, records, etc. Tier 2 edits everything operational; it
  just cannot see the costs.
- **Admin** (tiers 1 & 3): Settings, Sites, user management, and **deletion**.
  Deletes are *soft* (the record is hidden, not destroyed).

> **Note on the README:** older text there describes tier 1 as read‑only with no
> financials. That is out of date. The current model is the table above.

---

## 4. The application shell

Every page shares:

- **Left sidebar** — the module navigation. Items you are not permitted to see
  are hidden (a tier‑2 user does not see Sites or Settings). Collapsible.
- **Top bar** — a **global search box**, a **notification bell**, your name and
  role, and **sign out**.
- **Notifications** (the bell): @‑mentions in job comments and job‑watch updates.
  RLS limits these to your own rows.

---

## 5. Core concepts & how data flows

Understanding these four things makes the rest obvious.

**1. Project → Job → Worksheet.** A *project* is a grouping of *jobs*. A job's
*worksheet* holds its cost lines. A job can also stand alone with no project.

**2. The worksheet drives the money.** On the worksheet you enter cost lines in
five sections — **Material, Workforce, Consumables, Equipment, Services**. Each
section gets a margin. The system computes:

- **Cost before margin** = sum of all section subtotals.
- **Final Quote** = Σ (section subtotal × (1 + that section's margin)).
- **Actual cost** = sum of the *Actual* tab lines.
- **Profit / Loss** = Final Quote − Actual cost.

This recomputes on every worksheet save.

**3. Rollups are automatic.** A job's figures roll up into its project (quoted
and actual are summed from its jobs) and into the dashboard KPIs. You never type
a project total — it is derived.

**4. Codes are generated, not typed.**
- **Job code:** `BAF-{STATUS}-{SITE}-{MONTH}-{SEQ}`, e.g. `BAF-INP-OSS-JUN-001`.
  Only the status segment changes when you change the job's status; the rest is
  fixed for the life of the job.
- **Project code:** `PRJ-{YEAR}-{NNN}`, e.g. `PRJ-2026-001`.

Cross‑module flows worth knowing:

- **Worksheet → Procurement:** "Job Material Request" copies material lines into
  Procurement as request lines.
- **Rough Sheet → Procurement:** "Copy to Job Material Request" does the same
  from the aggregated cut‑list order list.
- **Inventory ↔ Worksheet:** an Actual material line marked *In Stock* and
  pointed at a stock item is priced at that item's carried cost and is treated as
  drawn from the yard (not re‑ordered).
- **Documents:** a document attached to a job automatically inherits that job's
  project.
- **Procurement → Historic Prices:** delivered orders feed the historic price
  memory, which the worksheet's Tentative estimator reads.

---

## 6. Module reference

Each module below lists its tabs and what to enter.

### 6.1 Dashboard

Read‑only overview for the selected **month** (month picker, top right).

- **KPI row:** No. of Jobs, and — for tiers that see money — Gross P/L, Daywork
  Charges, Consumables Cost, Avg Lead Time. Tier 2 sees a "restricted" note in
  place of the money KPIs.
- **Operational counters** (all tiers, clickable): Low Stock, Open NCRs, Overdue
  Deliveries (ordered >14 days ago, not yet delivered), Documents.
- **Charts:** finance trend (money tiers only), job volume, status mix, site load
  — trailing 12 months.
- **Status Breakdown:** job counts per status for the month.

### 6.2 Projects

**List** (`/projects`): every project with its rolled‑up quoted/actual values.

**New Project** (`/projects/new`): enter **Project Name** (required), Site,
**Status** (RFQ, Quoted, Won, In Fabrication, QA, Dispatch, Installed, Closed,
Lost), Contract Value, Start / Target / Actual dates, Notes. Then tick any
**unassigned jobs** to attach (a job belongs to at most one project). You can
create the project first and attach jobs later.

**Project detail** (`/projects/[id]`) — tabs:

| Tab | Shows |
|---|---|
| Jobs | The jobs in this project; attach/detach here too. |
| Material / Consumables / Workforce | Cost lines rolled up across all its jobs. |
| People | Contacts assigned to the project or any of its jobs. |
| Documents | Documents on the project or its jobs; upload here (see 6.5). |

### 6.3 Jobs, Worksheet & Rough Sheet

**Jobs Register** (`/jobs`): filter by status, site, month, or search by code /
description. Status badges are colour‑coded. **New Job** asks for **Site**
(required), **Description** (required), Status, Start Date, Unit, Quantity,
Company Job Code, Quotation Ref, and optional Project. On save the job code is
generated and you land on its worksheet.

#### Job Worksheet (`/jobs/[id]/worksheet`)

The heart of the app. A summary strip shows site, qty, dates, lead time and P&L.
Header buttons: change **Status**, open **Rough Sheet**, export the **Quotation
PDF** (money tiers only). Four tabs:

**Quotation** — enter the quoted cost lines:

- **Material MTO:** Part No./Name, Material, Dimension, Unit, Qty, Unit Cost.
- **Workforce:** designation (rate pulled from Settings labour rates), qty,
  hours per person, date.
- **Consumables:** item, unit, qty, unit cost.
- **Equipment Charges:** pick a machine from the register (rate auto‑fills, bare
  or with driver) or type plant free‑hand; hours × rate.
- **Service Charges:** bought‑in work (galvanising, NDT, blasting, transport…).
- **Section Margins:** set each section's margin, or override the Settings
  default for this job only. A per‑section toggle can show cost *before* margin
  (display only — nothing is saved).
- **Quotation Summary** shows the Final Quote.
- Buttons: **Copy to Actual** (clones every quoted line into the Actual tab),
  **Job Material Request** (raises procurement lines from the MTO), **Import**
  (materials/consumables from a spreadsheet), and the quoted‑vs‑actual export.

**Actual** — what was really used, at real cost, no margin. Same sections. The
Material table adds an **In Stock** tick + **Stock Item** picker: ticking it and
choosing a stock item prices the line from inventory and marks it drawn from the
yard. "Job Material Request" here skips stock‑drawn lines (they were not bought).
An **Actual vs Quoted** table shows the variance per section, calling out the
stock‑drawn share.

**Tentative** — a re‑pricing estimator. Takes the quoted Material and Consumable
items and prices them from **historic** procurement prices (with an optional
inflation %), so you can produce a fresh estimate without re‑typing costs.

**Analytics** — predicted vs actual P/L and a per‑category cost‑deviation view.

Below the tabs (visible to all tiers, including tier 2): **Documents**, **Notes**
(a plain per‑job record), **Job details** form, and a realtime **Comments**
thread with @‑mentions and a watch toggle.

#### Manufacturing Data Book (`/jobs/[id]/mdb`)

The dossier handed to the client on completion — the index of every certificate,
report and drawing proving the item was built and tested as specified. Open it
with the **MDB** button on the worksheet or rough sheet header. Any tier can
compile it (it is a quality record, not a costing one).

**Creating it.** A new job has no MDB. Choose either:

- **Structural steel preset** — marks the 28 sections a typical steel job needs
  as *Included* and the rest *Not applicable*.
- **All sections pending** — leaves every section for you to work through.

Both create the same standard 52 sections across 12 chapters, and everything
stays editable. The cover page is pre-filled from the job, its project and the
company name in Settings.

**Filling it in.** Per section you can set:

| Field | What it does |
|---|---|
| Status | *Included* / *Pending* / *Not applicable* |
| Reference | Document number and revision, printed in the index and on the divider |
| Note | Free text printed on the divider page |
| Tab code | The marker on the divider (ITP, WPS, RT…) |
| Documents | Link files already uploaded against this job |

Linking a document to a *Pending* section moves it to *Included*. Chapter
headers have **mark-all** buttons. You can retitle or remove sections and **add
a section** the standard layout doesn't carry.

**Exporting.** Two buttons, for two different jobs:

| Button | Produces | Use it for |
|---|---|---|
| **Download complete PDF** | One PDF: cover, index, then each divider **followed by the actual certificates and reports** attached to it | The book you issue to the client |
| **Word (dividers only)** | A `.docx` of the cover, index and dividers | Editing wording, or printing tabs to file paper copies behind |

Both mark *Not applicable* sections in the index (so the client can see they
were considered) but give them no divider page.

The complete PDF merges **PDFs and JPEG/PNG images**. Anything else — a Word or
Excel attachment — has no pages to merge, so it is left out and listed
afterwards in a "could not be merged" report naming the file and its section.
You are told what is missing rather than handed a book that looks complete.

Assembly happens in your browser and can take a moment on a large book; the
button shows progress section by section.

#### Rough Sheet / Cut List (`/jobs/[id]/roughsheet`)

Enter the **cut list** (profiles: type, dimension, grade, length, qty) and
**plates** (thickness, sheet size, grade, pieces). The system aggregates them:

- **Order List** — total length, theoretical bars, and a nesting‑aware **Order
  Qty** (it fits multiple pieces per bar rather than dividing naively), plus an
  **In Stock** column matching against inventory (remnants highlighted).
- **Plate Order List** — area used, pieces per sheet, sheets required, stock
  cover.

You can **Import Cut List** (spreadsheet or DSTV/NC1) and **Copy to Job Material
Request** to push the order list into Procurement.

### 6.4 Point of Contact (`/contacts`)

The people register (this replaced the old "Clients" module). Tabs:

- **Registry:** every contact — Name, Role, Organisation, Site, Contact details,
  and how many Jobs/Projects they're on. Add/edit contacts here.
- **Job Based:** contacts grouped by job.
- **Project Based:** contacts grouped by project (links through to each project).

Contact roles include Project In‑Charge, Requisitioner, Procurement, Foreman,
Engineer, Inspector, Supplier Rep, Other. (Welders and foremen on the shop floor
come from timesheets, not here.)

### 6.5 Documents (`/documents`)

Files are uploaded to a private Storage bucket and opened via short‑lived signed
URLs (max 50 MB each). Group the view by **Project, Job, Certificate, Date, or
Uploader**.

When uploading, choose a **Type** (Drawing, Requisition, Certificate, PO,
Invoice, Inspection Report, Photo, Email, Other), optional Revision and Notes,
and attach it to a **Job** *or* — if no job — a **Project** (for contracts,
specs, anything project‑level). A document attached to a job inherits that job's
project automatically. You can also upload from a Job Worksheet or from a
Project's Documents tab.

### 6.6 Procurement (`/procurement`)

Four sub‑tabs:

- **Job Material:** material requests → orders → deliveries. Grouped by
  project/job by default; each line's **Supplier, PR, LPO, Ordered and Delivered
  dates are editable inline** in this view. A KPI strip shows records,
  delivered, pending and average days‑to‑deliver. "Generate draft" builds a
  supplier email for outstanding lines. Switch to the flat view for full‑row
  editing and bulk work; export CSV.
- **Consumables:** the monthly consumables register (also reachable at
  `/consumables`, which redirects here). Editable inline in the grouped view;
  CSV export.
- **Suppliers:** the supplier master list with per‑supplier usage counts and
  contact details.
- **Historic Prices:** average and last price per item & supplier, built from
  delivered orders. This is what the worksheet Tentative tab reads. Search by
  item name.

> `time_to_deliver_days` = delivery date − order date, computed automatically.

### 6.7 Inventory (`/inventory`)

- **Stock:** items with Code, Type (plate / section / consumable / remnant),
  Description, Grade, Dimensions, **On Hand**, Unit, Location, Unit Cost, Value.
  On‑hand is **derived from the movement ledger**, not typed. Low‑stock items are
  flagged. Values are hidden from tier 2.
- **Movements:** the ledger — Receipt (in), Issue to job (out), Remnant returned
  (in), Adjustment (±). Add movements here; on‑hand recalculates.

### 6.8 Quality (`/qa`)

- **Inspections:** Job, Item/Mark No, **Result** (Pass / Fail / Conditional),
  Inspector, Inspected On, Notes. KPI: pass rate.
- **NCRs:** Title, Job, Project, Item/Mark No, **Severity** (minor / major /
  critical), **Status** (Open / In Progress / Closed), Description, Root Cause,
  Corrective Action. KPI: open NCRs (also on the dashboard).
- **Welder Certificates:** HO Number, Name, Position, Date of Certificate /
  Renewal / Expiry, Site, attached scan Files. Expiring/expired certificates are
  flagged (warn window and notify email are set in Settings; ISO 3834‑2).

### 6.9 Handover & Forecast (`/handover`)

- **Active Jobs:** handover items with a per‑item **drawings tracker** (Drawing
  Title, Status, Submitted To, Notes).
- **Forecasted Jobs:** anticipated work not yet raised as a job — Job Description,
  Qty, Site, PO Ref, Supplier, Expected Completion, Remark. Link one to a real
  job once it exists.

### 6.10 Personnel & Equipment (`/records`)

Tabs:

- **Timesheet:** a daily grid — enter **Normal hours** and **OT hours** per
  person; hours × the Settings rates give the cost. Begin/end times come from the
  standard working day in Settings. Monthly colour‑coded view and PDF.
- **Equipment Usage:** a monthly grid of daily **status codes** per machine (e.g.
  Production, Standby, Breakdown), each costed by its bare/driver rate factors.
  PDF export. *This register is independent of a job's worksheet equipment
  charges — it is not attributed to jobs.*
- **Maintenance:** maintenance log per machine (scheduled / breakdown /
  inspection / repair).
- **Transfers:** personnel transfer requests between sites, with a draft notice.
- **Manage Lists:** the personnel master (HO No, Name, Trade, Position, Site) and
  the equipment master (Sixco No, Group, Machine, Make, Type, Bare/Driver rate).

### 6.11 Sites (`/sites`) — admin

Manage the site codes (116 seeded). Codes appear in job codes and throughout the
app.

### 6.12 Settings (`/settings`) — admin

- **General:**
  - **Role Display Names** — rename the three tiers.
  - **Company / Department** — the header on PDFs.
  - **Section Margins (%)** — the default Material, Workforce, Consumables,
    Equipment, Services margins. Changing these re‑prices in‑progress jobs that
    have no per‑job override.
  - **Timesheet Rates** — normal and OT AED/hr, inflation %, certificate expiry
    warning days and notify email, and the **standard working hours** applied to
    every timesheet line.
  - **Change My Password.**
  - **Labour Rates** — the trade rate list the worksheet Workforce section uses.
- **Users** (also reachable at `/users`, which redirects here): invite users, set
  role, deactivate, reset password.

### 6.13 Search (`/search`)

Global search (also in the top bar). Type ≥2 characters. Results are grouped by
kind: Job, Project, Contact, Personnel, Equipment, Document, Certificate, Stock,
Supplier, NCR, Note, Comment.

---

## 7. End‑to‑end worked example

A realistic run, using **Project `PRJ-2026-002` — "Dubai Metro Blue Line — Pipe
Rack Steelwork"** (site AP4) and job **`BAF-INP-AP4-AUG-002` — "Fabrication of
Pipe Rack Modules PR‑01 to PR‑06"**.

1. **Create the project.** Projects → New Project → name it, pick site AP4, set
   status *In Fabrication*, enter the contract value. Save. It mints
   `PRJ-2026-002`.
2. **Create the job.** Jobs → New Job → site AP4, description, qty/unit, choose
   the project. Save → it mints `BAF-INP-AP4-AUG-002` and opens the worksheet.
3. **Quote it.** On the **Quotation** tab, fill the five sections. With subtotals
   Material 21,740 / Workforce 11,600 / Consumables 1,360 / Equipment 2,400 /
   Services 5,100 and margins 10/15/10/10/10, cost‑before‑margin is **42,200** and
   the **Final Quote** is **47,000**.
4. **(Optional) Plan the steel.** Rough Sheet → enter the cut list; read the
   Order List (nesting‑aware) and the In‑Stock column; **Copy to Job Material
   Request**.
5. **Start the MDB (optional, but easiest early).** Worksheet → **MDB** → create
   with the structural preset. Link certificates and reports to their sections as
   they arrive rather than hunting for them at handover.
6. **Raise procurement.** From the worksheet, **Job Material Request** pushes the
   MTO into Procurement. Assign supplier / PR / LPO and mark deliveries there.
7. **Draw from stock where relevant.** On the **Actual** tab, tick *In Stock* and
   pick the stock item for anything taken from the yard — it prices from
   inventory and is excluded from re‑ordering.
8. **Record actuals.** Fill the Actual tab as work proceeds. With actual cost
   **44,832**, P&L is **2,168** (4.61%). The **Actual vs Quoted** table shows the
   variances.
9. **Quality & handover.** Log inspections/NCRs in Quality; track drawings in
   Handover.
10. **Watch it roll up.** The project now shows job count 1, quoted 47,000, actual
   44,832; the dashboard KPIs and charts include it for the month.
11. **Close out.** Change the job status to *Completed* — the code becomes
    `BAF-COM-AP4-AUG-002` (the rest of the code is preserved). Download the
    complete MDB PDF and issue it with the handover.

---

## 8. Common controls

- **Search / filter / sort:** most registers have a search box and filter bar
  (status, site, month). The top‑bar search is global.
- **Editing:** worksheet, rough‑sheet, procurement grouped, timesheet and record
  grids edit in place. Worksheet/rough‑sheet tables save per section; inline
  procurement cells save on blur or Enter.
- **Deleting:** top‑level records (jobs, procurement lines, consumables,
  documents, etc.) are **soft‑deleted by admins only** (tiers 1 & 3) — hidden,
  not destroyed. Worksheet and rough‑sheet **line items** can be removed by any
  editor as normal editing.
- **Import:** worksheet MTO/consumables from spreadsheet; cut list from
  spreadsheet or DSTV (NC1). A preview is shown before anything is written.
- **Export:** CSV on Procurement; PDF for the quotation, quoted‑vs‑actual,
  timesheet and equipment record.
- **List caps:** long lists are capped for performance; when a cap is hit a
  banner says "Showing the first N of M records" so nothing is silently hidden.

---

## 9. Common mistakes and how to avoid them

- **Expecting tier 2 to see costs.** Tier 2 is deliberately blind to money — the
  worksheet is hidden for them. Use tier 1 or 3 for costing.
- **Typing a project total.** You can't — project quoted/actual are summed from
  jobs. Fix the numbers on the jobs.
- **Typing on‑hand stock.** On‑hand is derived from the movement ledger. To
  change it, add a movement (receipt / issue / adjustment).
- **Marking Actual material "In Stock" but not picking a stock item.** Only a
  named stock item is priced from inventory and excluded from re‑ordering.
- **Expecting equipment usage and worksheet equipment charges to reconcile.**
  They are independent by design (see 6.10).
- **Editing procurement in the wrong view.** Supplier/PR/LPO/dates edit inline in
  the grouped view; full‑row edits are in the flat view.
- **Attaching a job to two projects.** A job belongs to at most one project;
  detach it first.

---

## 10. Troubleshooting

- **"Restricted for your role."** You are tier 2 (no financial access). This is
  expected on the worksheet, money KPIs and the quotation PDF.
- **A nav item or route is missing.** It is admin‑only (Sites, Settings) and you
  are tier 2. Ask an administrator.
- **Redirected to the dashboard.** You opened an admin‑only page without rights.
- **Login fails for a hand‑created user.** GoTrue token columns must be `''`, not
  `NULL` (see First admin). Prefer creating users via Settings → Users.
- **Logged out unexpectedly.** 8‑hour inactivity timeout
  (`NEXT_PUBLIC_INACTIVITY_TIMEOUT_MINUTES`).
- **A list looks cut off.** Check for the "Showing the first N of M" banner —
  narrow with filters/search.
- **Historic prices / Tentative look empty.** They build from *delivered*
  procurement orders; there is no history until orders are delivered.
- **New margin didn't change a job.** Settings margins only re‑price *in‑progress*
  jobs **without** a per‑job override. Jobs with a section override keep it.

---

## 11. Limitations & incomplete functionality

- **Leaked‑password protection is a Supabase Auth setting** and must be enabled in
  the Supabase dashboard (Authentication → Providers → Email). It is not
  controllable from the app.
- **List pagination:** long lists are capped and *disclose* truncation, but there
  is no page‑through UI yet — use filters/search to narrow.
- **Equipment usage is not attributed to jobs** (see 6.10). This is a deliberate
  separation, not a defect.
- **AI features are not built** (out of scope): no document field extraction, no
  semantic/vector search, no RAG assistant, no OCR. All behaviour is
  deterministic.
- **DXF is not parsed** (would need a separate service); **DSTV/NC1** is supported
  instead, parsed in‑app.
- **No relationship "Graph" screen** is wired into the navigation, despite older
  references to one.
- **The `rfqs` table exists in the database but is unused by the app.**
- **The MDB Word export is dividers only** — use *Download complete PDF* for a
  single file with the certificates merged in. Word cannot flow PDF pages
  inline, which is why the complete book is a PDF.
- **Only PDFs and JPEG/PNG images can be merged** into the complete PDF. Word
  and Excel attachments are reported and must be added by hand — converting
  them to PDF before upload avoids this.
- **Automated tests are smoke‑level only** — they cover the access model and a
  guard against writing generated columns; they are not a full regression suite.
