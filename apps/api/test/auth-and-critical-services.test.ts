import test from 'node:test';
import assert from 'node:assert/strict';
import { ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { RolesGuard } from '../src/auth/roles.guard';
import { SessionGuard } from '../src/auth/session.guard';
import { SecretCryptoService } from '../src/integrations/secret-crypto.service';
import { officialPlanDeadlines } from '../src/plans/official-deadlines.config';

function roleContext(roles: string[]): ExecutionContext {
  return {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({
      getRequest: () => ({ user: { roles } }),
      getResponse: () => ({}),
      getNext: () => undefined,
    }),
  } as unknown as ExecutionContext;
}

test('RolesGuard permite cualquiera de los roles autorizados y rechaza el resto', () => {
  const reflector = {
    getAllAndOverride: () => ['DIRECCION', 'COORD_INNOVACION'],
  } as unknown as Reflector;
  const guard = new RolesGuard(reflector);

  assert.equal(guard.canActivate(roleContext(['PROFESOR_FP', 'COORD_INNOVACION'])), true);
  assert.throws(
    () => guard.canActivate(roleContext(['PROFESOR_FP'])),
    (error: unknown) => error instanceof ForbiddenException,
  );
});

test('RolesGuard deja pasar rutas sin restricción de rol', () => {
  const reflector = { getAllAndOverride: () => undefined } as unknown as Reflector;
  const guard = new RolesGuard(reflector);
  assert.equal(guard.canActivate(roleContext([])), true);
});

test('SessionGuard deriva coordinaciones de red y CÍCLOPE en la sesión autenticada', async () => {
  const expiresAt = new Date(Date.now() + 60_000);
  const prisma = {
    session: {
      findUnique: async () => ({
        id: 'session-1',
        expiresAt,
        user: {
          id: 'user-1',
          centerId: 'center-1',
          email: 'coord@example.org',
          firstName: 'Ana',
          lastName: 'Coordinadora',
          active: true,
          mustChangePassword: false,
          roles: [{ role: { key: 'PROFESOR_FP' } }],
          center: {
            name: 'IES Prueba',
            academicYears: [{ id: 'year-1', name: '2026-2027' }],
          },
          networkCoordinations: [
            { networkId: 'net-1', network: { code: 'INNOVATION' } },
            { networkId: 'net-2', network: { code: 'QUALITY' } },
          ],
          ciclopeCoordinations: [{ id: 'ciclope-1' }],
        },
      }),
      delete: async () => undefined,
    },
  };
  const guard = new SessionGuard(prisma as never);
  const request: any = {
    headers: { cookie: 'ciclope_session=test-token' },
    originalUrl: '/api/dashboard/me',
  };
  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;

  assert.equal(await guard.canActivate(context), true);
  assert.deepEqual(
    new Set(request.user.roles),
    new Set(['PROFESOR_FP', 'COORD_INNOVACION', 'COORD_CALIDAD', 'COORDINADOR_CICLOPE']),
  );
  assert.deepEqual(request.user.coordinatorNetworkIds, ['net-1', 'net-2']);
  assert.equal(request.user.academicYearId, 'year-1');
});

test('SessionGuard bloquea la navegación mientras exista contraseña temporal', async () => {
  const prisma = {
    session: {
      findUnique: async () => ({
        id: 'session-2',
        expiresAt: new Date(Date.now() + 60_000),
        user: {
          id: 'user-2',
          centerId: 'center-1',
          email: 'prof@example.org',
          firstName: 'Luis',
          lastName: 'Profesor',
          active: true,
          mustChangePassword: true,
          roles: [{ role: { key: 'PROFESOR_FP' } }],
          center: { name: 'IES Prueba', academicYears: [{ id: 'year-1', name: '2026-2027' }] },
          networkCoordinations: [],
          ciclopeCoordinations: [],
        },
      }),
      delete: async () => undefined,
    },
  };
  const guard = new SessionGuard(prisma as never);
  const context = {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: { cookie: 'ciclope_session=test-token' },
        originalUrl: '/api/actions',
      }),
    }),
  } as unknown as ExecutionContext;

  await assert.rejects(
    () => guard.canActivate(context),
    (error: unknown) => error instanceof ForbiddenException,
  );
});

test('SecretCryptoService cifra y descifra secretos sin almacenarlos en claro', () => {
  const previous = process.env.INTEGRATIONS_ENCRYPTION_KEY;
  process.env.INTEGRATIONS_ENCRYPTION_KEY = 'unit-test-integration-key';
  try {
    const crypto = new SecretCryptoService();
    const encrypted = crypto.encrypt('secreto-de-prueba');
    assert.notEqual(encrypted, 'secreto-de-prueba');
    assert.equal(crypto.decrypt(encrypted), 'secreto-de-prueba');
    assert.equal(crypto.decrypt(null), null);
  } finally {
    if (previous === undefined) delete process.env.INTEGRATIONS_ENCRYPTION_KEY;
    else process.env.INTEGRATIONS_ENCRYPTION_KEY = previous;
  }
});

test('SecretCryptoService exige una clave de cifrado', () => {
  const previousIntegration = process.env.INTEGRATIONS_ENCRYPTION_KEY;
  const previousSession = process.env.SESSION_SECRET;
  delete process.env.INTEGRATIONS_ENCRYPTION_KEY;
  delete process.env.SESSION_SECRET;
  try {
    const crypto = new SecretCryptoService();
    assert.throws(
      () => crypto.encrypt('no-debe-cifrarse'),
      (error: unknown) => error instanceof InternalServerErrorException,
    );
  } finally {
    if (previousIntegration !== undefined) process.env.INTEGRATIONS_ENCRYPTION_KEY = previousIntegration;
    if (previousSession !== undefined) process.env.SESSION_SECRET = previousSession;
  }
});

test('Los hitos oficiales 2026-2027 incluyen Plan de Acción y memoria final con fechas válidas', () => {
  const deadlines = officialPlanDeadlines('2026-2027');
  assert.deepEqual(deadlines.map((item) => item.key), ['ACTION_PLAN', 'FINAL_MEMORY']);
  assert.ok(deadlines.every((item) => !Number.isNaN(new Date(item.dueDate).getTime())));
  assert.deepEqual(officialPlanDeadlines('2099-2100'), []);
});
