/* Basic API load smoke test (single process)
 * Usage:
 *   API_BASE=http://localhost:4000 node scripts/loadtest-api.js
 */

const API_BASE = process.env.API_BASE || 'http://localhost:4000';
const CONCURRENCY = Number(process.env.LOAD_CONCURRENCY || 16);
const ITERATIONS = Number(process.env.LOAD_ITERATIONS || 30);

async function request(path, options = {}) {
  const start = Date.now();
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }
  return { status: response.status, data, durationMs: Date.now() - start };
}

async function bootstrapSession() {
  const email = `load-bootstrap-${Date.now()}@test.local`;
  const reg = await request('/api/parents/register', {
    method: 'POST',
    body: JSON.stringify({ name: 'LoadBootstrap', email, password: 'password123' }),
  });
  if (reg.status !== 201) throw new Error(`register failed ${reg.status}`);

  const login = await request('/api/parents/login', {
    method: 'POST',
    body: JSON.stringify({ email, password: 'password123' }),
  });
  if (login.status !== 200 || !login.data.token || !login.data.refreshToken) {
    throw new Error(`login failed ${login.status}`);
  }

  const refresh = await request('/api/parents/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: login.data.refreshToken }),
  });
  if (refresh.status !== 200 || !refresh.data.token) {
    throw new Error(`refresh failed ${refresh.status}`);
  }
  return refresh.data.token;
}

async function runWorker(workerId, accessToken) {
  const latencies = [];
  let ok = 0;
  let failed = 0;

  for (let i = 0; i < ITERATIONS; i += 1) {
    const health = await request('/api/health');
    latencies.push(health.durationMs);
    if (health.status !== 200) {
      failed += 1;
      continue;
    }

    const sec = await request('/api/parents/security', {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    latencies.push(sec.durationMs);
    if (sec.status === 200) ok += 1;
    else failed += 1;
  }

  return { ok, failed, latencies };
}

(async () => {
  const started = Date.now();
  const accessToken = await bootstrapSession();
  const workers = await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => runWorker(i + 1, accessToken)));
  const allLatencies = workers.flatMap((w) => w.latencies).sort((a, b) => a - b);
  const totalOk = workers.reduce((acc, w) => acc + w.ok, 0);
  const totalFailed = workers.reduce((acc, w) => acc + w.failed, 0);

  const p = (ratio) => allLatencies[Math.min(allLatencies.length - 1, Math.floor(allLatencies.length * ratio))] || 0;

  console.log(
    JSON.stringify(
      {
        apiBase: API_BASE,
        concurrency: CONCURRENCY,
        iterationsPerWorker: ITERATIONS,
        totalOperations: totalOk + totalFailed,
        ok: totalOk,
        failed: totalFailed,
        p50ms: p(0.5),
        p95ms: p(0.95),
        p99ms: p(0.99),
        durationMs: Date.now() - started,
      },
      null,
      2
    )
  );
})();
