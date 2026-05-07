const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const { z } = require('zod');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const curriculum = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'content', 'curriculum.fr.json'), 'utf8')
);

const ACCESS_TOKEN_TTL_SEC = 60 * 60 * 8;
const REFRESH_TOKEN_TTL_SEC = 60 * 60 * 24 * 30;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

function nowIso() {
  return new Date().toISOString();
}

function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function setupDb(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS parents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS auth_tokens (
      token_id TEXT PRIMARY KEY,
      parent_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(parent_id) REFERENCES parents(id)
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      token_id TEXT PRIMARY KEY,
      parent_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked INTEGER NOT NULL DEFAULT 0,
      replaced_by TEXT,
      FOREIGN KEY(parent_id) REFERENCES parents(id)
    );

    CREATE TABLE IF NOT EXISTS login_attempts (
      email TEXT PRIMARY KEY,
      failed_count INTEGER NOT NULL DEFAULT 0,
      lock_until TEXT,
      last_failed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS security_audit_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_id INTEGER,
      email TEXT,
      event_type TEXT NOT NULL,
      ip TEXT,
      payload TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(parent_id) REFERENCES parents(id)
    );

    CREATE TABLE IF NOT EXISTS children (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_id INTEGER NOT NULL,
      first_name TEXT NOT NULL,
      grade TEXT NOT NULL,
      age INTEGER,
      strengths TEXT,
      weaknesses TEXT,
      points INTEGER NOT NULL DEFAULT 0,
      reading_level INTEGER NOT NULL DEFAULT 1,
      spelling_level INTEGER NOT NULL DEFAULT 1,
      math_level INTEGER NOT NULL DEFAULT 1,
      history_level INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY(parent_id) REFERENCES parents(id)
    );

    CREATE TABLE IF NOT EXISTS phrase_bank (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject TEXT NOT NULL,
      level INTEGER NOT NULL,
      mode TEXT NOT NULL,
      prompt TEXT NOT NULL,
      expected TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS review_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      child_id INTEGER NOT NULL,
      phrase TEXT NOT NULL,
      interval_days INTEGER NOT NULL DEFAULT 1,
      next_review_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      FOREIGN KEY(child_id) REFERENCES children(id)
    );

    CREATE TABLE IF NOT EXISTS homework (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      child_id INTEGER NOT NULL,
      subject TEXT NOT NULL,
      title TEXT NOT NULL,
      details TEXT,
      due_date TEXT,
      status TEXT NOT NULL DEFAULT 'todo',
      source TEXT NOT NULL DEFAULT 'manual',
      FOREIGN KEY(child_id) REFERENCES children(id)
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      child_id INTEGER NOT NULL,
      activity_type TEXT NOT NULL,
      score INTEGER,
      points_delta INTEGER NOT NULL DEFAULT 0,
      payload TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(child_id) REFERENCES children(id)
    );
  `);

  const phraseCount = db.prepare('SELECT COUNT(*) as count FROM phrase_bank').get().count;
  if (phraseCount === 0) {
    const seed = db.prepare('INSERT INTO phrase_bank (subject, level, mode, prompt, expected) VALUES (?, ?, ?, ?, ?)');
    const phrases = [
      ['Francais', 1, 'lecture', 'Lina adore lire des histoires courtes chaque soir.', 'Lina adore lire des histoires courtes chaque soir.'],
      ['Francais', 2, 'lecture', 'Le petit explorateur observe les etoiles dans le ciel sombre.', 'Le petit explorateur observe les etoiles dans le ciel sombre.'],
      ['Francais', 3, 'lecture', 'Pendant les vacances, la classe visite un musee sur la Revolution francaise.', 'Pendant les vacances, la classe visite un musee sur la Revolution francaise.'],
      ['Francais', 1, 'dictee', "Ecris: Les enfants jouent dans la cour de l'ecole.", "Les enfants jouent dans la cour de l'ecole."],
      ['Francais', 2, 'dictee', 'Ecris: Nous avons termine nos devoirs de mathematiques.', 'Nous avons termine nos devoirs de mathematiques.'],
      ['Francais', 3, 'dictee', 'Ecris: Mon frere raconte une histoire interessante.', 'Mon frere raconte une histoire interessante.'],
      ['Maths', 1, 'quiz', 'Combien font 9 + 7 ?', '16'],
      ['Maths', 2, 'quiz', 'Combien font 8 x 6 ?', '48'],
      ['Histoire', 1, 'quiz', 'Qui etait le premier empereur des Francais ?', 'Napoleon'],
      ['Histoire', 2, 'quiz', 'En quelle annee commence la Revolution francaise ?', '1789'],
    ];
    for (const row of phrases) seed.run(...row);
  }
}

function createToken(parentId, tokenId) {
  return jwt.sign({ sub: parentId, tid: tokenId }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL_SEC });
}

function computeExpiryIso() {
  return new Date(Date.now() + ACCESS_TOKEN_TTL_SEC * 1000).toISOString();
}

function computeRefreshExpiryIso() {
  return new Date(Date.now() + REFRESH_TOKEN_TTL_SEC * 1000).toISOString();
}

function hashOpaqueToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createApp(db) {
  const app = express();
  app.use(cors());
  app.use(express.json());
  const authAttempts = new Map();
  const MAX_FAILED_LOGINS = 5;
  const BASE_LOCK_MINUTES = 5;

  function rateLimitAuth(req, res, next) {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${req.path}:${ip}`;
    const now = Date.now();
    const windowMs = 60 * 1000;
    const maxAttempts = 15;
    const entry = authAttempts.get(key) || { count: 0, windowStart: now };
    if (now - entry.windowStart > windowMs) {
      entry.count = 0;
      entry.windowStart = now;
    }
    entry.count += 1;
    authAttempts.set(key, entry);
    if (entry.count > maxAttempts) {
      return res.status(429).json({ error: 'Too many auth attempts. Try again later.' });
    }
    next();
  }

  function logSecurityEvent({ parentId = null, email = null, eventType, ip = null, payload = {} }) {
    db.prepare(
      'INSERT INTO security_audit_events (parent_id, email, event_type, ip, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(parentId, email, eventType, ip, JSON.stringify(payload), nowIso());
  }

  function getLoginAttempt(email) {
    return db.prepare('SELECT * FROM login_attempts WHERE email = ?').get(email);
  }

  function markLoginFailure(email, ip) {
    const existing = getLoginAttempt(email);
    const failedCount = (existing?.failed_count || 0) + 1;
    const lockMultiplier = Math.max(0, failedCount - MAX_FAILED_LOGINS + 1);
    const lockMinutes = lockMultiplier > 0 ? BASE_LOCK_MINUTES * lockMultiplier : 0;
    const lockUntil = lockMinutes > 0 ? new Date(Date.now() + lockMinutes * 60 * 1000).toISOString() : null;

    db.prepare(
      `INSERT INTO login_attempts (email, failed_count, lock_until, last_failed_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET
         failed_count = excluded.failed_count,
         lock_until = excluded.lock_until,
         last_failed_at = excluded.last_failed_at`
    ).run(email, failedCount, lockUntil, nowIso());

    logSecurityEvent({
      email,
      eventType: lockUntil ? 'auth_login_locked' : 'auth_login_failed',
      ip,
      payload: { failedCount, lockUntil },
    });

    return { failedCount, lockUntil };
  }

  function clearLoginFailures(email) {
    db.prepare('DELETE FROM login_attempts WHERE email = ?').run(email);
  }

  function auth(req, res, next) {
    const raw = req.header('authorization') || '';
    const token = raw.replace('Bearer ', '').trim();
    if (!token) return res.status(401).json({ error: 'Missing token' });

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const row = db
      .prepare(
        "SELECT parent_id FROM auth_tokens WHERE token_id = ? AND revoked = 0 AND datetime(expires_at) > datetime('now')"
      )
      .get(decoded.tid);
    if (!row) return res.status(401).json({ error: 'Session expired or revoked' });

    req.parentId = row.parent_id;
    req.tokenId = decoded.tid;
    next();
  }

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/curriculum', (_req, res) => {
    res.json(curriculum);
  });

  app.post('/api/parents/register', rateLimitAuth, (req, res) => {
    const schema = z.object({
      name: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(8),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { name, email, password } = parsed.data;
    const hashed = bcrypt.hashSync(password, 12);

    try {
      const result = db
        .prepare('INSERT INTO parents (name, email, password, created_at) VALUES (?, ?, ?, ?)')
        .run(name, email.toLowerCase(), hashed, nowIso());
      logSecurityEvent({ parentId: result.lastInsertRowid, email: email.toLowerCase(), eventType: 'auth_register_success', ip: req.ip });
      return res.status(201).json({ parentId: result.lastInsertRowid });
    } catch {
      logSecurityEvent({ email: email.toLowerCase(), eventType: 'auth_register_conflict', ip: req.ip });
      return res.status(409).json({ error: 'Email already registered' });
    }
  });

  app.post('/api/parents/login', rateLimitAuth, (req, res) => {
    const schema = z.object({ email: z.string().email(), password: z.string().min(8) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const email = parsed.data.email.toLowerCase();
    const ip = req.ip || req.socket.remoteAddress || null;

    const attempt = getLoginAttempt(email);
    if (attempt?.lock_until && new Date(attempt.lock_until).getTime() > Date.now()) {
      logSecurityEvent({
        email,
        eventType: 'auth_login_blocked_lockout',
        ip,
        payload: { lockUntil: attempt.lock_until, failedCount: attempt.failed_count },
      });
      return res.status(423).json({ error: 'Account temporarily locked due to repeated failed logins' });
    }

    const parent = db
      .prepare('SELECT id, name, password FROM parents WHERE email = ?')
      .get(email);
    if (!parent) {
      markLoginFailure(email, ip);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    let valid = false;
    if (String(parent.password).startsWith('$2')) {
      valid = bcrypt.compareSync(parsed.data.password, parent.password);
    } else {
      const legacy = crypto.createHash('sha256').update(parsed.data.password).digest('hex');
      valid = legacy === parent.password;
      if (valid) {
        const upgraded = bcrypt.hashSync(parsed.data.password, 12);
        db.prepare('UPDATE parents SET password = ? WHERE id = ?').run(upgraded, parent.id);
      }
    }

    if (!valid) {
      markLoginFailure(email, ip);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    clearLoginFailures(email);

    const tokenId = crypto.randomUUID();
    const accessToken = createToken(parent.id, tokenId);
    const refreshToken = crypto.randomUUID();
    db.prepare('INSERT INTO auth_tokens (token_id, parent_id, created_at, expires_at, revoked) VALUES (?, ?, ?, ?, 0)').run(
      tokenId,
      parent.id,
      nowIso(),
      computeExpiryIso()
    );
    db.prepare(
      'INSERT INTO refresh_tokens (token_id, parent_id, token_hash, created_at, expires_at, revoked) VALUES (?, ?, ?, ?, ?, 0)'
    ).run(tokenId, parent.id, hashOpaqueToken(refreshToken), nowIso(), computeRefreshExpiryIso());

    logSecurityEvent({
      parentId: parent.id,
      email,
      eventType: 'auth_login_success',
      ip,
      payload: { tokenId },
    });

    return res.json({ token: accessToken, accessToken, refreshToken, parent: { id: parent.id, name: parent.name } });
  });

  app.post('/api/parents/refresh', rateLimitAuth, (req, res) => {
    const schema = z.object({ refreshToken: z.string().min(10) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const refreshHash = hashOpaqueToken(parsed.data.refreshToken);
    const current = db
      .prepare(
        "SELECT token_id, parent_id FROM refresh_tokens WHERE token_hash = ? AND revoked = 0 AND datetime(expires_at) > datetime('now')"
      )
      .get(refreshHash);
    if (!current) {
      logSecurityEvent({ eventType: 'auth_refresh_invalid', ip: req.ip });
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const nextTokenId = crypto.randomUUID();
    const nextAccessToken = createToken(current.parent_id, nextTokenId);
    const nextRefreshToken = crypto.randomUUID();

    const tx = db.transaction(() => {
      db.prepare('UPDATE auth_tokens SET revoked = 1 WHERE token_id = ?').run(current.token_id);
      db.prepare('UPDATE refresh_tokens SET revoked = 1, replaced_by = ? WHERE token_id = ?').run(nextTokenId, current.token_id);
      db.prepare('INSERT INTO auth_tokens (token_id, parent_id, created_at, expires_at, revoked) VALUES (?, ?, ?, ?, 0)').run(
        nextTokenId,
        current.parent_id,
        nowIso(),
        computeExpiryIso()
      );
      db.prepare(
        'INSERT INTO refresh_tokens (token_id, parent_id, token_hash, created_at, expires_at, revoked) VALUES (?, ?, ?, ?, ?, 0)'
      ).run(nextTokenId, current.parent_id, hashOpaqueToken(nextRefreshToken), nowIso(), computeRefreshExpiryIso());
    });
    tx();
    logSecurityEvent({
      parentId: current.parent_id,
      eventType: 'auth_refresh_success',
      ip: req.ip,
      payload: { previousTokenId: current.token_id, nextTokenId },
    });

    return res.json({ token: nextAccessToken, accessToken: nextAccessToken, refreshToken: nextRefreshToken });
  });

  app.post('/api/parents/logout', auth, (req, res) => {
    db.prepare('UPDATE auth_tokens SET revoked = 1 WHERE token_id = ?').run(req.tokenId);
    db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE token_id = ?').run(req.tokenId);
    logSecurityEvent({ parentId: req.parentId, eventType: 'auth_logout', ip: req.ip, payload: { tokenId: req.tokenId } });
    res.status(204).send();
  });

  app.post('/api/parents/children', auth, (req, res) => {
    const schema = z.object({
      firstName: z.string().min(1),
      grade: z.string().min(1),
      age: z.number().int().min(3).max(25),
      strengths: z.string().optional().default(''),
      weaknesses: z.string().optional().default(''),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const result = db
      .prepare(
        'INSERT INTO children (parent_id, first_name, grade, age, strengths, weaknesses, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        req.parentId,
        parsed.data.firstName,
        parsed.data.grade,
        parsed.data.age,
        parsed.data.strengths,
        parsed.data.weaknesses,
        nowIso()
      );

    res.status(201).json({ childId: result.lastInsertRowid });
  });

  app.get('/api/parents/children', auth, (req, res) => {
    const rows = db.prepare('SELECT * FROM children WHERE parent_id = ? ORDER BY id DESC').all(req.parentId);
    res.json(rows);
  });

  app.post('/api/evaluation/:childId', auth, (req, res) => {
    const childId = Number(req.params.childId);
    const child = db.prepare('SELECT * FROM children WHERE id = ? AND parent_id = ?').get(childId, req.parentId);
    if (!child) return res.status(404).json({ error: 'Child not found' });

    const ageWeight = child.age > 10 ? 65 : 52;
    const strengthBonus = (child.strengths || '').toLowerCase().includes('lecture') ? 12 : 0;
    const score = Math.min(95, ageWeight + strengthBonus);
    const readingLevel = score > 80 ? 3 : score > 60 ? 2 : 1;
    const spellingLevel = score > 75 ? 3 : score > 55 ? 2 : 1;

    db.prepare('UPDATE children SET reading_level = ?, spelling_level = ? WHERE id = ?').run(readingLevel, spellingLevel, childId);
    db.prepare('INSERT INTO activity_log (child_id, activity_type, score, points_delta, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      childId,
      'evaluation',
      score,
      0,
      JSON.stringify({ readingLevel, spellingLevel }),
      nowIso()
    );

    res.json({ score, readingLevel, spellingLevel });
  });

  app.get('/api/lesson/:childId', auth, (req, res) => {
    const childId = Number(req.params.childId);
    const subject = String(req.query.subject || 'Francais');

    const child = db.prepare('SELECT * FROM children WHERE id = ? AND parent_id = ?').get(childId, req.parentId);
    if (!child) return res.status(404).json({ error: 'Child not found' });

    const level = subject === 'Francais' ? child.reading_level : subject === 'Maths' ? child.math_level : child.history_level;
    const lesson =
      db.prepare('SELECT * FROM phrase_bank WHERE subject = ? AND mode = ? AND level = ? LIMIT 1').get(subject, subject === 'Francais' ? 'lecture' : 'quiz', level) ||
      db.prepare('SELECT * FROM phrase_bank WHERE subject = ? LIMIT 1').get(subject);
    const dictation =
      subject === 'Francais'
        ? db.prepare('SELECT * FROM phrase_bank WHERE subject = ? AND mode = ? AND level = ? LIMIT 1').get('Francais', 'dictee', child.spelling_level)
        : null;

    const review = db
      .prepare(
        "SELECT * FROM review_queue WHERE child_id = ? AND status = 'pending' AND datetime(next_review_at) <= datetime('now') ORDER BY next_review_at ASC LIMIT 1"
      )
      .get(childId);

    res.json({ lesson, dictation, review });
  });

  app.post('/api/session/:childId/dictation', auth, (req, res) => {
    const schema = z.object({ expected: z.string().min(1), answer: z.string().min(1) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const childId = Number(req.params.childId);
    const child = db.prepare('SELECT * FROM children WHERE id = ? AND parent_id = ?').get(childId, req.parentId);
    if (!child) return res.status(404).json({ error: 'Child not found' });

    const a = parsed.data.answer.trim().toLowerCase();
    const e = parsed.data.expected.trim().toLowerCase();
    let same = 0;
    for (let i = 0; i < Math.min(a.length, e.length); i += 1) if (a[i] === e[i]) same += 1;
    const score = Math.max(0, Math.round((same / e.length) * 100));
    const points = score > 80 ? 20 : 10;

    db.prepare('UPDATE children SET points = points + ? WHERE id = ?').run(points, childId);
    db.prepare('INSERT INTO activity_log (child_id, activity_type, score, points_delta, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      childId,
      'dictation',
      score,
      points,
      JSON.stringify({ expected: parsed.data.expected }),
      nowIso()
    );

    if (score < 100) {
      db.prepare('INSERT INTO review_queue (child_id, phrase, interval_days, next_review_at, status) VALUES (?, ?, ?, ?, ?)').run(
        childId,
        parsed.data.expected,
        1,
        addDays(1),
        'pending'
      );
    }

    res.json({ score, points, feedback: score === 100 ? 'Excellent, aucune faute.' : `Score ${score}/100. Corrige puis reecris la phrase.` });
  });

  app.post('/api/review/:reviewId/complete', auth, (req, res) => {
    const schema = z.object({ success: z.boolean() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const reviewId = Number(req.params.reviewId);
    const review = db
      .prepare('SELECT r.*, c.parent_id FROM review_queue r JOIN children c ON c.id = r.child_id WHERE r.id = ?')
      .get(reviewId);
    if (!review || review.parent_id !== req.parentId) return res.status(404).json({ error: 'Review item not found' });

    if (!parsed.data.success) {
      db.prepare('UPDATE review_queue SET next_review_at = ?, interval_days = 1 WHERE id = ?').run(addDays(1), reviewId);
      return res.json({ status: 'rescheduled' });
    }

    const nextInterval = Math.min(30, review.interval_days * 2);
    db.prepare('UPDATE review_queue SET interval_days = ?, next_review_at = ? WHERE id = ?').run(nextInterval, addDays(nextInterval), reviewId);
    res.json({ status: 'completed', nextInterval });
  });

  app.post('/api/homework/:childId', auth, (req, res) => {
    const schema = z.object({
      subject: z.string().min(1),
      title: z.string().min(1),
      details: z.string().optional().default(''),
      dueDate: z.string().optional().default(''),
      source: z.enum(['manual', 'pronote-import']).default('manual'),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const childId = Number(req.params.childId);
    const child = db.prepare('SELECT * FROM children WHERE id = ? AND parent_id = ?').get(childId, req.parentId);
    if (!child) return res.status(404).json({ error: 'Child not found' });

    const result = db
      .prepare('INSERT INTO homework (child_id, subject, title, details, due_date, source) VALUES (?, ?, ?, ?, ?, ?)')
      .run(childId, parsed.data.subject, parsed.data.title, parsed.data.details, parsed.data.dueDate, parsed.data.source);
    res.status(201).json({ homeworkId: result.lastInsertRowid });
  });

  app.get('/api/homework/:childId', auth, (req, res) => {
    const childId = Number(req.params.childId);
    const child = db.prepare('SELECT * FROM children WHERE id = ? AND parent_id = ?').get(childId, req.parentId);
    if (!child) return res.status(404).json({ error: 'Child not found' });
    const rows = db.prepare('SELECT * FROM homework WHERE child_id = ? ORDER BY id DESC').all(childId);
    res.json(rows);
  });

  app.get('/api/parents/dashboard', auth, (req, res) => {
    const children = db.prepare('SELECT * FROM children WHERE parent_id = ?').all(req.parentId);
    const totals = children.reduce(
      (acc, c) => {
        acc.points += c.points;
        acc.children += 1;
        return acc;
      },
      { points: 0, children: 0 }
    );

    const progress = children.map((child) => {
      const recent = db.prepare('SELECT activity_type, score, points_delta, created_at FROM activity_log WHERE child_id = ? ORDER BY id DESC LIMIT 8').all(child.id);
      const pendingReviews = db.prepare("SELECT COUNT(*) as c FROM review_queue WHERE child_id = ? AND status = 'pending'").get(child.id).c;
      return {
        childId: child.id,
        childName: child.first_name,
        readingLevel: child.reading_level,
        spellingLevel: child.spelling_level,
        points: child.points,
        pendingReviews,
        recent,
      };
    });

    res.json({ totals, progress });
  });

  app.get('/api/parents/security', auth, (req, res) => {
    const recentEvents = db
      .prepare(
        'SELECT event_type, ip, created_at FROM security_audit_events WHERE parent_id = ? ORDER BY id DESC LIMIT 20'
      )
      .all(req.parentId);
    const sessionStats = db
      .prepare(
        "SELECT COUNT(*) as activeAccess FROM auth_tokens WHERE parent_id = ? AND revoked = 0 AND datetime(expires_at) > datetime('now')"
      )
      .get(req.parentId);
    const activeRefresh = db
      .prepare(
        "SELECT COUNT(*) as activeRefresh FROM refresh_tokens WHERE parent_id = ? AND revoked = 0 AND datetime(expires_at) > datetime('now')"
      )
      .get(req.parentId);
    res.json({
      activeAccessSessions: sessionStats.activeAccess,
      activeRefreshSessions: activeRefresh.activeRefresh,
      recentEvents,
    });
  });

  app.get('/api/recommendations/:childId', auth, (req, res) => {
    const childId = Number(req.params.childId);
    const child = db.prepare('SELECT * FROM children WHERE id = ? AND parent_id = ?').get(childId, req.parentId);
    if (!child) return res.status(404).json({ error: 'Child not found' });

    const gradeData = curriculum.grades.find((g) => g.grade === child.grade);
    if (!gradeData) {
      return res.json({ grade: child.grade, recommendations: [], note: 'Aucun contenu grade exact. Utiliser parcours niveau voisin.' });
    }

    const weaknessText = (child.weaknesses || '').toLowerCase();
    const subjects = Object.keys(gradeData.subjects);
    const recommendations = subjects.map((subjectName) => {
      const subjectData = gradeData.subjects[subjectName];
      const matchedCompetencies = subjectData.competencies.filter((item) =>
        weaknessText.length > 0 ? item.toLowerCase().includes(weaknessText.split(' ')[0]) : true
      );
      return {
        subject: subjectName,
        competencies: matchedCompetencies.length > 0 ? matchedCompetencies : subjectData.competencies.slice(0, 2),
        microLessons: subjectData.microLessons.slice(0, 2),
      };
    });

    res.json({
      grade: child.grade,
      cycle: gradeData.cycle,
      recommendations,
      sources: curriculum.metadata.sources,
    });
  });

  return app;
}

function createDb(dbPath = process.env.DB_PATH || 'educoach.db') {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  setupDb(db);
  return db;
}

if (require.main === module) {
  const db = createDb();
  const app = createApp(db);
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`EduCoach API running on port ${PORT}`);
  });
}

module.exports = { createApp, createDb, setupDb };
