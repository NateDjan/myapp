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
    .send({ firstName: 'Lina', grade: 'CM2', age: 10, strengths: 'lecture', weaknesses: 'accord' });
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
