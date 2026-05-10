const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const request = require('supertest');

process.env.JWT_SECRET = 'test-secret';
const { createApp, createDb } = require('./server');

function buildTestApp() {
  const dbPath = path.join(os.tmpdir(), `educoach-test-${Date.now()}-${Math.random()}.db`);
  const db = createDb(dbPath);
  const app = createApp(db);
  return { app, db, dbPath };
}

function cleanupDb(db, dbPath) {
  db.close();
  fs.rmSync(dbPath, { force: true });
  fs.rmSync(`${dbPath}-wal`, { force: true });
  fs.rmSync(`${dbPath}-shm`, { force: true });
}

test('register, login and access protected route', async () => {
  const { app, db, dbPath } = buildTestApp();

  const register = await request(app)
    .post('/api/parents/register')
    .send({ name: 'Parent', email: 'parent@test.local', password: 'password123' });
  assert.equal(register.status, 201);

  const login = await request(app)
    .post('/api/parents/login')
    .send({ email: 'parent@test.local', password: 'password123' });
  assert.equal(login.status, 200);
  assert.ok(login.body.token);

  const children = await request(app)
    .get('/api/parents/children')
    .set('Authorization', `Bearer ${login.body.token}`);
  assert.equal(children.status, 200);
  assert.deepEqual(children.body, []);

  cleanupDb(db, dbPath);
});

test('recommendations returns grade-scoped content', async () => {
  const { app, db, dbPath } = buildTestApp();

  await request(app)
    .post('/api/parents/register')
    .send({ name: 'Parent', email: 'p2@test.local', password: 'password123' });

  const login = await request(app)
    .post('/api/parents/login')
    .send({ email: 'p2@test.local', password: 'password123' });
  const token = login.body.token;

  const child = await request(app)
    .post('/api/parents/children')
    .set('Authorization', `Bearer ${token}`)
    .send({
      firstName: 'Lina',
      grade: 'CM2',
      age: 10,
      strengths: 'lecture',
      weaknesses: 'accord',
      studentLogin: 'lina_cm2',
      studentPassword: 'kidsecret1',
    });
  assert.equal(child.status, 201);

  const reco = await request(app)
    .get(`/api/recommendations/${child.body.childId}`)
    .set('Authorization', `Bearer ${token}`);
  assert.equal(reco.status, 200);
  assert.equal(reco.body.grade, 'CM2');
  assert.ok(Array.isArray(reco.body.recommendations));
  assert.ok(reco.body.recommendations.length > 0);

  cleanupDb(db, dbPath);
});

test('refresh token rotates session and revokes old access token', async () => {
  const { app, db, dbPath } = buildTestApp();
  await request(app)
    .post('/api/parents/register')
    .send({ name: 'Parent', email: 'refresh@test.local', password: 'password123' });

  const login = await request(app)
    .post('/api/parents/login')
    .send({ email: 'refresh@test.local', password: 'password123' });
  assert.equal(login.status, 200);
  assert.ok(login.body.refreshToken);

  const refresh = await request(app)
    .post('/api/parents/refresh')
    .send({ refreshToken: login.body.refreshToken });
  assert.equal(refresh.status, 200);
  assert.ok(refresh.body.token);
  assert.ok(refresh.body.refreshToken);

  const oldTokenUse = await request(app)
    .get('/api/parents/children')
    .set('Authorization', `Bearer ${login.body.token}`);
  assert.equal(oldTokenUse.status, 401);

  const newTokenUse = await request(app)
    .get('/api/parents/children')
    .set('Authorization', `Bearer ${refresh.body.token}`);
  assert.equal(newTokenUse.status, 200);

  cleanupDb(db, dbPath);
});

test('auth routes are rate limited', async () => {
  const { app, db, dbPath } = buildTestApp();
  let limitedStatus = 0;
  for (let i = 0; i < 17; i += 1) {
    const attempt = await request(app).post('/api/parents/login').send({ email: 'x@test.local', password: 'password123' });
    limitedStatus = attempt.status;
    if (limitedStatus === 429) break;
  }
  assert.equal(limitedStatus, 429);
  cleanupDb(db, dbPath);
});

test('account lockout triggers after repeated failed logins', async () => {
  const { app, db, dbPath } = buildTestApp();
  await request(app)
    .post('/api/parents/register')
    .send({ name: 'Parent', email: 'lock@test.local', password: 'password123' });

  let lockStatus = 0;
  for (let i = 0; i < 6; i += 1) {
    const attempt = await request(app)
      .post('/api/parents/login')
      .send({ email: 'lock@test.local', password: 'wrongpass123' });
    lockStatus = attempt.status;
  }
  assert.equal(lockStatus, 423);

  const validWhileLocked = await request(app)
    .post('/api/parents/login')
    .send({ email: 'lock@test.local', password: 'password123' });
  assert.equal(validWhileLocked.status, 423);
  cleanupDb(db, dbPath);
});

test('student login reaches lesson but cannot open parent dashboard', async () => {
  const { app, db, dbPath } = buildTestApp();

  await request(app)
    .post('/api/parents/register')
    .send({ name: 'Parent', email: 'stu@test.local', password: 'password123' });
  const login = await request(app)
    .post('/api/parents/login')
    .send({ email: 'stu@test.local', password: 'password123' });
  const token = login.body.token;

  const created = await request(app)
    .post('/api/parents/children')
    .set('Authorization', `Bearer ${token}`)
    .send({
      firstName: 'Tom',
      grade: 'CE1',
      age: 8,
      strengths: '',
      weaknesses: '',
      studentLogin: 'tom_ce1',
      studentPassword: 'hellokid',
    });
  assert.equal(created.status, 201);

  const st = await request(app).post('/api/students/login').send({ login: 'tom_ce1', password: 'hellokid' });
  assert.equal(st.status, 200);
  assert.ok(st.body.token);
  assert.equal(st.body.child.student_login, 'tom_ce1');

  const lesson = await request(app)
    .get(`/api/lesson/${created.body.childId}?subject=Francais`)
    .set('Authorization', `Bearer ${st.body.token}`);
  assert.equal(lesson.status, 200);

  const dash = await request(app).get('/api/parents/dashboard').set('Authorization', `Bearer ${st.body.token}`);
  assert.equal(dash.status, 403);

  cleanupDb(db, dbPath);
});

test('security endpoint returns session and audit info', async () => {
  const { app, db, dbPath } = buildTestApp();
  await request(app)
    .post('/api/parents/register')
    .send({ name: 'Parent', email: 'sec@test.local', password: 'password123' });
  const login = await request(app)
    .post('/api/parents/login')
    .send({ email: 'sec@test.local', password: 'password123' });

  const security = await request(app)
    .get('/api/parents/security')
    .set('Authorization', `Bearer ${login.body.token}`);
  assert.equal(security.status, 200);
  assert.ok(security.body.activeAccessSessions >= 1);
  assert.ok(Array.isArray(security.body.recentEvents));
  assert.ok(security.body.recentEvents.length >= 1);
  cleanupDb(db, dbPath);
});

test('interest catalog and saving passions', async () => {
  const { app, db, dbPath } = buildTestApp();

  await request(app)
    .post('/api/parents/register')
    .send({ name: 'Parent', email: 'interest@test.local', password: 'password123' });

  const login = await request(app)
    .post('/api/parents/login')
    .send({ email: 'interest@test.local', password: 'password123' });
  assert.equal(login.status, 200);
  const token = login.body.token;

  const catalog = await request(app).get('/api/interests/catalog');
  assert.equal(catalog.status, 200);
  assert.ok(Array.isArray(catalog.body.categories));
  assert.ok(catalog.body.categories.length >= 1);

  const child = await request(app)
    .post('/api/parents/children')
    .set('Authorization', `Bearer ${token}`)
    .send({
      firstName: 'Lee',
      grade: '6e',
      age: 11,
      strengths: '',
      weaknesses: '',
      studentLogin: 'lee_6e',
      studentPassword: 'kidsecret1',
    });
  assert.equal(child.status, 201);

  const patch = await request(app)
    .patch(`/api/children/${child.body.childId}/interests`)
    .set('Authorization', `Bearer ${token}`)
    .send({ categoryId: 'gaming', favoriteId: 'minecraft' });
  assert.equal(patch.status, 200);
  assert.equal(patch.body.interestTheme?.favoriteLabel, 'Minecraft');

  const kids = await request(app).get('/api/parents/children').set('Authorization', `Bearer ${token}`);
  assert.equal(kids.status, 200);
  assert.equal(kids.body[0].interestTheme?.favoriteId, 'minecraft');

  cleanupDb(db, dbPath);
});
