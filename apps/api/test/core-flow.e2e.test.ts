import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

type HttpResult<T = any> = {
  status: number;
  body: T;
  setCookie?: string;
};

type ResendRequest = {
  authorization: string | null;
  idempotencyKey: string | null;
  payload: any;
};

let apiProcess: ChildProcessWithoutNullStreams | undefined;
let baseUrl = '';
let processOutput = '';
let resendLogPath = '';

function cookiePair(setCookie: string | null) {
  if (!setCookie) return '';
  return setCookie.split(';', 1)[0] || '';
}

async function api<T = any>(
  path: string,
  options: {
    method?: string;
    cookie?: string;
    body?: unknown;
  } = {},
): Promise<HttpResult<T>> {
  const headers = new Headers();
  if (options.cookie) headers.set('cookie', options.cookie);
  if (options.body !== undefined) headers.set('content-type', 'application/json');

  const response = await fetch(baseUrl + path, {
    method: options.method || 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    redirect: 'manual',
  });

  const raw = await response.text();
  let body: any = null;
  if (raw) {
    try {
      body = JSON.parse(raw);
    } catch {
      body = raw;
    }
  }

  return {
    status: response.status,
    body,
    setCookie: response.headers.get('set-cookie') || undefined,
  };
}

async function login(email: string, password: string) {
  const result = await api<{ success: boolean; mustChangePassword: boolean }>('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  assert.equal(result.status, 201);
  assert.equal(result.body.success, true);
  assert.equal(result.body.mustChangePassword, false);
  const cookie = cookiePair(result.setCookie || null);
  assert.ok(cookie, 'El login debe devolver una cookie de sesión.');
  return cookie;
}

async function waitFor<T>(callback: () => Promise<T | undefined>, timeoutMs = 5000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = await callback();
    if (value !== undefined) return value;
    await new Promise((resolve) => setTimeout(resolve, 75));
  }
  throw new Error(`La condición E2E no se cumplió en ${timeoutMs} ms.`);
}

async function freePort() {
  return new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('No se pudo reservar un puerto E2E.')));
        return;
      }
      const port = address.port;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function resendRequests(): ResendRequest[] {
  if (!resendLogPath || !existsSync(resendLogPath)) return [];
  return readFileSync(resendLogPath, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as ResendRequest);
}

async function waitForApi() {
  await waitFor(async () => {
    if (apiProcess?.exitCode !== null && apiProcess?.exitCode !== undefined) {
      throw new Error(`La API E2E terminó antes de arrancar.\n${processOutput}`);
    }
    try {
      const response = await fetch(baseUrl + '/api/health');
      return response.ok ? true : undefined;
    } catch {
      return undefined;
    }
  }, 12_000);
}

test.before(async () => {
  const databaseUrl = process.env.E2E_DATABASE_URL;
  assert.ok(
    databaseUrl,
    'E2E_DATABASE_URL es obligatoria. Usa una base PostgreSQL desechable y separada de desarrollo/producción.',
  );

  const port = await freePort();
  baseUrl = `http://127.0.0.1:${port}`;
  resendLogPath = join(tmpdir(), `ciclope-e2e-resend-${process.pid}.jsonl`);
  rmSync(resendLogPath, { force: true });

  const preload = './test/resend-fetch-hook.cjs';
  const nodeOptions = [process.env.NODE_OPTIONS, `--require=${preload}`].filter(Boolean).join(' ');

  apiProcess = spawn(process.execPath, ['dist/main.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL: databaseUrl,
      PORT: String(port),
      APP_BASE_URL: baseUrl,
      COOKIE_SECURE: 'false',
      SESSION_COOKIE_NAME: 'ciclope_e2e_session',
      SESSION_SECRET: 'ciclope-e2e-session-secret-2026',
      INTEGRATIONS_ENCRYPTION_KEY: 'ciclope-e2e-integrations-secret-2026',
      E2E_RESEND_LOG: resendLogPath,
      NODE_OPTIONS: nodeOptions,
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
  rmSync(resendLogPath, { force: true });
});

test('E2E de los flujos esenciales de CÍCLOPE', async (t) => {
  const email = 'admin-e2e@example.test';
  const password = 'CiclopeE2E2026';
  let sessionCookie = '';
  let adminUserId = '';
  let currentYearId = '';
  let innovationId = '';
  let networksCache: Array<{ id: string; code: string; name: string }> = [];

  await t.test('configuración inicial → login → actuación → validación → informe', async () => {
    const initialStatus = await api<{ initialized: boolean }>('/api/setup/status');
    assert.equal(initialStatus.status, 200);
    assert.equal(initialStatus.body.initialized, false);

    const initialized = await api<{
      center: { id: string; name: string; code: string };
      user: { id: string; email: string; roles: string[] };
    }>('/api/setup/initialize', {
      method: 'POST',
      body: {
        centerName: 'Centro E2E CÍCLOPE',
        centerCode: 'E2E-CICLOPE',
        firstName: 'Administrador',
        lastName: 'E2E',
        email,
        password,
      },
    });

    assert.equal(initialized.status, 201);
    assert.equal(initialized.body.center.code, 'E2E-CICLOPE');
    assert.equal(initialized.body.user.email, email);
    assert.ok(initialized.body.user.roles.includes('SUPERADMIN'));
    adminUserId = initialized.body.user.id;

    const setupCookie = cookiePair(initialized.setCookie || null);
    assert.ok(setupCookie, 'La configuración inicial debe crear una sesión autenticada.');

    const logout = await api('/api/auth/logout', {
      method: 'POST',
      cookie: setupCookie,
    });
    assert.equal(logout.status, 201);

    sessionCookie = await login(email, password);

    const me = await api<{
      email: string;
      academicYearId?: string | null;
      academicYearName?: string | null;
      roles: string[];
    }>('/api/auth/me', { cookie: sessionCookie });
    assert.equal(me.status, 200);
    assert.equal(me.body.email, email);
    assert.ok(me.body.academicYearId, 'Debe existir un curso académico activo tras el seed E2E.');
    assert.ok(me.body.roles.includes('ADMIN_CENTRO'));
    currentYearId = me.body.academicYearId!;

    const networks = await api<Array<{ id: string; code: string; name: string }>>('/api/networks', {
      cookie: sessionCookie,
    });
    assert.equal(networks.status, 200);
    networksCache = networks.body;
    const innovation = networks.body.find((network) => network.code === 'INNOVATION');
    assert.ok(innovation, 'La red de Innovación debe estar disponible.');
    innovationId = innovation.id;

    const created = await api<{
      id: string;
      title: string;
      status: string;
      networks: Array<{ network: { id: string; code: string } }>;
    }>('/api/actions', {
      method: 'POST',
      cookie: sessionCookie,
      body: {
        title: 'Actuación E2E de Innovación',
        description: 'Actuación creada por la prueba E2E para recorrer el flujo completo de CÍCLOPE.',
        type: 'PROYECTO',
        activityDate: '2026-10-01T10:00:00.000Z',
        durationMinutes: 55,
        studentCount: 18,
        networkIds: [innovation.id],
      },
    });

    assert.equal(created.status, 201);
    assert.equal(created.body.status, 'PENDING_VALIDATION');
    assert.equal(created.body.networks[0]?.network.code, 'INNOVATION');

    const validated = await api<{ id: string; status: string; validatedAt?: string | null }>(
      `/api/actions/${created.body.id}/validate`,
      { method: 'PATCH', cookie: sessionCookie },
    );
    assert.equal(validated.status, 200);
    assert.equal(validated.body.status, 'VALIDATED');
    assert.ok(validated.body.validatedAt);

    const history = await api<{
      action: { id: string; status: string };
      events: Array<{ action: string }>;
    }>(`/api/actions/${created.body.id}/history`, { cookie: sessionCookie });
    assert.equal(history.status, 200);
    assert.equal(history.body.action.status, 'VALIDATED');
    assert.ok(history.body.events.some((event) => event.action === 'ACTION_VALIDATED'));

    const report = await api<{
      center: { code: string };
      academicYear: { id: string; name: string };
      totals: {
        validatedActions: number;
        pendingActions: number;
        teachers: number;
        studentParticipations: number;
        totalHours: number;
      };
      byNetwork: Array<{ id: string; name: string; actions: number }>;
    }>('/api/reports/summary', { cookie: sessionCookie });

    assert.equal(report.status, 200);
    assert.equal(report.body.center.code, 'E2E-CICLOPE');
    assert.equal(report.body.academicYear.id, me.body.academicYearId);
    assert.equal(report.body.totals.validatedActions, 1);
    assert.equal(report.body.totals.pendingActions, 0);
    assert.equal(report.body.totals.teachers, 1);
    assert.equal(report.body.totals.studentParticipations, 18);
    assert.equal(report.body.totals.totalHours, 0.9);
    assert.equal(report.body.byNetwork.find((item) => item.id === innovation.id)?.actions, 1);
  });

  await t.test('comunicación → cola → Resend simulado → lectura/respuesta', async () => {
    if (!sessionCookie) sessionCookie = await login(email, password);
    assert.ok(innovationId);

    const configured = await api<{
      resend: { enabled: boolean; configured: boolean; fromEmail: string };
    }>('/api/integrations/resend', {
      method: 'PATCH',
      cookie: sessionCookie,
      body: {
        enabled: true,
        fromEmail: 'ciclope@example.test',
        fromName: 'CÍCLOPE E2E',
        apiKey: 're_e2e_mock_key',
      },
    });
    assert.equal(configured.status, 200);
    assert.equal(configured.body.resend.enabled, true);
    assert.equal(configured.body.resend.configured, true);

    const resendTest = await api<{ ok: boolean }>('/api/integrations/resend/test', {
      method: 'POST',
      cookie: sessionCookie,
    });
    assert.equal(resendTest.status, 201);
    assert.equal(resendTest.body.ok, true);

    const communication = await api<{
      id: string;
      _count: { recipients: number };
      emailDelivery: { queued: number; configured: boolean };
      resendConfigured: boolean;
    }>('/api/communications', {
      method: 'POST',
      cookie: sessionCookie,
      body: {
        originNetworkId: innovationId,
        title: 'Comunicación E2E',
        body: 'Mensaje de prueba del flujo de comunicaciones y entrega por Resend simulado.',
        responseRequired: true,
        targetAllFp: true,
      },
    });

    assert.equal(communication.status, 201);
    assert.equal(communication.body._count.recipients, 1);
    assert.equal(communication.body.emailDelivery.queued, 1);
    assert.equal(communication.body.emailDelivery.configured, true);
    assert.equal(communication.body.resendConfigured, true);

    const sentJob = await waitFor(async () => {
      const jobs = await api<Array<{
        id: string;
        communicationId?: string | null;
        status: string;
        attempts: number;
        recipientEmail: string;
      }>>('/api/communications/mail-jobs', { cookie: sessionCookie });
      assert.equal(jobs.status, 200);
      return jobs.body.find((job) =>
        job.communicationId === communication.body.id && job.status === 'SENT',
      );
    });

    assert.equal(sentJob.recipientEmail, email);
    assert.equal(sentJob.attempts, 1);

    const requests = await waitFor(async () => {
      const rows = resendRequests();
      return rows.length >= 2 ? rows : undefined;
    });
    const communicationRequest = requests.find((request) =>
      request.payload?.subject === '[Innovación] Comunicación E2E',
    );
    assert.ok(communicationRequest, 'La comunicación debe llegar al transporte Resend simulado.');
    assert.equal(communicationRequest.authorization, 'Bearer re_e2e_mock_key');
    assert.ok(communicationRequest.idempotencyKey);
    assert.deepEqual(communicationRequest.payload.to, [email]);
    assert.match(communicationRequest.payload.html, /CÍCLOPE FP/);
    assert.match(communicationRequest.payload.text, /Mensaje de prueba/);

    const inbox = await api<Array<{
      readAt?: string | null;
      communication: { id: string; title: string };
    }>>('/api/communications/inbox', { cookie: sessionCookie });
    assert.equal(inbox.status, 200);
    const inboxItem = inbox.body.find((item) => item.communication.id === communication.body.id);
    assert.ok(inboxItem);
    assert.equal(inboxItem.readAt, null);

    const read = await api<{ readAt?: string | null }>(`/api/communications/${communication.body.id}/read`, {
      method: 'PATCH',
      cookie: sessionCookie,
    });
    assert.equal(read.status, 200);
    assert.ok(read.body.readAt);

    const responded = await api<{ respondedAt?: string | null; responseText?: string | null }>(
      `/api/communications/${communication.body.id}/respond`,
      {
        method: 'POST',
        cookie: sessionCookie,
        body: { response: 'Recibido y confirmado desde E2E.' },
      },
    );
    assert.equal(responded.status, 201);
    assert.ok(responded.body.respondedAt);
    assert.equal(responded.body.responseText, 'Recibido y confirmado desde E2E.');
  });

  await t.test('cierre de curso → rollover → activación del curso siguiente', async () => {
    if (!sessionCookie) sessionCookie = await login(email, password);
    assert.ok(adminUserId);
    assert.ok(currentYearId);
    assert.equal(networksCache.length, 4);

    for (const network of networksCache) {
      const assigned = await api<{
        id: string;
        network: { id: string };
        user: { id: string };
      }>(`/api/academic-years/${currentYearId}/network-coordinators`, {
        method: 'POST',
        cookie: sessionCookie,
        body: { userId: adminUserId, networkId: network.id, isPrimary: true },
      });
      assert.equal(assigned.status, 201);
      assert.equal(assigned.body.network.id, network.id);
      assert.equal(assigned.body.user.id, adminUserId);
    }

    const ciclope = await api<{ id: string; user: { id: string } }>(
      `/api/academic-years/${currentYearId}/ciclope-coordinators`,
      {
        method: 'POST',
        cookie: sessionCookie,
        body: { userId: adminUserId, isPrimary: true },
      },
    );
    assert.equal(ciclope.status, 201);
    assert.equal(ciclope.body.user.id, adminUserId);

    const closeCheck = await api<{
      canClose: boolean;
      blockers: { pendingActions: number; draftCommunications: number };
    }>(`/api/academic-years/${currentYearId}/close-check`, { cookie: sessionCookie });
    assert.equal(closeCheck.status, 200);
    assert.equal(closeCheck.body.canClose, true);
    assert.deepEqual(closeCheck.body.blockers, { pendingActions: 0, draftCommunications: 0 });

    const closed = await api<{ id: string; isActive: boolean; closedAt?: string | null }>(
      `/api/academic-years/${currentYearId}/close`,
      { method: 'PATCH', cookie: sessionCookie },
    );
    assert.equal(closed.status, 200);
    assert.equal(closed.body.isActive, false);
    assert.ok(closed.body.closedAt);

    const rolled = await api<{ id: string; name: string; isActive: boolean }>(
      `/api/academic-years/${currentYearId}/rollover`,
      {
        method: 'POST',
        cookie: sessionCookie,
        body: {
          name: '2027-2028',
          startsAt: '2027-09-01T00:00:00.000Z',
          endsAt: '2028-06-30T23:59:59.000Z',
          copyGroups: true,
          copyCoordinators: true,
        },
      },
    );
    assert.equal(rolled.status, 201);
    assert.equal(rolled.body.name, '2027-2028');
    assert.equal(rolled.body.isActive, false);

    const readiness = await api<{
      ready: boolean;
      missingNetworks: string[];
      missingCiclope: boolean;
    }>(`/api/academic-years/${rolled.body.id}/activation-readiness`, { cookie: sessionCookie });
    assert.equal(readiness.status, 200);
    assert.equal(readiness.body.ready, true);
    assert.deepEqual(readiness.body.missingNetworks, []);
    assert.equal(readiness.body.missingCiclope, false);

    const activated = await api<{ id: string; name: string; isActive: boolean }>(
      `/api/academic-years/${rolled.body.id}/activate`,
      { method: 'PATCH', cookie: sessionCookie },
    );
    assert.equal(activated.status, 200);
    assert.equal(activated.body.isActive, true);

    const meAfterRollover = await api<{
      academicYearId?: string | null;
      academicYearName?: string | null;
    }>('/api/auth/me', { cookie: sessionCookie });
    assert.equal(meAfterRollover.status, 200);
    assert.equal(meAfterRollover.body.academicYearId, rolled.body.id);
    assert.equal(meAfterRollover.body.academicYearName, '2027-2028');

    const years = await api<Array<{
      id: string;
      name: string;
      isActive: boolean;
      closedAt?: string | null;
      _count: { actions: number; communications: number; groups: number };
      networkCoordinators: Array<{ id: string }>;
      ciclopeCoordinators: Array<{ id: string }>;
    }>>('/api/academic-years', { cookie: sessionCookie });
    assert.equal(years.status, 200);

    const oldYear = years.body.find((year) => year.id === currentYearId);
    const newYear = years.body.find((year) => year.id === rolled.body.id);
    assert.ok(oldYear?.closedAt);
    assert.equal(oldYear?.isActive, false);
    assert.equal(newYear?.isActive, true);
    assert.equal(newYear?._count.actions, 0);
    assert.equal(newYear?._count.communications, 0);
    assert.equal(newYear?.networkCoordinators.length, 4);
    assert.equal(newYear?.ciclopeCoordinators.length, 1);
  });
});
