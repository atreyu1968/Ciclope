import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createServer } from 'node:net';
import { Client } from 'pg';

type HttpResult<T = any> = { status: number; body: T; setCookie?: string };

let apiProcess: ChildProcessWithoutNullStreams | undefined;
let baseUrl = '';
let processOutput = '';

function cookiePair(setCookie: string | null) {
  return setCookie?.split(';', 1)[0] || '';
}

async function api<T = any>(path: string, options: { method?: string; cookie?: string; body?: unknown } = {}): Promise<HttpResult<T>> {
  const headers = new Headers();
  if (options.cookie) headers.set('cookie', options.cookie);
  if (options.body !== undefined) headers.set('content-type', 'application/json');
  const response = await fetch(baseUrl + path, {
    method: options.method || 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const raw = await response.text();
  let body: any = null;
  if (raw) {
    try { body = JSON.parse(raw); } catch { body = raw; }
  }
  return { status: response.status, body, setCookie: response.headers.get('set-cookie') || undefined };
}

async function freePort() {
  return new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('No se pudo reservar puerto para volumen.')));
        return;
      }
      const port = address.port;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function waitForApi(timeoutMs = 12_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (apiProcess?.exitCode !== null && apiProcess?.exitCode !== undefined) {
      throw new Error(`La API terminó antes del test de volumen.\n${processOutput}`);
    }
    try {
      const response = await fetch(baseUrl + '/api/health');
      if (response.ok) return;
    } catch {
      // La API todavía está arrancando.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`La API no arrancó para el test de volumen.\n${processOutput}`);
}

test.before(async () => {
  const databaseUrl = process.env.VOLUME_DATABASE_URL;
  assert.ok(databaseUrl, 'VOLUME_DATABASE_URL es obligatoria para el test de volumen.');
  const port = await freePort();
  baseUrl = `http://127.0.0.1:${port}`;

  apiProcess = spawn(process.execPath, ['dist/main.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL: databaseUrl,
      PORT: String(port),
      APP_BASE_URL: baseUrl,
      COOKIE_SECURE: 'false',
      SESSION_SECRET: 'ciclope-volume-session-secret-2026',
      INTEGRATIONS_ENCRYPTION_KEY: 'ciclope-volume-integrations-secret-2026',
      AUTOMATIONS_ENABLED: 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  apiProcess.stdout.on('data', (chunk) => { processOutput += chunk.toString(); });
  apiProcess.stderr.on('data', (chunk) => { processOutput += chunk.toString(); });
  await waitForApi();
});

test.after(async () => {
  if (apiProcess && apiProcess.exitCode === null) {
    apiProcess.kill('SIGTERM');
    await Promise.race([
      new Promise<void>((resolve) => apiProcess?.once('exit', () => resolve())),
      new Promise<void>((resolve) => setTimeout(resolve, 2000)),
    ]);
    if (apiProcess.exitCode === null) apiProcess.kill('SIGKILL');
  }
});

test('un curso representativo mantiene agregaciones correctas con 1.200 actuaciones', async () => {
  const databaseUrl = process.env.VOLUME_DATABASE_URL!;
  const initialized = await api<{
    user: { id: string };
  }>('/api/setup/initialize', {
    method: 'POST',
    body: {
      centerName: 'Centro volumen CÍCLOPE',
      centerCode: 'VOLUME-CICLOPE',
      firstName: 'Administración',
      lastName: 'Volumen',
      email: 'volume-admin@example.test',
      password: 'CiclopeVolume2026',
    },
  });
  assert.equal(initialized.status, 201);
  const cookie = cookiePair(initialized.setCookie || null);
  assert.ok(cookie);

  const me = await api<{ academicYearId: string }>('/api/auth/me', { cookie });
  assert.equal(me.status, 200);
  assert.ok(me.body.academicYearId);

  const networks = await api<Array<{ id: string; code: string; name: string }>>('/api/networks', { cookie });
  assert.equal(networks.status, 200);
  assert.equal(networks.body.length, 4);

  const db = new Client({ connectionString: databaseUrl });
  await db.connect();
  try {
    await db.query(`
      INSERT INTO "Action" (
        "id", "academicYearId", "title", "description", "type", "status",
        "activityDate", "durationMinutes", "studentCount", "submittedByName",
        "submittedByEmail", "validatedAt", "createdAt", "updatedAt"
      )
      SELECT
        'volume-action-' || i,
        $1,
        'Actuación de volumen ' || i,
        'Registro sintético representativo para la prueba de capacidad de CÍCLOPE.',
        CASE (i % 4)
          WHEN 0 THEN 'PROYECTO'
          WHEN 1 THEN 'TALLER'
          WHEN 2 THEN 'CHARLA'
          ELSE 'COLABORACION'
        END,
        'VALIDATED'::"ActionStatus",
        TIMESTAMPTZ '2026-09-01 10:00:00+00' + ((i - 1) % 300) * INTERVAL '1 day',
        60,
        20,
        'Docente ' || (((i - 1) % 80) + 1),
        'docente' || (((i - 1) % 80) + 1) || '@example.test',
        TIMESTAMPTZ '2026-09-01 12:00:00+00' + ((i - 1) % 300) * INTERVAL '1 day',
        NOW(),
        NOW()
      FROM generate_series(1, 1200) AS g(i)
    `, [me.body.academicYearId]);

    const ids = networks.body.map((network) => network.id);
    await db.query(`
      INSERT INTO "ActionNetwork" ("actionId", "networkId")
      SELECT
        'volume-action-' || i,
        CASE ((i - 1) % 4)
          WHEN 0 THEN $1
          WHEN 1 THEN $2
          WHEN 2 THEN $3
          ELSE $4
        END
      FROM generate_series(1, 1200) AS g(i)
    `, ids);

    await db.query(`
      INSERT INTO "Evidence" ("id", "actionId", "kind", "title", "url", "createdAt")
      SELECT
        'volume-evidence-' || i,
        'volume-action-' || i,
        CASE WHEN i % 2 = 0 THEN 'FILE' ELSE 'LINK' END,
        'Evidencia ' || i,
        CASE WHEN i % 2 = 0 THEN NULL ELSE 'https://example.test/evidencia/' || i END,
        NOW()
      FROM generate_series(1, 1200) AS g(i)
      WHERE i % 10 < 7
    `);
  } finally {
    await db.end();
  }

  const started = performance.now();
  const report = await api<{
    totals: {
      validatedActions: number;
      pendingActions: number;
      teachers: number;
      studentParticipations: number;
      totalHours: number;
      evidence: number;
      evidenceCoveragePercent: number;
      actionsWithoutEvidence: number;
    };
    byNetwork: Array<{ id: string; actions: number }>;
    byMonth: Array<{ month: string; actions: number }>;
    byType: Array<{ type: string; actions: number }>;
  }>('/api/reports/summary', { cookie });
  const elapsedMs = performance.now() - started;

  assert.equal(report.status, 200);
  assert.equal(report.body.totals.validatedActions, 1200);
  assert.equal(report.body.totals.pendingActions, 0);
  assert.equal(report.body.totals.teachers, 80);
  assert.equal(report.body.totals.studentParticipations, 24_000);
  assert.equal(report.body.totals.totalHours, 1200);
  assert.equal(report.body.totals.evidence, 840);
  assert.equal(report.body.totals.evidenceCoveragePercent, 70);
  assert.equal(report.body.totals.actionsWithoutEvidence, 360);
  assert.equal(report.body.byNetwork.length, 4);
  for (const network of report.body.byNetwork) assert.equal(network.actions, 300);
  assert.equal(report.body.byType.length, 4);
  assert.ok(report.body.byMonth.length >= 9);
  assert.ok(elapsedMs < 8_000, `El informe de volumen tardó ${Math.round(elapsedMs)} ms.`);
});
