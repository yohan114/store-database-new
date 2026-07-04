/**
 * auth.js — Accounts, roles, sessions and audit trail (Phase 1 of the rebuild).
 *
 * Design notes
 *  - Passwords: hashed with Node's built-in scrypt (no native dependency, no
 *    extra npm package, safe to run on the office Windows PC).
 *  - Sessions: opaque random bearer tokens stored server-side (only their SHA-256
 *    hash is kept). This makes logout/deactivation instantly revocable and avoids
 *    JWT secret-key management — a good fit for a LAN app on SQLite.
 *  - Roles: 'admin' (everything incl. user management), 'storekeeper'
 *    (create/update/delete operational data), 'viewer' (read-only).
 *  - Transition-friendly: existing GET endpoints stay open so the legacy
 *    item_tracker.html keeps working while screens are ported. Mutations are
 *    audited; deletes accept a logged-in storekeeper/admin OR the old shared
 *    password (kept as a fallback, disable with LEGACY_DELETE_PASSWORD="").
 */
const crypto = require('crypto');
const dbApi = require('./db');

const ROLES = ['admin', 'storekeeper', 'viewer'];
const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS || 7);

// Legacy shared delete password — kept working only as a migration fallback for
// the old UI. Set LEGACY_DELETE_PASSWORD="" (or "off") to disable it once the
// legacy screens are fully retired.
const LEGACY_DELETE_PASSWORD =
  process.env.LEGACY_DELETE_PASSWORD === undefined ? 'E&CWorkshop' : process.env.LEGACY_DELETE_PASSWORD;

// ---- password hashing (scrypt, no native deps) ----------------------------
function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(pw), salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}
function verifyPassword(pw, stored) {
  try {
    const [scheme, saltHex, hashHex] = String(stored).split('$');
    if (scheme !== 'scrypt') return false;
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    const actual = crypto.scryptSync(String(pw), salt, expected.length);
    return expected.length === actual.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

// ---- session tokens --------------------------------------------------------
const newToken = () => crypto.randomBytes(32).toString('base64url');
const hashToken = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
const publicUser = (u) => ({ id: u.id, username: u.username, role: u.role, fullName: u.fullName });

// ---- schema + first-run seed ----------------------------------------------
function ensureSchema() {
  dbApi.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      passwordHash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'viewer',
      fullName TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT,
      lastLoginAt TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tokenHash TEXT UNIQUE NOT NULL,
      userId INTEGER NOT NULL,
      createdAt TEXT,
      expiresAt TEXT,
      lastSeenAt TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(tokenHash);
    CREATE INDEX IF NOT EXISTS idx_sessions_user  ON sessions(userId);

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      createdAt TEXT,
      userId INTEGER,
      username TEXT,
      role TEXT,
      action TEXT,
      entity TEXT,
      entityId TEXT,
      method TEXT,
      path TEXT,
      details TEXT,
      ip TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(createdAt);
    CREATE INDEX IF NOT EXISTS idx_audit_user    ON audit_log(username);
    CREATE INDEX IF NOT EXISTS idx_audit_entity  ON audit_log(entity);
  `);

  const count = dbApi.get(`SELECT COUNT(*) c FROM users`).c;
  if (count === 0) {
    const username = process.env.ADMIN_DEFAULT_USER || 'admin';
    const pw = process.env.ADMIN_DEFAULT_PASSWORD || 'admin123';
    dbApi.run(
      `INSERT INTO users (username, passwordHash, role, fullName, active, createdAt) VALUES (?,?,?,?,1,?)`,
      [username, hashPassword(pw), 'admin', 'Administrator', dbApi.nowISO()]
    );
    console.log('============================================================');
    console.log(`  Created default admin account:  ${username} / ${pw}`);
    console.log('  >> Log in and change this password immediately. <<');
    console.log('============================================================');
  }

  // Best-effort cleanup of expired sessions on boot.
  try {
    dbApi.run(`DELETE FROM sessions WHERE expiresAt < ?`, [dbApi.nowISO()]);
  } catch (_) {}
}

// ---- request middleware ----------------------------------------------------
// Populates req.user from a Bearer token when present. Never blocks: open GET
// endpoints keep serving the legacy UI; protection is added per-route.
function attachUser(req, res, next) {
  if (!req.path.startsWith('/api/')) return next();
  const h = req.headers['authorization'] || '';
  if (h.startsWith('Bearer ')) {
    const token = h.slice(7).trim();
    if (token) {
      try {
        const row = dbApi.get(
          `SELECT s.id sid, s.expiresAt, u.id uid, u.username, u.role, u.fullName, u.active
             FROM sessions s JOIN users u ON u.id = s.userId
            WHERE s.tokenHash = ?`,
          [hashToken(token)]
        );
        if (row && row.active && new Date(row.expiresAt) > new Date()) {
          req.user = { id: row.uid, username: row.username, role: row.role, fullName: row.fullName };
          req.sessionId = row.sid;
        }
      } catch (_) {}
    }
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Insufficient permissions.' });
    next();
  };
}

// Delete authorization: a logged-in admin/storekeeper, OR the legacy shared
// password (migration fallback only).
function requireDelete(req, res, next) {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'storekeeper')) return next();
  const provided = req.headers['x-delete-password'] || req.query.password;
  if (LEGACY_DELETE_PASSWORD && provided === LEGACY_DELETE_PASSWORD) return next();
  return res.status(403).json({ error: 'Unauthorized: log in as Storekeeper or Admin to delete.' });
}

// ---- audit trail -----------------------------------------------------------
const SKIP_AUDIT_PATHS = new Set(['/api/auth/login', '/api/auth/logout', '/api/auth/me']);

function clip(str, n = 2000) {
  str = String(str);
  return str.length > n ? str.slice(0, n) + '…' : str;
}
function redact(body) {
  if (!body || typeof body !== 'object') return body;
  const clone = Array.isArray(body) ? [...body] : { ...body };
  for (const k of Object.keys(clone)) {
    if (/password/i.test(k)) clone[k] = '***';
  }
  return clone;
}

function recordAudit(req, res, extra = {}) {
  const parts = req.path.split('/').filter(Boolean); // e.g. ['api','items','5']
  const entity = extra.entity !== undefined ? extra.entity : parts[1] || '';
  let entityId = extra.entityId;
  let action = extra.action;
  if (entityId === undefined) {
    const tail = parts[2];
    if (tail && /^\d+$/.test(tail)) entityId = tail;
    else if (tail) action = action || tail;
  }
  action = action || req.method.toLowerCase();

  let details = extra.details;
  if (details === undefined) {
    if (req.path === '/api/import' || req.path === '/api/import/pdf') {
      details = '(bulk import)';
    } else {
      try { details = clip(JSON.stringify(redact(req.body || {}))); } catch { details = ''; }
    }
  }

  try {
    dbApi.run(
      `INSERT INTO audit_log (createdAt, userId, username, role, action, entity, entityId, method, path, details, ip)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        dbApi.nowISO(),
        req.user ? req.user.id : null,
        req.user ? req.user.username : 'legacy',
        req.user ? req.user.role : null,
        action,
        entity,
        entityId !== undefined ? String(entityId) : null,
        req.method,
        req.path,
        details,
        req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || '',
      ]
    );
  } catch (_) {
    /* auditing must never break a request */
  }
}

// Global: audit every successful mutating /api request.
function auditMiddleware(req, res, next) {
  const mutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  if (mutating && req.path.startsWith('/api/') && !SKIP_AUDIT_PATHS.has(req.path)) {
    res.on('finish', () => {
      if (res.statusCode < 400) recordAudit(req, res);
    });
  }
  next();
}

// ---- routes ----------------------------------------------------------------
function registerRoutes(app) {
  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' });
    const user = dbApi.get(`SELECT * FROM users WHERE username = ? COLLATE NOCASE`, [String(username).trim()]);
    if (!user || !user.active || !verifyPassword(password, user.passwordHash)) {
      recordAudit(req, res, { action: 'login_failed', entity: 'auth', details: `username=${String(username).slice(0, 60)}` });
      return res.status(401).json({ error: 'Invalid username or password.' });
    }
    const token = newToken();
    const now = new Date();
    const exp = new Date(now.getTime() + SESSION_TTL_DAYS * 86400000);
    dbApi.run(
      `INSERT INTO sessions (tokenHash, userId, createdAt, expiresAt, lastSeenAt) VALUES (?,?,?,?,?)`,
      [hashToken(token), user.id, now.toISOString(), exp.toISOString(), now.toISOString()]
    );
    dbApi.run(`UPDATE users SET lastLoginAt = ? WHERE id = ?`, [now.toISOString(), user.id]);
    req.user = publicUser(user);
    recordAudit(req, res, { action: 'login', entity: 'auth', entityId: user.id, details: '' });
    res.json({ token, user: publicUser(user) });
  });

  app.post('/api/auth/logout', (req, res) => {
    if (req.sessionId) {
      try { dbApi.run(`DELETE FROM sessions WHERE id = ?`, [req.sessionId]); } catch (_) {}
    }
    res.json({ success: true });
  });

  app.get('/api/auth/me', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated.' });
    res.json({ user: req.user });
  });

  // --- user management (admin only) ---
  app.get('/api/users', requireRole('admin'), (req, res) => {
    const rows = dbApi.all(
      `SELECT id, username, role, fullName, active, createdAt, lastLoginAt
         FROM users ORDER BY username COLLATE NOCASE`
    );
    res.json(rows);
  });

  app.post('/api/users', requireRole('admin'), (req, res) => {
    const { username, password, role, fullName } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' });
    if (role && !ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role.' });
    const exists = dbApi.get(`SELECT id FROM users WHERE username = ? COLLATE NOCASE`, [String(username).trim()]);
    if (exists) return res.status(409).json({ error: 'That username already exists.' });
    const r = dbApi.run(
      `INSERT INTO users (username, passwordHash, role, fullName, active, createdAt) VALUES (?,?,?,?,1,?)`,
      [String(username).trim(), hashPassword(password), role || 'viewer', fullName || '', dbApi.nowISO()]
    );
    res.json({ success: true, id: r.lastInsertRowid });
  });

  app.put('/api/users/:id', requireRole('admin'), (req, res) => {
    const id = parseInt(req.params.id);
    const target = dbApi.get(`SELECT * FROM users WHERE id = ?`, [id]);
    if (!target) return res.status(404).json({ error: 'User not found.' });
    const { role, fullName, active, password } = req.body || {};
    if (role && !ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role.' });

    // Guard: never strand the system without an admin.
    const willBeAdmin = (role || target.role) === 'admin';
    const willBeActive = active === undefined ? !!target.active : !!active;
    if (target.role === 'admin' && (!willBeAdmin || !willBeActive)) {
      const otherAdmins = dbApi.get(`SELECT COUNT(*) c FROM users WHERE role='admin' AND active=1 AND id<>?`, [id]).c;
      if (otherAdmins === 0) return res.status(400).json({ error: 'Cannot remove the last active admin.' });
    }

    const fields = [], params = [];
    if (role !== undefined) { fields.push('role=?'); params.push(role); }
    if (fullName !== undefined) { fields.push('fullName=?'); params.push(fullName); }
    if (active !== undefined) { fields.push('active=?'); params.push(active ? 1 : 0); }
    if (password) { fields.push('passwordHash=?'); params.push(hashPassword(password)); }
    if (fields.length) {
      params.push(id);
      dbApi.run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);
    }
    // Revoke sessions when an account is disabled.
    if (active !== undefined && !active) {
      try { dbApi.run(`DELETE FROM sessions WHERE userId = ?`, [id]); } catch (_) {}
    }
    res.json({ success: true });
  });

  app.delete('/api/users/:id', requireRole('admin'), (req, res) => {
    const id = parseInt(req.params.id);
    const target = dbApi.get(`SELECT * FROM users WHERE id = ?`, [id]);
    if (!target) return res.status(404).json({ error: 'User not found.' });
    if (req.user && req.user.id === id) return res.status(400).json({ error: 'You cannot delete your own account.' });
    if (target.role === 'admin') {
      const otherAdmins = dbApi.get(`SELECT COUNT(*) c FROM users WHERE role='admin' AND active=1 AND id<>?`, [id]).c;
      if (otherAdmins === 0) return res.status(400).json({ error: 'Cannot delete the last active admin.' });
    }
    // Soft delete: deactivate and drop sessions, preserving audit history.
    dbApi.run(`UPDATE users SET active=0 WHERE id = ?`, [id]);
    try { dbApi.run(`DELETE FROM sessions WHERE userId = ?`, [id]); } catch (_) {}
    res.json({ success: true });
  });

  // --- audit log (admin only) ---
  app.get('/api/audit', requireRole('admin'), (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const offset = parseInt(req.query.offset) || 0;
    const where = [], params = [];
    if (req.query.user) { where.push('username = ?'); params.push(req.query.user); }
    if (req.query.entity) { where.push('entity = ?'); params.push(req.query.entity); }
    if (req.query.action) { where.push('action = ?'); params.push(req.query.action); }
    const wsql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const total = dbApi.get(`SELECT COUNT(*) c FROM audit_log ${wsql}`, params).c;
    const rows = dbApi.all(`SELECT * FROM audit_log ${wsql} ORDER BY id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
    res.json({ total, rows });
  });
}

module.exports = {
  ROLES,
  ensureSchema,
  attachUser,
  auditMiddleware,
  requireAuth,
  requireRole,
  requireDelete,
  registerRoutes,
  hashPassword,
  verifyPassword,
};
