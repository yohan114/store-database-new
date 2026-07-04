# Upgrade Plan — SQLite consolidation, purchase-source rework, dashboard & issuing improvements

_Target branch: `claude/sqlite-migration-ui-updates-81tusn`_

## 0. Where the system stands today (important context)

**The system already runs on SQLite.** The old MS Access file (`inventory.accdb`) is only kept
as a migration source/backup; every read and write goes through the embedded `inventory.db`
(better-sqlite3, WAL mode, indexed — see `db.js`). So "move to SQLite" is done; what remains for
"faster and more accurate" is:

- The **legacy UI** (`item_tracker.html`, ~8,000 lines, served at `/`) re-renders large tables in
  the browser and is the main remaining source of slowness. The **new React app** (served at
  `/app`) is fast but only partially ported.
- **Data accuracy** suffers from free-text fields: `receipts.purchaseSource` currently holds 7
  different spellings for what are really just two channels (counts from the live DB):

  | Stored value | Rows | Really means |
  |---|---|---|
  | `Local Purchase` | 1,306 | Local |
  | `Head Office` | 853 | Head office |
  | `Local Store` | 507 | Local |
  | `Direct Purchase` | 235 | Head office |
  | *(blank)* | 9 | unknown |
  | `Local Purchase & Head Office` | 8 | mixed (legacy combined rows) |
  | `Head Office & Local Purchase` | 1 | mixed (legacy combined rows) |

  There are **no `Pre-Ordered` rows**, so dropping that option requires no data migration.

This plan therefore has two threads: (A) normalize the data + add the requested fields, and
(B) rework the four screens (New Request, Material Delivery, Dashboard, General Item Issue).

---

## 1. Data-layer changes (SQLite schema + one-time migration)

All schema changes go in `db.js → init()` using the existing lightweight-migration pattern
(`PRAGMA table_info` check → `ALTER TABLE`), so they apply automatically and idempotently on
server start. A timestamped backup of `inventory.db` is written before the first run.

### 1.1 Canonical purchase-source values

Adopt exactly two canonical values, used everywhere (requests, deliveries, dashboard):

- **`Local Purchase`** (was: Local Store / Local Purchase)
- **`Head Office Purchase`** (was: Direct Purchase / Head Office; Pre-Ordered removed)

Define once in a shared constant (`server.js` + a small `client/src/lib/constants.js`) so UI and
API can never drift apart.

### 1.2 `items.requestSource` — the new tick on "Log a New Request"

```sql
ALTER TABLE items ADD COLUMN requestSource TEXT;          -- 'Local Purchase' | 'Head Office Purchase'
CREATE INDEX idx_items_requestSource ON items(requestSource);
```

- New requests must pick one (server-side validation; legacy rows stay NULL and display as "—").
- Optional backfill: where an item's receipts all share one source, copy it up to the request
  (`UPDATE items SET requestSource = ... WHERE requestSource IS NULL`), so pending lists on the
  dashboard are populated for existing open requests too.

### 1.3 Normalize `receipts.purchaseSource` (one-time UPDATE)

```sql
UPDATE receipts SET purchaseSource = 'Local Purchase'
 WHERE LOWER(TRIM(purchaseSource)) IN ('local store','local stores','local purchase');
UPDATE receipts SET purchaseSource = 'Head Office Purchase'
 WHERE LOWER(TRIM(purchaseSource)) IN ('direct purchase','head office','pre-ordered','head office purchase');
```

- The 9 mixed rows (`Local Purchase & Head Office` etc.) and 9 blanks are few enough to resolve
  by hand; the migration logs them, and the Pricing screen will show them flagged for correction.
- After migration the API **rejects** any value other than the two canonical ones
  (400 with a clear message), so the data can never fragment again.
- Update the hard-coded matching in `server.js` (e.g. line ~1173, which string-compares
  `'direct purchase' / 'head office' / 'pre-ordered'`) to use the canonical constants.

### 1.4 Accuracy hardening (cheap wins while we're in the schema)

- `receipts.itemId` → enforce `FOREIGN KEY` behaviour in code (reject receipts for missing items).
- Reject deliveries that would take total received above requested qty by more than an allowed
  tolerance (configurable; warn in UI, block on server unless overridden by admin).
- Keep all new date writes ISO-normalized via the existing `toISO()` helper (already in place).

---

## 2. "Log a New Request" — add Local / Head Office tick

**What changes:** the request form gets a required "Request to" selector with two ticks:
**Local Purchase** and **Head Office Purchase**.

| Layer | File | Change |
|---|---|---|
| API | `server.js` `POST /api/items`, `PUT /api/items/:id` | accept + validate `requestSource`; include it in list responses & Excel export |
| New UI | `client/src/features/tracker/ItemFormModal.jsx` | add radio pair (styled like the delivery source ticks); required for new lines |
| Legacy UI | `item_tracker.html` "Log a New Request" modal (~line 1988) | same radio pair; submit includes `requestSource` |
| Tracker tables | both UIs | new "Source" column + filter chips (Local / Head Office / All) |

## 3. "Log Material Delivery" — rename sources, drop Pre-Order, confirm receipt channel

**What changes:** the "Purchase / Supply Source" ticks become exactly two, and they act as the
confirmation of *where the material was actually received from* (which may differ from what the
request asked for — that mismatch is highlighted, not blocked):

- ~~Local Store~~ → **Local Purchase**
- ~~Direct Purchase~~ → **Head Office Purchase**
- ~~Pre-Ordered~~ → **removed**

| Layer | File | Change |
|---|---|---|
| API | `server.js` `POST /api/items/:id/receipts` (~line 226) + receipt update (~line 253) | validate source ∈ canonical pair; required for `Receive` transactions |
| New UI | `client/src/features/receiving/ReceiveModal.jsx` | replace the free-text "Purchase source" input (line 93–95) with the two radio ticks, pre-selected from the item's `requestSource`; show a subtle warning chip when it differs from the request ("Requested from Head Office — receiving as Local Purchase") |
| Legacy UI | `item_tracker.html` receiving form (~lines 694–709) | rename the two radios, delete the Pre-Ordered radio; update `submit` handler default (~line 5659) |

## 4. Dashboard rework

New endpoint `GET /api/dashboard/purchases` (single round-trip, all SQL server-side and indexed):

```jsonc
{
  "today":   { "local": 45200.00, "headOffice": 128000.00 },        // SUM(qty*unitPrice) per source, deliveryDateISO = today
  "monthly": [ { "month": "2026-07", "local": ..., "headOffice": ..., "total": ... }, ... ],  // last 12 months
  "pending": {
    "headOffice": [ { "id", "mrnNum", "reqDateISO", "itemName", "vehicleMachinery", "reqQty", "recQty", "outstanding", "ageDays" } ],
    "local":      [ ...same shape... ]
  }
}
```

- **Monthly expenses**: `GROUP BY strftime('%Y-%m', deliveryDateISO)` over priced receipts,
  split by the (now clean) `purchaseSource`. Un-priced receipts are excluded from money totals
  but surfaced as a "N deliveries not yet priced" note so totals are never silently wrong.
- **Daily totals**: same query filtered to today; also show "this month so far".
- **Pending items**: requests where `reqQty > SUM(receipts.qty)`, bucketed by
  `items.requestSource` — this is the list of what's still owed by head office vs. what the
  local buyer still has to purchase. Sorted oldest-first with an age badge (>14 days highlighted).

**Dashboard UI** (`client/src/features/dashboard/Dashboard.jsx`):

1. Keep the existing KPI row.
2. New "Purchases" section: two stat cards (Today — Local / Today — Head Office) + a 12-month
   bar chart (local vs head office stacked; table fallback) with month totals.
3. New "Pending" section: two side-by-side panels, *Pending — Head Office* and *Pending — Local
   Purchase*, each a compact list (item, MRN, vehicle, outstanding qty, age) with search, a count
   badge, "export to Excel", and click-through to the Tracker filtered to that line.

The legacy dashboard is left as-is; this is the flagship screen of the new app.

## 5. General Item Issue — proposed modifications (needs your confirmation)

The current flow (`GeneralItemTxModal.jsx` + `POST /api/general-items/transaction`) is a bare
type/date/qty form. Proposed upgrade, pending your priorities:

1. **Guard against over-issue** — server rejects an Issue where qty > current balance (today it
   can drive stock negative); the modal shows live "balance after this issue".
2. **Issued-to / Issued-by fields** — record the person/department receiving the item and the
   storekeeper issuing it (matches the main `issues` table), for accountability.
3. **Multi-line issue** — issue several general items in one slip (one MRN, many lines) instead
   of one modal per item.
4. **Printable issue note** — a numbered slip (GIN-xxxx) rendered for print/PDF after saving.
5. **Low-stock alert** — when an issue takes an item below its `minStock`, flag it on the
   dashboard pending/reorder panel.
6. **Faster entry** — searchable item picker with rack + live balance shown in the dropdown, so
   issuing doesn't require finding the item row first.

> **Question for you:** which of 1–6 do you want, and is anything else wrong with the current
> issue flow? Items 1, 2 and 6 are recommended as the first slice.

## 6. Speed plan

- **Finish the React port** so daily work stops using the 8k-line legacy page: the four screens
  above land natively in `/app`; then switch `/` to redirect to `/app` (legacy stays at `/legacy`
  during a grace period, then is retired along with `LEGACY_DELETE_PASSWORD`).
- Dashboard = **one** API call (section 4) instead of several.
- All new filters (source, pending) hit indexed columns — no new full-table scans.

## 7. Delivery order & testing

| Phase | Scope | Risk |
|---|---|---|
| 1 | Schema + data normalization + API validation (sections 1) | Low — idempotent migration, DB backed up first |
| 2 | Request & Delivery form changes, both UIs (sections 2–3) | Low |
| 3 | Dashboard endpoint + new dashboard UI (section 4) | Low — read-only |
| 4 | General Item Issue rework (section 5, after your answers) | Medium |
| 5 | Legacy retirement / default `/` → `/app` | Do last |

Each phase: extend `test_api.js` (source validation, migration mapping, purchases endpoint
totals cross-checked against raw SQL), run full API suite, manual smoke of both UIs, commit.

## Open questions

1. Exact label wording: **"Head Office Purchase"** vs "Headoffice Purchase" — plan assumes the
   former (matches existing data spelling "Head Office").
2. The 9 blank + 9 "mixed" historical receipts: correct by hand from paper records, or bucket
   them as Head Office?
3. General Item Issue: which of the six proposed changes (section 5)?
4. Should the pending-items panels also count **general items below min stock**, or only MRN
   request lines?
