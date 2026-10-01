import test from 'node:test';
import assert from 'node:assert/strict';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory, type INestApplication } from '@nestjs/core';

type HttpResult<T = any> = {
  status: number;
  body: T;
  setCookie?: string;
};

let app: INestApplication;
let baseUrl = '';

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

test.before(async () => {
  const databaseUrl = process.env.E2E_DATABASE_URL;
  assert.ok(
    databaseUrl,
    'E2E_DATABASE_URL es obligatoria. Usa una base PostgreSQL desechable y separada de desarrollo/producción.',
  );

  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = databaseUrl;
  process.env.COOKIE_SECURE = 'false';
  process.env.SESSION_COOKIE_NAME = 'ciclope_e2e_session';

  const { AppModule } = await import('../src/app.module');
  app = await NestFactory.create(AppModule, { logger: false, cors: false });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  await app.listen(0, '127.0.0.1');
  baseUrl = await app.getUrl();
  process.env.APP_BASE_URL = baseUrl;
});

test.after(async () => {
  await app?.close();
});

test('E2E: configuración inicial → login → actuación → validación → informe', async () => {
  const email = 'admin-e2e@example.test';
  const password = 'CiclopeE2E2026';

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

  const setupCookie = cookiePair(initialized.setCookie || null);
  assert.ok(setupCookie, 'La configuración inicial debe crear una sesión autenticada.');

  const logout = await api('/api/auth/logout', {
    method: 'POST',
    cookie: setupCookie,
  });
  assert.equal(logout.status, 201);

  const login = await api<{ success: boolean; mustChangePassword: boolean }>('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  assert.equal(login.status, 201);
  assert.equal(login.body.success, true);
  assert.equal(login.body.mustChangePassword, false);

  const sessionCookie = cookiePair(login.setCookie || null);
  assert.ok(sessionCookie, 'El login debe devolver una cookie de sesión.');

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

  const networks = await api<Array<{ id: string; code: string; name: string }>>('/api/networks', {
    cookie: sessionCookie,
  });
  assert.equal(networks.status, 200);
  const innovation = networks.body.find((network) => network.code === 'INNOVATION');
  assert.ok(innovation, 'La red de Innovación debe estar disponible.');

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
    {
      method: 'PATCH',
      cookie: sessionCookie,
    },
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
  assert.equal(report.body.totals.totalHours, 0.92);
  assert.equal(
    report.body.byNetwork.find((item) => item.id === innovation.id)?.actions,
    1,
  );
});
