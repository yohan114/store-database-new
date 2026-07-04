/**
 * db.js — Fast embedded SQLite data layer for the Delivery / Inventory Monitor.
 *
 * Replaces the old MS Access (.accdb) + PowerShell backend, which spawned a new
 * PowerShell process and re-scanned the entire database on every request.
 *
 * Engine selection is automatic and zero-config:
 *   1. better-sqlite3  (preferred — ships prebuilt binaries, fastest)
 *   2. node:sqlite     (built-in fallback on Node >= 22.5, no install needed)
 *
 * Both expose a compatible synchronous API: db.prepare(sql).{run,get,all}(...params)
 * and db.exec(sql). We only use positional `?` parameters so both engines work.
 */
const path = require('path');
const fs = require('fs');

const DB_FILE = process.env.INVENTORY_DB || path.join(__dirname, 'inventory.db');

let db;
let ENGINE = 'better-sqlite3';

try {
    const Database = require('better-sqlite3');
    db = new Database(DB_FILE);
} catch (e) {
    try {
        const { DatabaseSync } = require('node:sqlite');
        db = new DatabaseSync(DB_FILE);
        ENGINE = 'node:sqlite';
    } catch (e2) {
        console.error('FATAL: No SQLite engine available. Install better-sqlite3 (npm install) or run on Node >= 22.5.');
        throw e2;
    }
}

// Pragmas for speed + safe concurrent reads. exec() works on both engines.
try {
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA synchronous = NORMAL;');
    db.exec('PRAGMA foreign_keys = ON;');
    db.exec('PRAGMA temp_store = MEMORY;');
} catch (e) {
    console.warn('Pragma setup warning:', e.message);
}

// ---- Thin query helpers (prepare + execute) -------------------------------
function all(sql, params = []) {
    return db.prepare(sql).all(...params);
}
function get(sql, params = []) {
    return db.prepare(sql).get(...params);
}
function run(sql, params = []) {
    const r = db.prepare(sql).run(...params);
    return { changes: Number(r.changes), lastInsertRowid: Number(r.lastInsertRowid) };
}
function exec(sql) {
    return db.exec(sql);
}
/** Run fn() inside a transaction (portable across both engines). */
function transaction(fn) {
    db.exec('BEGIN');
    try {
        const result = fn();
        db.exec('COMMIT');
        return result;
    } catch (e) {
        try { db.exec('ROLLBACK'); } catch (_) {}
        throw e;
    }
}

// ---- Date normalization ----------------------------------------------------
// Stored dates are inconsistent ("12/11/2025" M/D/YYYY, "2025-12-11", etc.).
// We normalize every date to ISO "YYYY-MM-DD" in a parallel *ISO column so that
// range filters and sorting are correct AND fast (plain indexed string compare).
function toISO(dateStr) {
    if (dateStr === null || dateStr === undefined) return '';
    let s = String(dateStr).trim();
    if (!s) return '';

    // ISO-ish: YYYY-MM-DD or YYYY/MM/DD (optionally followed by time)
    let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (m) {
        return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
    }

    // M/D/YYYY (app convention) — fall back to D/M/YYYY when month > 12
    m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
    if (m) {
        let mo = parseInt(m[1], 10);
        let d = parseInt(m[2], 10);
        let y = parseInt(m[3], 10);
        if (y < 100) y += 2000;
        if (mo > 12 && d <= 12) { const t = mo; mo = d; d = t; }
        if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
            return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        }
    }

    const dt = new Date(s);
    if (!isNaN(dt.getTime())) {
        return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    }
    return '';
}

const nowISO = () => new Date().toISOString();

// ---- Canonical purchase / supply sources ------------------------------------
// Exactly two channels exist: bought locally, or supplied by head office.
// Historical data held 7+ spellings ("Local Store", "Direct Purchase",
// "Head Office", ...) which broke source-based reporting; init() collapses
// them once and the API only accepts these values afterwards.
const SOURCE_LOCAL = 'Local Purchase';
const SOURCE_HEAD_OFFICE = 'Head Office Purchase';
const PURCHASE_SOURCES = [SOURCE_LOCAL, SOURCE_HEAD_OFFICE];

const LOCAL_ALIASES = ['local store', 'local stores', 'local purchase'];
const HEAD_OFFICE_ALIASES = ['direct purchase', 'head office', 'headoffice', 'pre-ordered', 'head office purchase', 'headoffice purchase'];

/** Map any historical spelling to a canonical source ('' when unknown/mixed). */
function canonicalSource(value) {
    const v = String(value == null ? '' : value).trim().toLowerCase();
    if (!v) return '';
    if (LOCAL_ALIASES.includes(v)) return SOURCE_LOCAL;
    if (HEAD_OFFICE_ALIASES.includes(v)) return SOURCE_HEAD_OFFICE;
    return '';
}

// ---- Schema ----------------------------------------------------------------
function init() {
    exec(`
        CREATE TABLE IF NOT EXISTS items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mrnNum TEXT,
            reqDate TEXT,
            reqDateISO TEXT,
            vehicleMachinery TEXT,
            itemName TEXT,
            itemDesc TEXT,
            reqQty REAL DEFAULT 0,
            category TEXT,
            createdAt TEXT,
            updatedAt TEXT
        );

        CREATE TABLE IF NOT EXISTS receipts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            itemId INTEGER,
            qty REAL DEFAULT 0,
            transactionType TEXT,
            deliveryDate TEXT,
            deliveryDateISO TEXT,
            purchaseSource TEXT,
            grnNumber TEXT,
            invoiceNumber TEXT,
            invoiceDate TEXT,
            supplierName TEXT,
            unitPrice REAL
        );

        CREATE TABLE IF NOT EXISTS issues (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            itemId INTEGER,
            issueDate TEXT,
            issueDateISO TEXT,
            vehicleMachinery TEXT,
            itemName TEXT,
            itemDesc TEXT,
            qty REAL DEFAULT 0,
            category TEXT,
            issuedTo TEXT,
            issuedBy TEXT,
            mrnNum TEXT,
            purchaseSource TEXT,
            notes TEXT,
            createdAt TEXT,
            updatedAt TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_items_reqDateISO ON items(reqDateISO);
        CREATE INDEX IF NOT EXISTS idx_items_vehicle    ON items(vehicleMachinery);
        CREATE INDEX IF NOT EXISTS idx_items_mrn        ON items(mrnNum);
        CREATE INDEX IF NOT EXISTS idx_items_category   ON items(category);
        CREATE INDEX IF NOT EXISTS idx_receipts_itemId  ON receipts(itemId);
        CREATE INDEX IF NOT EXISTS idx_receipts_dateISO ON receipts(deliveryDateISO);
        CREATE INDEX IF NOT EXISTS idx_receipts_type    ON receipts(transactionType);
        CREATE INDEX IF NOT EXISTS idx_receipts_supplier ON receipts(supplierName);
        CREATE INDEX IF NOT EXISTS idx_receipts_spend   ON receipts(qty, unitPrice);
        CREATE INDEX IF NOT EXISTS idx_issues_vehicle   ON issues(vehicleMachinery);
        CREATE INDEX IF NOT EXISTS idx_issues_dateISO   ON issues(issueDateISO);
    `);

    // Refined migration check: drop old tables if upgrading
    try {
        const cols = all(`PRAGMA table_info(batteries)`);
        if (cols.length > 0 && !cols.some(c => c.name === 'brand')) {
            exec(`DROP TABLE IF EXISTS battery_movements;`);
            exec(`DROP TABLE IF EXISTS batteries;`);
        }
    } catch (_) {}

    exec(`
        CREATE TABLE IF NOT EXISTS batteries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            serialNumber TEXT UNIQUE NOT NULL,
            itemName TEXT,
            itemDesc TEXT,
            brand TEXT,
            condition TEXT,
            state TEXT,
            currentVehicle TEXT DEFAULT '',
            purchaseDate TEXT,
            purchaseDateISO TEXT,
            expiryDate TEXT,
            expiryDateISO TEXT,
            notes TEXT,
            createdAt TEXT,
            updatedAt TEXT
        );

        CREATE TABLE IF NOT EXISTS battery_movements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            batteryId INTEGER,
            serialNumber TEXT,
            movementType TEXT,
            movementDate TEXT,
            movementDateISO TEXT,
            fromLocation TEXT,
            toLocation TEXT,
            conditionAfter TEXT,
            issuedBy TEXT,
            mrnNum TEXT,
            notes TEXT,
            createdAt TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_batteries_lookup ON batteries(serialNumber, condition, state, currentVehicle);
        CREATE INDEX IF NOT EXISTS idx_movements_lookup ON battery_movements(batteryId, movementDateISO, serialNumber);
    `);

    exec(`
        CREATE TABLE IF NOT EXISTS material_transfers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            transferDate TEXT,
            transferDateISO TEXT,
            mtnNum TEXT,
            itemName TEXT,
            itemDesc TEXT,
            qty REAL DEFAULT 0,
            category TEXT,
            fromLocation TEXT,
            toLocation TEXT,
            transferredBy TEXT,
            receivedBy TEXT,
            mrnNum TEXT,
            notes TEXT,
            createdAt TEXT,
            updatedAt TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_transfers_dateISO ON material_transfers(transferDateISO);
        CREATE INDEX IF NOT EXISTS idx_transfers_from ON material_transfers(fromLocation);
        CREATE INDEX IF NOT EXISTS idx_transfers_to ON material_transfers(toLocation);
        CREATE INDEX IF NOT EXISTS idx_transfers_mtn ON material_transfers(mtnNum);
    `);

    // Create General Items & Transactions Tables
    exec(`
        CREATE TABLE IF NOT EXISTS general_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            itemName TEXT NOT NULL,
            partNumber TEXT,
            category TEXT,
            specification TEXT,
            unit TEXT DEFAULT 'Pcs',
            rackNumber TEXT,
            minStock REAL DEFAULT 0,
            notes TEXT,
            createdAt TEXT,
            updatedAt TEXT
        );

        CREATE TABLE IF NOT EXISTS general_item_transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            itemId INTEGER,
            txDate TEXT,
            txDateISO TEXT,
            txType TEXT,
            mrnNum TEXT,
            grnNum TEXT,
            vehicleMachinery TEXT,
            qty REAL DEFAULT 0,
            balance REAL DEFAULT 0,
            remarks TEXT,
            transferredToRack TEXT,
            createdAt TEXT,
            updatedAt TEXT,
            FOREIGN KEY (itemId) REFERENCES general_items(id)
        );

        CREATE INDEX IF NOT EXISTS idx_general_items_lookup ON general_items(rackNumber, category, itemName);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_general_items_name_rack ON general_items(itemName, rackNumber);
        CREATE INDEX IF NOT EXISTS idx_gi_tx_item_date ON general_item_transactions(itemId, txDateISO);
        CREATE INDEX IF NOT EXISTS idx_gi_tx_type ON general_item_transactions(txType);
    `);

    // Lightweight migration: add the category column if upgrading an older DB.
    try {
        const cols = all(`PRAGMA table_info(items)`);
        if (!cols.some(c => c.name === 'category')) {
            exec(`ALTER TABLE items ADD COLUMN category TEXT;`);
            exec(`CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);`);
        }
    } catch (e) { /* fresh DB already has it */ }

    // Link issues to the MRN line they draw from (requested -> received -> issued).
    // Add issues.itemId on older DBs, then one-time backfill of historical issues by
    // matching (mrnNum, itemName) first, then (vehicleMachinery, itemName). Unmatched
    // rows stay NULL (legacy) and are never re-touched, so manual issues are preserved.
    try {
        const cols = all(`PRAGMA table_info(issues)`);
        if (!cols.some(c => c.name === 'itemId')) {
            exec(`ALTER TABLE issues ADD COLUMN itemId INTEGER;`);

            exec(`
                UPDATE issues
                SET itemId = (
                    SELECT i.id FROM items i
                    WHERE i.mrnNum = issues.mrnNum
                      AND LOWER(TRIM(i.itemName)) = LOWER(TRIM(issues.itemName))
                    ORDER BY (SELECT COUNT(*) FROM receipts r WHERE r.itemId = i.id) DESC, i.id ASC
                    LIMIT 1
                )
                WHERE itemId IS NULL
                  AND mrnNum IS NOT NULL AND TRIM(mrnNum) != ''
                  AND TRIM(COALESCE(itemName,'')) != ''
                  AND EXISTS (
                    SELECT 1 FROM items i2
                    WHERE i2.mrnNum = issues.mrnNum
                      AND LOWER(TRIM(i2.itemName)) = LOWER(TRIM(issues.itemName))
                  );
            `);

            exec(`
                UPDATE issues
                SET itemId = (
                    SELECT i.id FROM items i
                    WHERE LOWER(TRIM(i.vehicleMachinery)) = LOWER(TRIM(issues.vehicleMachinery))
                      AND LOWER(TRIM(i.itemName)) = LOWER(TRIM(issues.itemName))
                    ORDER BY (SELECT COUNT(*) FROM receipts r WHERE r.itemId = i.id) DESC, i.id ASC
                    LIMIT 1
                )
                WHERE itemId IS NULL
                  AND TRIM(COALESCE(vehicleMachinery,'')) != ''
                  AND TRIM(COALESCE(itemName,'')) != ''
                  AND EXISTS (
                    SELECT 1 FROM items i2
                    WHERE LOWER(TRIM(i2.vehicleMachinery)) = LOWER(TRIM(issues.vehicleMachinery))
                      AND LOWER(TRIM(i2.itemName)) = LOWER(TRIM(issues.itemName))
                  );
            `);

            const linked = get(`SELECT COUNT(*) AS c FROM issues WHERE itemId IS NOT NULL`).c;
            const total = get(`SELECT COUNT(*) AS c FROM issues`).c;
            console.log(`[migrate] issues.itemId added; linked ${linked}/${total} historical issues to MRN lines.`);
        }
        // Ensure the index exists on both fresh and migrated databases.
        exec(`CREATE INDEX IF NOT EXISTS idx_issues_itemId ON issues(itemId);`);
    } catch (e) { console.warn('issues.itemId migration warning:', e.message); }

    // Requests carry the channel they should be fulfilled from (Local Purchase /
    // Head Office Purchase); deliveries then confirm the channel actually used.
    // One-time on add: normalize historical receipt sources to the two canonical
    // values and backfill requestSource where an item's receipts are unanimous.
    // Blank / genuinely mixed historical rows are left untouched (logged below)
    // so no data is invented; they can be corrected by hand on the Pricing desk.
    try {
        const cols = all(`PRAGMA table_info(items)`);
        if (!cols.some(c => c.name === 'requestSource')) {
            exec(`ALTER TABLE items ADD COLUMN requestSource TEXT;`);

            run(`UPDATE receipts SET purchaseSource = ?
                 WHERE LOWER(TRIM(COALESCE(purchaseSource,''))) IN (${LOCAL_ALIASES.map(() => '?').join(',')})
                   AND purchaseSource <> ?`,
                [SOURCE_LOCAL, ...LOCAL_ALIASES, SOURCE_LOCAL]);
            run(`UPDATE receipts SET purchaseSource = ?
                 WHERE LOWER(TRIM(COALESCE(purchaseSource,''))) IN (${HEAD_OFFICE_ALIASES.map(() => '?').join(',')})
                   AND purchaseSource <> ?`,
                [SOURCE_HEAD_OFFICE, ...HEAD_OFFICE_ALIASES, SOURCE_HEAD_OFFICE]);

            const leftover = all(`
                SELECT COALESCE(NULLIF(TRIM(purchaseSource),''),'(blank)') AS src, COUNT(*) AS c
                FROM receipts
                WHERE purchaseSource IS NULL OR TRIM(purchaseSource) = '' OR purchaseSource NOT IN (?, ?)
                GROUP BY 1`, [SOURCE_LOCAL, SOURCE_HEAD_OFFICE]);
            if (leftover.length) {
                console.log('[migrate] receipts.purchaseSource normalized; unresolved values kept as-is:',
                    leftover.map(r => `${r.src} x${r.c}`).join(', '));
            } else {
                console.log('[migrate] receipts.purchaseSource fully normalized.');
            }

            run(`UPDATE items SET requestSource = (
                    SELECT MIN(r.purchaseSource) FROM receipts r
                    WHERE r.itemId = items.id AND r.purchaseSource IN (?, ?)
                 )
                 WHERE requestSource IS NULL
                   AND (SELECT COUNT(DISTINCT r.purchaseSource) FROM receipts r
                        WHERE r.itemId = items.id AND r.purchaseSource IN (?, ?)) = 1`,
                [SOURCE_LOCAL, SOURCE_HEAD_OFFICE, SOURCE_LOCAL, SOURCE_HEAD_OFFICE]);
            const filled = get(`SELECT COUNT(*) AS c FROM items WHERE requestSource IS NOT NULL`).c;
            console.log(`[migrate] items.requestSource added; backfilled ${filled} items from their receipts.`);
        }
        exec(`CREATE INDEX IF NOT EXISTS idx_items_requestSource ON items(requestSource);`);
    } catch (e) { console.warn('requestSource migration warning:', e.message); }

    // General-item issue accountability: who received the item, who issued it.
    try {
        const cols = all(`PRAGMA table_info(general_item_transactions)`);
        if (!cols.some(c => c.name === 'issuedTo')) {
            exec(`ALTER TABLE general_item_transactions ADD COLUMN issuedTo TEXT;`);
            exec(`ALTER TABLE general_item_transactions ADD COLUMN issuedBy TEXT;`);
            console.log('[migrate] general_item_transactions: added issuedTo / issuedBy.');
        }
    } catch (e) { console.warn('general tx issuedTo migration warning:', e.message); }

    return db;
}

module.exports = {
    db, ENGINE, DB_FILE, init, all, get, run, exec, transaction, toISO, nowISO,
    SOURCE_LOCAL, SOURCE_HEAD_OFFICE, PURCHASE_SOURCES, canonicalSource,
};
