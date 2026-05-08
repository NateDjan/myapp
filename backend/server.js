const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const { z } = require('zod');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { buildFrenchEvaluationQuestions } = require('./frenchEval');

const curriculum = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'content', 'curriculum.fr.json'), 'utf8')
);

const ACCESS_TOKEN_TTL_SEC = 60 * 60 * 8;
const REFRESH_TOKEN_TTL_SEC = 60 * 60 * 24 * 30;
const STUDENT_ACCESS_TOKEN_TTL_SEC = 60 * 60 * 24 * 7;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const SERVICE_NAME = 'educoach-api';

if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'dev-secret-change-me') {
    console.error('[fatal] JWT_SECRET doit etre defini en production (secret fort, pas la valeur dev).');
    process.exit(1);
  }
}

function nowIso() {
  return new Date().toISOString();
}

function log(level, event, data = {}) {
  const payload = {
    ts: nowIso(),
    level,
    service: SERVICE_NAME,
    event,
    ...data,
  };
  const line = JSON.stringify(payload);
  if (level === 'error') {
    console.error(line);
    return;
  }
  console.log(line);
}

function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function migrateChildrenCredentials(db) {
  try {
    const cols = db.prepare('PRAGMA table_info(children)').all();
    const names = new Set(cols.map((c) => c.name));
    if (!names.has('student_login')) {
      db.exec('ALTER TABLE children ADD COLUMN student_login TEXT');
    }
    if (!names.has('student_password')) {
      db.exec('ALTER TABLE children ADD COLUMN student_password TEXT');
    }
    db.exec(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_children_student_login_unique ON children(student_login) WHERE student_login IS NOT NULL AND trim(student_login) != ''`
    );
  } catch (e) {
    log('error', 'migration_children_credentials_failed', { error: String(e) });
  }
}

function migrateSubjectTracking(db) {
  try {
    const cols = db.prepare('PRAGMA table_info(children)').all();
    const names = new Set(cols.map((c) => c.name));
    if (!names.has('subject_levels_json')) db.exec('ALTER TABLE children ADD COLUMN subject_levels_json TEXT');
    if (!names.has('evaluation_by_subject_json')) db.exec('ALTER TABLE children ADD COLUMN evaluation_by_subject_json TEXT');
    if (!names.has('optional_subjects_json')) db.exec('ALTER TABLE children ADD COLUMN optional_subjects_json TEXT');
  } catch (e) {
    log('error', 'migration_subject_tracking_failed', { error: String(e) });
  }
}

function migrateParentAndRewardTracking(db) {
  try {
    const parentCols = db.prepare("PRAGMA table_info('parents')").all();
    const pNames = new Set(parentCols.map((c) => c.name));
    if (!pNames.has('first_name')) db.exec('ALTER TABLE parents ADD COLUMN first_name TEXT');
    if (!pNames.has('last_name')) db.exec('ALTER TABLE parents ADD COLUMN last_name TEXT');

    const childCols = db.prepare("PRAGMA table_info('children')").all();
    const cNames = new Set(childCols.map((c) => c.name));
    if (!cNames.has('screen_time_earned_min')) db.exec('ALTER TABLE children ADD COLUMN screen_time_earned_min INTEGER NOT NULL DEFAULT 0');
  } catch (e) {
    log('error', 'migration_parent_reward_tracking_failed', { error: String(e) });
  }
}

function migrateEngagementTracking(db) {
  try {
    const childCols = db.prepare("PRAGMA table_info('children')").all();
    const cNames = new Set(childCols.map((c) => c.name));
    if (!cNames.has('avatar_id')) db.exec("ALTER TABLE children ADD COLUMN avatar_id TEXT NOT NULL DEFAULT 'fox'");
    if (!cNames.has('xp_total')) db.exec('ALTER TABLE children ADD COLUMN xp_total INTEGER NOT NULL DEFAULT 0');
    if (!cNames.has('streak_days')) db.exec('ALTER TABLE children ADD COLUMN streak_days INTEGER NOT NULL DEFAULT 0');
    if (!cNames.has('badges_json')) db.exec("ALTER TABLE children ADD COLUMN badges_json TEXT NOT NULL DEFAULT '[]'");
  } catch (e) {
    log('error', 'migration_engagement_tracking_failed', { error: String(e) });
  }
}

function safeJson(s, fallback) {
  try {
    return s && typeof s === 'string' ? JSON.parse(s) : fallback;
  } catch {
    return fallback;
  }
}

function gradeSubjectsFromCurriculum(grade) {
  const g = curriculum.grades.find((x) => x.grade === grade);
  return g ? Object.keys(g.subjects) : ['Francais', 'Maths'];
}

function allCurriculumSubjectNames() {
  const s = new Set();
  for (const g of curriculum.grades) {
    Object.keys(g.subjects || {}).forEach((k) => s.add(k));
  }
  return [...s].sort();
}

/** Matieres presentes dans le programme mais pas dans cette classe (activation parent). */
function optionalSubjectsForGrade(grade) {
  const inGrade = new Set(gradeSubjectsFromCurriculum(grade));
  return allCurriculumSubjectNames().filter((name) => !inGrade.has(name));
}

function defaultSubjectLevelsFromLegacy(child) {
  const fr = Number(child.reading_level) || 1;
  const ma = Number(child.math_level) || 1;
  const hi = Number(child.history_level) || 1;
  return {
    Francais: { tier: Math.min(3, Math.max(1, fr)), streak: 0 },
    Maths: { tier: Math.min(3, Math.max(1, ma)), streak: 0 },
    Histoire: { tier: Math.min(3, Math.max(1, hi)), streak: 0 },
  };
}

function mergeChildSubjectState(child) {
  let levels = safeJson(child.subject_levels_json, null);
  if (!levels || Object.keys(levels).length === 0) {
    levels = defaultSubjectLevelsFromLegacy(child);
  }
  for (const sub of ['Francais', 'Maths', 'Histoire']) {
    if (!levels[sub]) levels[sub] = { tier: 1, streak: 0 };
    if (typeof levels[sub].tier !== 'number') levels[sub].tier = 1;
    if (typeof levels[sub].streak !== 'number') levels[sub].streak = 0;
    levels[sub].tier = Math.min(3, Math.max(1, levels[sub].tier));
  }
  const evals = safeJson(child.evaluation_by_subject_json, {});
  const optionalEnabled = safeJson(child.optional_subjects_json, []);
  return { levels, evals, optionalEnabled };
}

function subjectsAvailableForChild(child) {
  const inGrade = gradeSubjectsFromCurriculum(child.grade);
  const { optionalEnabled } = mergeChildSubjectState(child);
  const optionalPool = optionalSubjectsForGrade(child.grade);
  const extras = optionalEnabled.filter((s) => optionalPool.includes(s));
  return [...new Set([...inGrade, ...extras])];
}

function getSubjectTier(levels, subject) {
  const t = levels[subject]?.tier;
  return t >= 1 && t <= 3 ? t : 1;
}

function speechTextFromDictee(prompt, expected) {
  const p = String(prompt || '');
  if (/^Ecris\s*:/i.test(p)) {
    return String(expected || '').trim();
  }
  return String(expected || prompt || '').trim();
}

function scoreWrittenAnswer(expected, answer) {
  const a = String(answer || '')
    .trim()
    .toLowerCase();
  const e = String(expected || '')
    .trim()
    .toLowerCase();
  if (!e.length) return 0;
  if (e === a) return 100;
  let same = 0;
  const n = Math.min(a.length, e.length);
  for (let i = 0; i < n; i += 1) if (a[i] === e[i]) same += 1;
  return Math.max(0, Math.round((same / e.length) * 100));
}

function stripLightPunctuation(s) {
  return String(s || '')
    .replace(/['']/g, "'")
    .replace(/[.,!?;:«»"""'''()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function foldAccents(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Correction plus tolerante pour le francais oral/ecrit (accents, ponctuation legere). */
function scoreFrenchWrittenAnswer(expected, answer) {
  const norm = (x) =>
    stripLightPunctuation(foldAccents(String(x || '').toLowerCase()))
      .replace(/\s+/g, ' ')
      .trim();
  const e = norm(expected);
  const a = norm(answer);
  if (!e.length) return 0;
  if (e === a) return 100;
  const compactE = e.replace(/\s+/g, '');
  const compactA = a.replace(/\s+/g, '');
  if (compactE.length && compactE === compactA) return 100;
  let same = 0;
  const n = Math.min(a.length, e.length);
  for (let i = 0; i < n; i += 1) if (a[i] === e[i]) same += 1;
  return Math.max(0, Math.round((same / Math.max(e.length, 1)) * 100));
}

function gradeBand(grade) {
  if (['CP', 'CE1', 'CE2'].includes(grade)) return 'cycle2';
  if (['CM1', 'CM2', '6e'].includes(grade)) return 'cycle3';
  if (['5e', '4e', '3e'].includes(grade)) return 'cycle4';
  return 'lycee';
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateMathQuestion(grade, tier) {
  const band = gradeBand(grade);
  if (band === 'cycle2') {
    const max = tier === 1 ? 20 : tier === 2 ? 100 : 200;
    const a = randomInt(1, max);
    const b = randomInt(1, max);
    const op = tier === 1 ? '+' : ['+', '-', '+'][randomInt(0, 2)];
    const expected = op === '+' ? String(a + b) : String(a - b);
    return { prompt: `Calcule: ${a} ${op} ${b}`, expected, type: 'math' };
  }
  if (band === 'cycle3') {
    const op = ['+', '-', 'x'][randomInt(0, 2)];
    if (op === 'x') {
      const a = randomInt(2, tier === 1 ? 9 : 12);
      const b = randomInt(2, tier === 1 ? 9 : 12);
      return { prompt: `Calcule: ${a} x ${b}`, expected: String(a * b), type: 'math' };
    }
    const a = randomInt(20, tier === 1 ? 120 : 300);
    const b = randomInt(10, tier === 1 ? 90 : 200);
    return { prompt: `Calcule: ${a} ${op} ${b}`, expected: String(op === '+' ? a + b : a - b), type: 'math' };
  }
  if (band === 'cycle4') {
    const a = randomInt(2, 20);
    const b = randomInt(2, 20);
    const c = randomInt(1, 15);
    return {
      prompt: `Calcule: (${a} x ${b}) - ${c}`,
      expected: String(a * b - c),
      type: 'math',
    };
  }
  const a = randomInt(1, 12);
  const b = randomInt(1, 12);
  const c = randomInt(1, 8);
  return {
    prompt: `Calcule: (${a}² + ${b}²) - ${c}`,
    expected: String(a * a + b * b - c),
    type: 'math',
  };
}

function generateFrenchDictationQuestion(tier) {
  const pools = {
    1: [
      "Les oiseaux chantent dans l'arbre.",
      'Le chat dort sur le tapis.',
      "Nous allons a l'ecole ce matin.",
    ],
    2: [
      'Les eleves relisent attentivement la lecon de grammaire.',
      'Mon frere a termine ses devoirs avant le diner.',
      'La maitresse explique calmement la consigne.',
    ],
    3: [
      "Pendant les vacances, nous avons visite un musee d'histoire.",
      'Les scientifiques observent les etoiles avec precision.',
      'La bibliotheque municipale organise un concours de lecture.',
    ],
  };
  const phrase = pools[Math.min(3, Math.max(1, tier))][randomInt(0, 2)];
  return {
    prompt: 'Ecris la phrase dictee (elle est lue a voix haute).',
    expected: phrase,
    readAloudText: phrase,
    type: 'french-dictation',
  };
}

function generateHistoryQuestion(grade, tier) {
  const band = gradeBand(grade);
  const bank =
    band === 'cycle2'
      ? [
          { prompt: "Combien de jours y a-t-il dans une semaine ?", expected: '7' },
          { prompt: "Quel est le mois qui suit janvier ?", expected: 'fevrier' },
        ]
      : band === 'cycle3'
        ? [
            { prompt: "En quelle annee commence la Revolution francaise ?", expected: '1789' },
            { prompt: "Qui etait le premier empereur des Francais ?", expected: 'napoleon' },
          ]
        : band === 'cycle4'
          ? [
              { prompt: "En quelle annee debute la Premiere Guerre mondiale ?", expected: '1914' },
              { prompt: "En quelle annee se termine la Seconde Guerre mondiale ?", expected: '1945' },
            ]
          : [
              { prompt: "Donne l'annee de chute du mur de Berlin.", expected: '1989' },
              { prompt: "Donne l'annee du traite de Maastricht.", expected: '1992' },
            ];
  const q = bank[randomInt(0, bank.length - 1)];
  return { prompt: q.prompt, expected: q.expected, type: 'history' };
}

function generateSubjectQuestion(child, subject, tier) {
  if (subject === 'Francais') return generateFrenchDictationQuestion(tier);
  if (subject === 'Maths') return generateMathQuestion(child.grade, tier);
  return generateHistoryQuestion(child.grade, tier);
}

const AVATARS = ['fox', 'owl', 'lion', 'dolphin', 'cat', 'rocket'];

function computeStreakDays(db, childId) {
  const rows = db
    .prepare("SELECT DISTINCT date(created_at) as day FROM activity_log WHERE child_id = ? ORDER BY day DESC LIMIT 30")
    .all(childId);
  if (!rows.length) return 0;
  const daySet = new Set(rows.map((r) => String(r.day)));
  let streak = 0;
  const d = new Date();
  while (streak < 30) {
    const iso = d.toISOString().slice(0, 10);
    if (!daySet.has(iso)) break;
    streak += 1;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function unlockBadges(db, child) {
  const current = new Set(safeJson(child.badges_json, []));
  const count = db.prepare('SELECT COUNT(*) as c FROM activity_log WHERE child_id = ?').get(child.id).c;
  if (count >= 1) current.add('premier-pas');
  if ((child.streak_days || 0) >= 3) current.add('serie-3-jours');
  if ((child.streak_days || 0) >= 7) current.add('serie-7-jours');

  const goodMath = db
    .prepare("SELECT COUNT(*) as c FROM activity_log WHERE child_id = ? AND activity_type LIKE 'quiz_Maths%' AND score >= 85")
    .get(child.id).c;
  if (goodMath >= 5) current.add('maths-expert');

  const perfectDictee = db
    .prepare("SELECT COUNT(*) as c FROM activity_log WHERE child_id = ? AND activity_type = 'dictation' AND score = 100")
    .get(child.id).c;
  if (perfectDictee >= 3) current.add('orthographe-or');
  return [...current];
}

function grantGamificationProgress(db, childId, { subject, score }) {
  const child = db.prepare('SELECT * FROM children WHERE id = ?').get(childId);
  if (!child) return { xpGain: 0, streakDays: 0, badges: [] };
  const xpGain = score >= 90 ? 16 : score >= 75 ? 12 : score >= 55 ? 8 : 4;
  db.prepare('UPDATE children SET xp_total = xp_total + ? WHERE id = ?').run(xpGain, childId);
  const streakDays = computeStreakDays(db, childId);
  db.prepare('UPDATE children SET streak_days = ? WHERE id = ?').run(streakDays, childId);
  const updated = db.prepare('SELECT * FROM children WHERE id = ?').get(childId);
  const badges = unlockBadges(db, { ...updated, streak_days: streakDays });
  db.prepare('UPDATE children SET badges_json = ? WHERE id = ?').run(JSON.stringify(badges), childId);
  return { xpGain, streakDays, badges, subject };
}

function applySubjectProgressAfterScore(db, childId, subject, score) {
  const child = db.prepare('SELECT * FROM children WHERE id = ?').get(childId);
  if (!child) return;
  const merged = mergeChildSubjectState(child);
  const levels = merged.levels;
  if (!levels[subject]) levels[subject] = { tier: 1, streak: 0 };
  let { tier, streak } = levels[subject];

  if (score >= 85) {
    streak += 1;
    if (streak >= 3) {
      tier = Math.min(3, tier + 1);
      streak = 0;
    }
  } else if (score < 55) {
    streak = 0;
    tier = Math.max(1, tier - 1);
  } else {
    streak = 0;
  }

  levels[subject] = { tier, streak };

  const jsonStr = JSON.stringify(levels);
  db.prepare(
    'UPDATE children SET subject_levels_json = ?, reading_level = ?, spelling_level = ?, math_level = ?, history_level = ? WHERE id = ?'
  ).run(
    jsonStr,
    getSubjectTier(levels, 'Francais'),
    getSubjectTier(levels, 'Francais'),
    getSubjectTier(levels, 'Maths'),
    getSubjectTier(levels, 'Histoire'),
    childId
  );
}

function sanitizeChildRow(row) {
  if (!row) return row;
  const { student_password: _pw, subject_levels_json: _sl, evaluation_by_subject_json: _ev, optional_subjects_json: _os, badges_json: _badges, ...rest } = row;
  const merged = mergeChildSubjectState(row);
  const tierLabel = (t) => (t >= 3 ? 'A' : t >= 2 ? 'M' : 'E');
  const tiersDisplay = {};
  for (const [sub, v] of Object.entries(merged.levels)) {
    tiersDisplay[sub] = { tier: v.tier, label: tierLabel(v.tier), streak: v.streak };
  }
  return {
    ...rest,
    subjectLevels: merged.levels,
    subjectTiersDisplay: tiersDisplay,
    evaluationBySubject: merged.evals,
    optionalSubjectsEnabled: merged.optionalEnabled,
    badges: safeJson(row.badges_json, []),
  };
}

function setupDb(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS parents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,
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
      student_login TEXT,
      student_password TEXT,
      screen_time_earned_min INTEGER NOT NULL DEFAULT 0,
      avatar_id TEXT NOT NULL DEFAULT 'fox',
      xp_total INTEGER NOT NULL DEFAULT 0,
      streak_days INTEGER NOT NULL DEFAULT 0,
      badges_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      FOREIGN KEY(parent_id) REFERENCES parents(id)
    );

    CREATE TABLE IF NOT EXISTS parent_settings (
      parent_id INTEGER PRIMARY KEY,
      reward_minutes_per_success INTEGER NOT NULL DEFAULT 5,
      notify_on_unlock INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY(parent_id) REFERENCES parents(id)
    );

    CREATE TABLE IF NOT EXISTS parent_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_id INTEGER NOT NULL,
      child_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      payload TEXT,
      created_at TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(parent_id) REFERENCES parents(id),
      FOREIGN KEY(child_id) REFERENCES children(id)
    );

    CREATE TABLE IF NOT EXISTS evaluation_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      child_id INTEGER NOT NULL,
      parent_id INTEGER NOT NULL,
      subject TEXT NOT NULL,
      questions_json TEXT NOT NULL,
      current_index INTEGER NOT NULL DEFAULT 0,
      correct_count INTEGER NOT NULL DEFAULT 0,
      total_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'running',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(child_id) REFERENCES children(id),
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

  migrateChildrenCredentials(db);
  migrateSubjectTracking(db);
  migrateParentAndRewardTracking(db);
  migrateEngagementTracking(db);

  // Legacy migration: early versions used auth_tokens(token,parent_id,created_at)
  // without expiry/revocation fields. Normalize to the current schema.
  const authTokenCols = db.prepare("PRAGMA table_info('auth_tokens')").all();
  const hasTokenId = authTokenCols.some((c) => c.name === 'token_id');
  if (!hasTokenId) {
    db.exec(`
      ALTER TABLE auth_tokens RENAME TO auth_tokens_legacy;
      CREATE TABLE auth_tokens (
        token_id TEXT PRIMARY KEY,
        parent_id INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        revoked INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY(parent_id) REFERENCES parents(id)
      );
      INSERT INTO auth_tokens (token_id, parent_id, created_at, expires_at, revoked)
      SELECT token, parent_id, created_at, datetime(created_at, '+8 hours'), 0
      FROM auth_tokens_legacy;
      DROP TABLE auth_tokens_legacy;
    `);
  }

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

function createStudentToken(childId, parentId) {
  return jwt.sign({ role: 'student', cid: childId, pid: parentId }, JWT_SECRET, {
    expiresIn: STUDENT_ACCESS_TOKEN_TTL_SEC,
  });
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
  app.use((req, res, next) => {
    req.requestId = crypto.randomUUID();
    const start = Date.now();
    res.setHeader('x-request-id', req.requestId);
    res.on('finish', () => {
      log('info', 'http_request', {
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Date.now() - start,
      });
    });
    next();
  });

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
    log('info', 'security_event', { requestId: payload.requestId, parentId, email, eventType, ip });
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

    if (decoded.role === 'student') {
      const cid = Number(decoded.cid);
      const pid = Number(decoded.pid);
      if (!cid || !pid) return res.status(401).json({ error: 'Invalid student token' });
      req.parentId = pid;
      req.childId = cid;
      req.isStudent = true;
      req.tokenId = null;
      return next();
    }

    const row = db
      .prepare(
        "SELECT parent_id FROM auth_tokens WHERE token_id = ? AND revoked = 0 AND datetime(expires_at) > datetime('now')"
      )
      .get(decoded.tid);
    if (!row) return res.status(401).json({ error: 'Session expired or revoked' });

    req.parentId = row.parent_id;
    req.tokenId = decoded.tid;
    req.isStudent = false;
    next();
  }

  function requireParent(req, res, next) {
    if (req.isStudent) return res.status(403).json({ error: 'Acces reserve aux parents' });
    next();
  }

  function getAuthorizedChild(req, childId) {
    const id = Number(childId);
    if (!Number.isFinite(id)) return null;
    if (req.isStudent) {
      if (id !== req.childId) return null;
      return db.prepare('SELECT * FROM children WHERE id = ?').get(id);
    }
    return db.prepare('SELECT * FROM children WHERE id = ? AND parent_id = ?').get(id, req.parentId);
  }

  function getParentSettings(parentId) {
    const row = db.prepare('SELECT * FROM parent_settings WHERE parent_id = ?').get(parentId);
    if (row) return row;
    db.prepare('INSERT INTO parent_settings (parent_id, reward_minutes_per_success, notify_on_unlock) VALUES (?, 5, 1)').run(parentId);
    return db.prepare('SELECT * FROM parent_settings WHERE parent_id = ?').get(parentId);
  }

  function addParentNotification(parentId, childId, type, message, payload = {}) {
    db.prepare(
      'INSERT INTO parent_notifications (parent_id, child_id, type, message, payload, created_at, is_read) VALUES (?, ?, ?, ?, ?, ?, 0)'
    ).run(parentId, childId, type, message, JSON.stringify(payload), nowIso());
  }

  function maybeAwardScreenTime(child, score, subject) {
    if (score < 85) return 0;
    const settings = getParentSettings(child.parent_id);
    const minutes = Math.max(0, Number(settings.reward_minutes_per_success) || 0);
    if (!minutes) return 0;
    db.prepare('UPDATE children SET screen_time_earned_min = screen_time_earned_min + ? WHERE id = ?').run(minutes, child.id);
    if (Number(settings.notify_on_unlock) === 1) {
      addParentNotification(
        child.parent_id,
        child.id,
        'screen_time_unlocked',
        `${child.first_name} a debloque ${minutes} min de temps d'ecran en ${subject}.`,
        { minutes, subject, score }
      );
    }
    return minutes;
  }

  app.get('/api/health', (_req, res) => {
    try {
      const dbOk = db.prepare('SELECT 1 as ok').get().ok === 1;
      const activeAccess = db
        .prepare("SELECT COUNT(*) as c FROM auth_tokens WHERE revoked = 0 AND datetime(expires_at) > datetime('now')")
        .get().c;
      const activeRefresh = db
        .prepare("SELECT COUNT(*) as c FROM refresh_tokens WHERE revoked = 0 AND datetime(expires_at) > datetime('now')")
        .get().c;
      const parentCount = db.prepare('SELECT COUNT(*) as c FROM parents').get().c;
      const childCount = db.prepare('SELECT COUNT(*) as c FROM children').get().c;
      res.json({
        ok: true,
        service: SERVICE_NAME,
        now: nowIso(),
        uptimeSec: Math.round(process.uptime()),
        db: { ok: dbOk },
        stats: { activeAccess, activeRefresh, parentCount, childCount },
      });
    } catch (error) {
      log('error', 'health_check_failed', { error: String(error) });
      res.status(500).json({ ok: false, error: 'Healthcheck failed' });
    }
  });

  app.get('/api/curriculum', (_req, res) => {
    res.json(curriculum);
  });

  app.post('/api/parents/register', rateLimitAuth, (req, res) => {
    const schema = z
      .object({
        name: z.string().min(1).optional(),
        firstName: z.string().min(1).optional(),
        lastName: z.string().min(1).optional(),
        email: z.string().email(),
        password: z.string().min(8),
      })
      .refine((v) => !!(v.name || (v.firstName && v.lastName)), {
        message: 'name ou firstName+lastName requis',
      });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const firstName = parsed.data.firstName?.trim();
    const lastName = parsed.data.lastName?.trim();
    const name = parsed.data.name?.trim() || `${firstName} ${lastName}`.trim();
    const email = parsed.data.email;
    const password = parsed.data.password;
    const hashed = bcrypt.hashSync(password, 12);

    try {
      const result = db
        .prepare('INSERT INTO parents (name, first_name, last_name, email, password, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(name, firstName || null, lastName || null, email.toLowerCase(), hashed, nowIso());
      getParentSettings(result.lastInsertRowid);
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
      .prepare('SELECT id, name, first_name, last_name, password FROM parents WHERE email = ?')
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

    return res.json({
      token: accessToken,
      accessToken,
      refreshToken,
      parent: { id: parent.id, name: parent.name, firstName: parent.first_name || '', lastName: parent.last_name || '' },
    });
  });

  app.post('/api/students/login', rateLimitAuth, (req, res) => {
    const schema = z.object({
      login: z.string().min(2).max(40),
      password: z.string().min(6),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const loginNorm = parsed.data.login.trim().toLowerCase();
    const child = db.prepare('SELECT * FROM children WHERE student_login = ?').get(loginNorm);
    if (!child || !child.student_password) {
      logSecurityEvent({ eventType: 'student_login_failed', ip: req.ip, payload: { login: loginNorm } });
      return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' });
    }

    if (!bcrypt.compareSync(parsed.data.password, child.student_password)) {
      logSecurityEvent({ eventType: 'student_login_failed', ip: req.ip, payload: { login: loginNorm } });
      return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' });
    }

    const token = createStudentToken(child.id, child.parent_id);
    logSecurityEvent({
      parentId: child.parent_id,
      eventType: 'student_login_success',
      ip: req.ip,
      payload: { childId: child.id },
    });

    return res.json({ token, child: sanitizeChildRow(child) });
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

  app.get('/api/students/me', auth, (req, res) => {
    if (!req.isStudent) return res.status(403).json({ error: 'Reserve aux eleves' });
    const child = db.prepare('SELECT * FROM children WHERE id = ?').get(req.childId);
    if (!child) return res.status(404).json({ error: 'Profil introuvable' });
    return res.json(sanitizeChildRow(child));
  });

  app.post('/api/parents/logout', auth, requireParent, (req, res) => {
    db.prepare('UPDATE auth_tokens SET revoked = 1 WHERE token_id = ?').run(req.tokenId);
    db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE token_id = ?').run(req.tokenId);
    logSecurityEvent({ parentId: req.parentId, eventType: 'auth_logout', ip: req.ip, payload: { tokenId: req.tokenId } });
    res.status(204).send();
  });

  app.post('/api/parents/children', auth, requireParent, (req, res) => {
    const schema = z.object({
      firstName: z.string().min(1),
      grade: z.string().min(1),
      age: z.number().int().min(3).max(25),
      strengths: z.string().optional().default(''),
      weaknesses: z.string().optional().default(''),
      studentLogin: z
        .string()
        .min(2)
        .max(40)
        .regex(/^[a-zA-Z0-9_-]+$/, 'Lettres, chiffres, tirets ou underscores uniquement')
        .transform((s) => s.trim().toLowerCase()),
      studentPassword: z.string().min(6).max(72),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const dup = db.prepare('SELECT id FROM children WHERE student_login = ?').get(parsed.data.studentLogin);
    if (dup) return res.status(409).json({ error: 'Cet identifiant eleve est deja utilise' });

    const hashedKidPw = bcrypt.hashSync(parsed.data.studentPassword, 10);

    try {
      const result = db
        .prepare(
          'INSERT INTO children (parent_id, first_name, grade, age, strengths, weaknesses, student_login, student_password, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .run(
          req.parentId,
          parsed.data.firstName,
          parsed.data.grade,
          parsed.data.age,
          parsed.data.strengths,
          parsed.data.weaknesses,
          parsed.data.studentLogin,
          hashedKidPw,
          nowIso()
        );

      return res.status(201).json({ childId: result.lastInsertRowid });
    } catch (e) {
      if (String(e).includes('UNIQUE')) return res.status(409).json({ error: 'Cet identifiant eleve est deja utilise' });
      throw e;
    }
  });

  app.get('/api/parents/children', auth, requireParent, (req, res) => {
    const rows = db.prepare('SELECT * FROM children WHERE parent_id = ? ORDER BY id DESC').all(req.parentId);
    res.json(rows.map(sanitizeChildRow));
  });

  app.post('/api/evaluation/:childId', auth, (req, res) => {
    const childId = Number(req.params.childId);
    const child = getAuthorizedChild(req, childId);
    if (!child) return res.status(404).json({ error: 'Child not found' });
    const available = subjectsAvailableForChild(child);
    const started = [];
    for (const subject of available) {
      const merged = mergeChildSubjectState(child);
      const tier = getSubjectTier(merged.levels, subject);
      const count = 8;
      const questions =
        subject === 'Francais'
          ? buildFrenchEvaluationQuestions(child, { gradeBand, randomInt, mergeChildSubjectState, getSubjectTier })
          : Array.from({ length: count }).map(() => generateSubjectQuestion(child, subject, tier));
      const row = db
        .prepare(
          'INSERT INTO evaluation_sessions (child_id, parent_id, subject, questions_json, current_index, correct_count, total_count, status, created_at, updated_at) VALUES (?, ?, ?, ?, 0, 0, ?, ?, ?, ?)'
        )
        .run(child.id, child.parent_id, subject, JSON.stringify(questions), questions.length, 'running', nowIso(), nowIso());
      started.push({ subject, sessionId: row.lastInsertRowid, total: questions.length });
    }
    res.json({ started });
  });

  app.post('/api/evaluation/:childId/start', auth, (req, res) => {
    const childId = Number(req.params.childId);
    const subject = String(req.body?.subject || '');
    const child = getAuthorizedChild(req, childId);
    if (!child) return res.status(404).json({ error: 'Child not found' });
    const available = subjectsAvailableForChild(child);
    if (!subject || !available.includes(subject)) {
      return res.status(400).json({ error: 'Matiere invalide ou non active pour cet enfant' });
    }
    const { levels } = mergeChildSubjectState(child);
    const tier = getSubjectTier(levels, subject);
    const total = 8;
    const questions =
      subject === 'Francais'
        ? buildFrenchEvaluationQuestions(child, { gradeBand, randomInt, mergeChildSubjectState, getSubjectTier })
        : Array.from({ length: total }).map(() => generateSubjectQuestion(child, subject, tier));
    const created = db
      .prepare(
        'INSERT INTO evaluation_sessions (child_id, parent_id, subject, questions_json, current_index, correct_count, total_count, status, created_at, updated_at) VALUES (?, ?, ?, ?, 0, 0, ?, ?, ?, ?)'
      )
      .run(child.id, child.parent_id, subject, JSON.stringify(questions), total, 'running', nowIso(), nowIso());
    res.json({ sessionId: created.lastInsertRowid, total, subject });
  });

  app.get('/api/evaluation/session/:sessionId/question', auth, (req, res) => {
    const sessionId = Number(req.params.sessionId);
    const sess = db.prepare('SELECT * FROM evaluation_sessions WHERE id = ?').get(sessionId);
    if (!sess) return res.status(404).json({ error: 'Session introuvable' });
    if (req.isStudent) {
      if (sess.child_id !== req.childId) return res.status(404).json({ error: 'Session introuvable' });
    } else if (sess.parent_id !== req.parentId) {
      return res.status(404).json({ error: 'Session introuvable' });
    }
    if (sess.status !== 'running') {
      return res.json({ finished: true, subject: sess.subject, total: sess.total_count, correct: sess.correct_count });
    }
    const questions = safeJson(sess.questions_json, []);
    const idx = Number(sess.current_index || 0);
    const q = questions[idx];
    if (!q) return res.status(400).json({ error: 'Question introuvable' });
    const prompt =
      q.type === 'french-dictation'
        ? 'Ecris la phrase dictee (audio uniquement).'
        : q.type === 'french-reading'
          ? q.prompt
          : q.type === 'french-grammar'
            ? `Grammaire\n\n${q.prompt}`
            : q.type === 'french-spelling'
              ? `Orthographe\n\n${q.prompt}`
              : q.prompt;
    const readAloudText = q.readAloudText || q.prompt || '';
    res.json({
      sessionId,
      index: idx + 1,
      total: sess.total_count,
      subject: sess.subject,
      exerciseType: q.type,
      prompt,
      readAloudText,
    });
  });

  app.post('/api/evaluation/session/:sessionId/answer', auth, (req, res) => {
    const schema = z.object({
      answer: z.string().min(1),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const sessionId = Number(req.params.sessionId);
    const sess = db.prepare('SELECT * FROM evaluation_sessions WHERE id = ?').get(sessionId);
    if (!sess) return res.status(404).json({ error: 'Session introuvable' });
    if (req.isStudent) {
      if (sess.child_id !== req.childId) return res.status(404).json({ error: 'Session introuvable' });
    } else if (sess.parent_id !== req.parentId) {
      return res.status(404).json({ error: 'Session introuvable' });
    }
    if (sess.status !== 'running') return res.status(400).json({ error: 'Session deja terminee' });
    const questions = safeJson(sess.questions_json, []);
    const idx = Number(sess.current_index || 0);
    const q = questions[idx];
    if (!q) return res.status(400).json({ error: 'Question introuvable' });

    const answer = String(parsed.data.answer || '').trim();
    let score;
    if (q.type === 'math' || q.type === 'history') {
      score = String(q.expected).trim().toLowerCase() === answer.toLowerCase().trim() ? 100 : 0;
    } else if (String(q.type || '').startsWith('french-')) {
      score = scoreFrenchWrittenAnswer(q.expected, answer);
    } else {
      score = scoreWrittenAnswer(q.expected, answer);
    }
    const isCorrect = score >= 80;
    const nextIdx = idx + 1;
    const nextCorrect = Number(sess.correct_count || 0) + (isCorrect ? 1 : 0);
    const finished = nextIdx >= Number(sess.total_count || 0);

    db.prepare('UPDATE evaluation_sessions SET current_index = ?, correct_count = ?, status = ?, updated_at = ? WHERE id = ?').run(
      nextIdx,
      nextCorrect,
      finished ? 'done' : 'running',
      nowIso(),
      sessionId
    );

    if (!finished) {
      return res.json({ finished: false, isCorrect, score, nextIndex: nextIdx + 1, total: sess.total_count });
    }

    const finalScore = Math.round((nextCorrect / Number(sess.total_count || 1)) * 100);
    const child = db.prepare('SELECT * FROM children WHERE id = ?').get(sess.child_id);
    const merged = mergeChildSubjectState(child);
    const evals = { ...merged.evals };
    evals[sess.subject] = { done: true, score: finalScore, at: nowIso() };
    db.prepare('UPDATE children SET evaluation_by_subject_json = ? WHERE id = ?').run(JSON.stringify(evals), sess.child_id);
    const levels = { ...merged.levels };
    if (!levels[sess.subject]) levels[sess.subject] = { tier: 1, streak: 0 };
    levels[sess.subject].tier = finalScore >= 85 ? 3 : finalScore >= 60 ? 2 : 1;
    levels[sess.subject].streak = 0;
    db.prepare(
      'UPDATE children SET subject_levels_json = ?, reading_level = ?, spelling_level = ?, math_level = ?, history_level = ? WHERE id = ?'
    ).run(
      JSON.stringify(levels),
      getSubjectTier(levels, 'Francais'),
      getSubjectTier(levels, 'Francais'),
      getSubjectTier(levels, 'Maths'),
      getSubjectTier(levels, 'Histoire'),
      sess.child_id
    );
    db.prepare('INSERT INTO activity_log (child_id, activity_type, score, points_delta, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      sess.child_id,
      `evaluation_${sess.subject}`,
      finalScore,
      0,
      JSON.stringify({ sessionId }),
      nowIso()
    );
    const unlockedMinutes = maybeAwardScreenTime(child, finalScore, sess.subject);
    const gamification = grantGamificationProgress(db, sess.child_id, { subject: sess.subject, score: finalScore });
    return res.json({
      finished: true,
      finalScore,
      passed: finalScore >= 60,
      completed: finalScore >= 60,
      tierLabel: finalScore >= 85 ? 'A' : finalScore >= 60 ? 'M' : 'E',
      unlockedMinutes,
      xpGain: gamification.xpGain,
      streakDays: gamification.streakDays,
      badges: gamification.badges,
    });
  });

  app.get('/api/children/:childId/subjects-meta', auth, (req, res) => {
    const childId = Number(req.params.childId);
    const child = getAuthorizedChild(req, childId);
    if (!child) return res.status(404).json({ error: 'Child not found' });
    const inGrade = gradeSubjectsFromCurriculum(child.grade);
    const optionalPool = optionalSubjectsForGrade(child.grade);
    const merged = mergeChildSubjectState(child);
    const active = subjectsAvailableForChild(child);
    res.json({
      grade: child.grade,
      coreSubjects: inGrade,
      optionalPool,
      optionalEnabled: merged.optionalEnabled,
      activeSubjects: active,
      evaluationBySubject: merged.evals,
      subjectLevels: merged.levels,
    });
  });

  app.get('/api/gamification/:childId', auth, (req, res) => {
    const childId = Number(req.params.childId);
    const child = getAuthorizedChild(req, childId);
    if (!child) return res.status(404).json({ error: 'Child not found' });
    const merged = mergeChildSubjectState(child);
    const levels = merged.levels;
    const ranked = Object.entries(levels).sort((a, b) => (b[1].tier || 1) - (a[1].tier || 1));
    const strongestSubject = ranked[0]?.[0] || 'Francais';
    const weakestSubject = ranked[ranked.length - 1]?.[0] || 'Francais';
    const badges = safeJson(child.badges_json, []);
    const quests = [
      {
        id: 'daily-lesson',
        title: 'Terminer 1 session aujourd hui',
        completed:
          db
            .prepare("SELECT COUNT(*) as c FROM activity_log WHERE child_id = ? AND date(created_at) = date('now')")
            .get(child.id).c > 0,
      },
      {
        id: 'focus-weak',
        title: `Faire 1 exercice en ${weakestSubject}`,
        completed:
          db
            .prepare(
              "SELECT COUNT(*) as c FROM activity_log WHERE child_id = ? AND date(created_at)=date('now') AND (activity_type LIKE ? OR activity_type = ?)"
            )
            .get(child.id, `%${weakestSubject}%`, weakestSubject === 'Francais' ? 'dictation' : `quiz_${weakestSubject}`).c > 0,
      },
      {
        id: 'weekly-streak',
        title: 'Garder une serie de 3 jours',
        completed: Number(child.streak_days || 0) >= 3,
      },
    ];
    return res.json({
      avatars: AVATARS,
      avatarId: child.avatar_id || 'fox',
      xpTotal: Number(child.xp_total || 0),
      streakDays: Number(child.streak_days || 0),
      badges,
      strongestSubject,
      weakestSubject,
      quests,
    });
  });

  app.patch('/api/children/:childId/avatar', auth, (req, res) => {
    const childId = Number(req.params.childId);
    const schema = z.object({ avatarId: z.string().min(1) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const child = getAuthorizedChild(req, childId);
    if (!child) return res.status(404).json({ error: 'Child not found' });
    if (!AVATARS.includes(parsed.data.avatarId)) return res.status(400).json({ error: 'Avatar non supporte' });
    db.prepare('UPDATE children SET avatar_id = ? WHERE id = ?').run(parsed.data.avatarId, childId);
    return res.json({ ok: true, avatarId: parsed.data.avatarId });
  });

  app.patch('/api/parents/children/:childId/optional-subjects', auth, requireParent, (req, res) => {
    const childId = Number(req.params.childId);
    const schema = z.object({ subjects: z.array(z.string()) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const child = db.prepare('SELECT * FROM children WHERE id = ? AND parent_id = ?').get(childId, req.parentId);
    if (!child) return res.status(404).json({ error: 'Child not found' });
    const allowed = new Set(optionalSubjectsForGrade(child.grade));
    const next = parsed.data.subjects.filter((s) => allowed.has(s));
    db.prepare('UPDATE children SET optional_subjects_json = ? WHERE id = ?').run(JSON.stringify(next), childId);
    res.json({ optionalSubjectsEnabled: next });
  });

  app.get('/api/lesson/:childId', auth, (req, res) => {
    const childId = Number(req.params.childId);
    const subject = String(req.query.subject || 'Francais');

    const child = getAuthorizedChild(req, childId);
    if (!child) return res.status(404).json({ error: 'Child not found' });

    const { levels } = mergeChildSubjectState(child);
    const level = getSubjectTier(levels, subject);

    const lesson =
      subject === 'Francais'
        ? db.prepare('SELECT * FROM phrase_bank WHERE subject = ? AND mode = ? AND level = ? LIMIT 1').get('Francais', 'lecture', level) ||
          db.prepare('SELECT * FROM phrase_bank WHERE subject = ? LIMIT 1').get('Francais')
        : generateSubjectQuestion(child, subject, level);
    const spellingT = getSubjectTier(levels, 'Francais');
    const dictation =
      subject === 'Francais'
        ? db.prepare('SELECT * FROM phrase_bank WHERE subject = ? AND mode = ? AND level = ? LIMIT 1').get('Francais', 'dictee', spellingT)
        : { prompt: lesson.prompt, expected: lesson.expected };

    const review = db
      .prepare(
        "SELECT * FROM review_queue WHERE child_id = ? AND status = 'pending' AND datetime(next_review_at) <= datetime('now') ORDER BY next_review_at ASC LIMIT 1"
      )
      .get(childId);

    res.json({ lesson, dictation, review });
  });

  app.post('/api/session/:childId/dictation', auth, (req, res) => {
    const schema = z.object({
      expected: z.string().min(1),
      answer: z.string().min(1),
      subject: z.string().optional().default('Francais'),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const childId = Number(req.params.childId);
    const child = getAuthorizedChild(req, childId);
    if (!child) return res.status(404).json({ error: 'Child not found' });

    const subj = parsed.data.subject || 'Francais';
    const a = parsed.data.answer.trim().toLowerCase();
    const e = parsed.data.expected.trim().toLowerCase();
    let score = 0;
    if (subj === 'Maths' || subj === 'Histoire') {
      score = e === a.trim().toLowerCase() ? 100 : scoreWrittenAnswer(parsed.data.expected, parsed.data.answer);
    } else {
      let same = 0;
      for (let i = 0; i < Math.min(a.length, e.length); i += 1) if (a[i] === e[i]) same += 1;
      score = Math.max(0, Math.round((same / e.length) * 100));
    }
    const points = score > 80 ? 20 : 10;

    db.prepare('UPDATE children SET points = points + ? WHERE id = ?').run(points, childId);
    applySubjectProgressAfterScore(db, childId, subj, score);
    const unlockedMinutes = maybeAwardScreenTime(child, score, subj);
    const gamification = grantGamificationProgress(db, childId, { subject: subj, score });
    db.prepare('INSERT INTO activity_log (child_id, activity_type, score, points_delta, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      childId,
      subj === 'Francais' ? 'dictation' : `quiz_${subj}`,
      score,
      points,
      JSON.stringify({ expected: parsed.data.expected, subject: subj }),
      nowIso()
    );

    if (subj === 'Francais' && score < 100) {
      db.prepare('INSERT INTO review_queue (child_id, phrase, interval_days, next_review_at, status) VALUES (?, ?, ?, ?, ?)').run(
        childId,
        parsed.data.expected,
        1,
        addDays(1),
        'pending'
      );
    }

    res.json({
      score,
      points,
      unlockedMinutes,
      xpGain: gamification.xpGain,
      streakDays: gamification.streakDays,
      badges: gamification.badges,
      feedback: score === 100 ? 'Bravo, tout juste !' : `Score ${score}/100 — encore un petit effort !`,
    });
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
    if (req.isStudent && review.child_id !== req.childId) return res.status(404).json({ error: 'Review item not found' });

    if (!parsed.data.success) {
      db.prepare('UPDATE review_queue SET next_review_at = ?, interval_days = 1 WHERE id = ?').run(addDays(1), reviewId);
      return res.json({ status: 'rescheduled' });
    }

    const nextInterval = Math.min(30, review.interval_days * 2);
    db.prepare('UPDATE review_queue SET interval_days = ?, next_review_at = ? WHERE id = ?').run(nextInterval, addDays(nextInterval), reviewId);
    res.json({ status: 'completed', nextInterval });
  });

  app.post('/api/homework/:childId', auth, requireParent, (req, res) => {
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
    const child = getAuthorizedChild(req, childId);
    if (!child) return res.status(404).json({ error: 'Child not found' });

    const result = db
      .prepare('INSERT INTO homework (child_id, subject, title, details, due_date, source) VALUES (?, ?, ?, ?, ?, ?)')
      .run(childId, parsed.data.subject, parsed.data.title, parsed.data.details, parsed.data.dueDate, parsed.data.source);
    res.status(201).json({ homeworkId: result.lastInsertRowid });
  });

  app.get('/api/homework/:childId', auth, (req, res) => {
    const childId = Number(req.params.childId);
    const child = getAuthorizedChild(req, childId);
    if (!child) return res.status(404).json({ error: 'Child not found' });
    const rows = db.prepare('SELECT * FROM homework WHERE child_id = ? ORDER BY id DESC').all(childId);
    res.json(rows);
  });

  app.get('/api/parents/dashboard', auth, requireParent, (req, res) => {
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
      const merged = mergeChildSubjectState(child);
      const ranking = Object.entries(merged.levels).sort((a, b) => (b[1].tier || 1) - (a[1].tier || 1));
      const strongest = ranking[0]?.[0] || 'Francais';
      const weakest = ranking[ranking.length - 1]?.[0] || 'Francais';
      const recent = db.prepare('SELECT activity_type, score, points_delta, created_at FROM activity_log WHERE child_id = ? ORDER BY id DESC LIMIT 8').all(child.id);
      const pendingReviews = db.prepare("SELECT COUNT(*) as c FROM review_queue WHERE child_id = ? AND status = 'pending'").get(child.id).c;
      return {
        childId: child.id,
        childName: child.first_name,
        readingLevel: child.reading_level,
        spellingLevel: child.spelling_level,
        points: child.points,
        screenTimeUnlockedMin: child.screen_time_earned_min || 0,
        strongestSubject: strongest,
        weakestSubject: weakest,
        pendingReviews,
        recent,
      };
    });

    res.json({ totals, progress });
  });

  app.get('/api/parents/settings', auth, requireParent, (req, res) => {
    const row = getParentSettings(req.parentId);
    res.json({
      rewardMinutesPerSuccess: row.reward_minutes_per_success,
      notifyOnUnlock: Number(row.notify_on_unlock) === 1,
    });
  });

  app.patch('/api/parents/settings', auth, requireParent, (req, res) => {
    const schema = z.object({
      rewardMinutesPerSuccess: z.coerce.number().int().min(0).max(120),
      notifyOnUnlock: z.boolean(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    db.prepare('INSERT INTO parent_settings (parent_id, reward_minutes_per_success, notify_on_unlock) VALUES (?, ?, ?) ON CONFLICT(parent_id) DO UPDATE SET reward_minutes_per_success = excluded.reward_minutes_per_success, notify_on_unlock = excluded.notify_on_unlock')
      .run(req.parentId, parsed.data.rewardMinutesPerSuccess, parsed.data.notifyOnUnlock ? 1 : 0);
    return res.json({ ok: true });
  });

  app.get('/api/parents/notifications', auth, requireParent, (req, res) => {
    const rows = db
      .prepare('SELECT id, child_id, type, message, payload, created_at, is_read FROM parent_notifications WHERE parent_id = ? ORDER BY id DESC LIMIT 50')
      .all(req.parentId)
      .map((r) => ({ ...r, payload: safeJson(r.payload, {}), is_read: Number(r.is_read) === 1 }));
    res.json(rows);
  });

  app.get('/api/parents/security', auth, requireParent, (req, res) => {
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
    const child = getAuthorizedChild(req, childId);
    if (!child) return res.status(404).json({ error: 'Child not found' });

    const metaSources = Array.isArray(curriculum.metadata?.sources) ? curriculum.metadata.sources : [];
    const gradeData = curriculum.grades.find((g) => g.grade === child.grade);
    if (!gradeData) {
      return res.json({
        grade: child.grade,
        cycle: '',
        recommendations: [],
        sources: metaSources,
        note: 'Aucun contenu grade exact. Utiliser parcours niveau voisin.',
      });
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
      sources: metaSources,
    });
  });

  app.get('/api/programs/:childId', auth, (req, res) => {
    const childId = Number(req.params.childId);
    const subject = String(req.query.subject || '');
    const child = getAuthorizedChild(req, childId);
    if (!child) return res.status(404).json({ error: 'Child not found' });
    const gradeData = curriculum.grades.find((g) => g.grade === child.grade);
    if (!gradeData) return res.json({ grade: child.grade, links: [] });

    const subjects = subject && gradeData.subjects[subject] ? [subject] : Object.keys(gradeData.subjects);
    const links = [];
    for (const sub of subjects) {
      const query = encodeURIComponent(`programme ${child.grade} ${sub} education nationale`);
      links.push({
        subject: sub,
        title: `Programme officiel ${child.grade} - ${sub}`,
        url: `https://www.education.gouv.fr/recherche?query=${query}`,
      });
      links.push({
        subject: sub,
        title: `Ressources Eduscol ${child.grade} - ${sub}`,
        url: `https://eduscol.education.fr/recherche?search_api_fulltext=${query}`,
      });
    }
    const sourceLinks = (curriculum.metadata?.sources || []).map((u) => ({ subject: 'General', title: 'Source programme', url: u }));
    res.json({ grade: child.grade, links: [...links, ...sourceLinks] });
  });

  app.use((error, req, res, _next) => {
    log('error', 'unhandled_error', { requestId: req.requestId, path: req.path, error: String(error) });
    res.status(500).json({ error: 'Internal server error', requestId: req.requestId });
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
