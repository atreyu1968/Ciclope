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

async function waitFor<T>(callback: () => Promise<T | undefined>, timeoutMs = 3000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = await callback();
    if (value !== undefined) return value;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`La condición E2E no se cumplió en ${timeoutMs} ms.`);
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

test('E2E de los flujos esenciales de CÍCLOPE', async (t) => {
  const email = 'admin-e2e@example.test';
  const password = 'CiclopeE2E2026';
  let sessionCookie = '';
  let innovationId = '';

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

    const networks = await api<Array<{ id: string; code: string; name: string }>>('/api/networks', {
      cookie: sessionCookie,
    });
    assert.equal(networks.status, 200);
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
    assert.equal(report.body.totals.totalHours, 0.9);
    assert.equal(
      report.body.byNetwork.find((item) => item.id === innovation.id)?.actions,
      1,
    );
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

    const nativeFetch = globalThis.fetch;
    const resendRequests: Array<{
      authorization: string | null;
      idempotencyKey: string | null;
      payload: any;
    }> = [];

    globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

      if (url === 'https://api.resend.com/emails') {
        const headers = new Headers(init?.headers);
        resendRequests.push({
          authorization: headers.get('authorization'),
          idempotencyKey: headers.get('Idempotency-Key'),
          payload: init?.body ? JSON.parse(String(init.body)) : null,
        });
        return new Response(JSON.stringify({ id: `mock-email-${resendRequests.length}` }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }

      return nativeFetch(input as any, init);
    };

    try {
      const resendTest = await api<{ ok: boolean }>('/api/integrations/resend/test', {
        method: 'POST',
        cookie: sessionCookie,
      });
      assert.equal(resendTest.status, 201);
      assert.equal(resendTest.body.ok, true);

      const communication = await api<{
        id: string;
        title: string;
        responseRequired: boolean;
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
      assert.ok(resendRequests.length >= 2, 'Debe existir una prueba de Resend y un envío de comunicación.');

      const communicationRequest = resendRequests.find((request) =>
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
        respondedAt?: string | null;
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
    } finally {
      globalThis.fetch = nativeFetch;
    }
  });
});
