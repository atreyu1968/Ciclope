import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { AcademicYearsController } from '../src/academic-years/academic-years.controller';
import { ActionsController } from '../src/actions/actions.controller';
import { AssistantController } from '../src/assistant/assistant.controller';
import { CommunicationsController } from '../src/communications/communications.controller';
import { EvidenceController } from '../src/evidence/evidence.controller';
import { IntegrationsController } from '../src/integrations/integrations.controller';
import { NetworksController } from '../src/networks/networks.controller';
import { PlansController } from '../src/plans/plans.controller';
import { ReportsController } from '../src/reports/reports.controller';
import { StaffRequestsController } from '../src/staff-requests/staff-requests.controller';
import { UsersController } from '../src/users/users.controller';
import { ROLES_KEY } from '../src/auth/roles.decorator';
import {
  ADMIN_ROLES,
  ALL_ROLE_KEYS,
  CONTENT_WRITE_ROLES,
  COORDINATION_ROLES,
} from '../src/auth/role-policy';

const EXPECTED_ALL = [
  'SUPERADMIN',
  'ADMIN_CENTRO',
  'DIRECCION',
  'COORDINADOR_CICLOPE',
  'COORD_INNOVACION',
  'COORD_EMPRENDIMIENTO',
  'COORD_IOP',
  'COORD_CALIDAD',
  'MIEMBRO_CICLOPE',
  'RESPONSABLE_PROYECTO',
  'PROFESOR_FP',
  'LECTURA',
];

function rolesOn(target: object) {
  return (Reflect.getMetadata(ROLES_KEY, target) ?? []) as string[];
}

function assertSameRoles(actual: readonly string[], expected: readonly string[], label: string) {
  assert.deepEqual(
    [...actual].sort(),
    [...expected].sort(),
    label,
  );
}

test('la política central clasifica todos los roles persistidos sin duplicados', () => {
  assertSameRoles(ALL_ROLE_KEYS, EXPECTED_ALL, 'La matriz debe cubrir todos los roles del seed');
  assert.equal(new Set(ALL_ROLE_KEYS).size, ALL_ROLE_KEYS.length);
  assert.equal(CONTENT_WRITE_ROLES.includes('LECTURA' as never), false);
  assert.equal(COORDINATION_ROLES.includes('LECTURA' as never), false);
  assert.equal(ADMIN_ROLES.includes('LECTURA' as never), false);
});

test('administración de cursos, usuarios e integraciones queda limitada a administración/dirección', () => {
  assertSameRoles(
    rolesOn(AcademicYearsController.prototype.create),
    ADMIN_ROLES,
    'Crear cursos debe ser administrativo',
  );
  assertSameRoles(
    rolesOn(UsersController.prototype.create),
    ADMIN_ROLES,
    'Crear usuarios debe ser administrativo',
  );
  assertSameRoles(
    rolesOn(UsersController.prototype.importMany),
    ADMIN_ROLES,
    'Importar usuarios debe ser administrativo',
  );
  assertSameRoles(
    rolesOn(IntegrationsController),
    ADMIN_ROLES,
    'Las claves de integraciones deben ser administrativas',
  );
  assertSameRoles(
    rolesOn(NetworksController.prototype.updateInstitutional),
    ADMIN_ROLES,
    'La configuración institucional de redes debe ser administrativa',
  );
});

test('informes, asistentes y gestión ordinaria de planes están limitados a coordinación', () => {
  assertSameRoles(
    rolesOn(ReportsController),
    COORDINATION_ROLES,
    'Los informes de coordinación deben exigir rol de coordinación',
  );
  assertSameRoles(
    rolesOn(AssistantController),
    COORDINATION_ROLES,
    'Los asistentes de coordinación deben exigir rol de coordinación',
  );
  assertSameRoles(
    rolesOn(PlansController.prototype.list),
    COORDINATION_ROLES,
    'Los planes deben exigir rol de coordinación',
  );
  assertSameRoles(
    rolesOn(ActionsController.prototype.validate),
    COORDINATION_ROLES,
    'Validar actuaciones debe exigir rol de coordinación',
  );
  assertSameRoles(
    rolesOn(StaffRequestsController.prototype.coordination),
    COORDINATION_ROLES,
    'La bandeja de coordinación debe exigir rol de coordinación',
  );
  assertSameRoles(
    rolesOn(CommunicationsController.prototype.create),
    COORDINATION_ROLES,
    'Publicar comunicaciones debe exigir rol de coordinación',
  );
});

test('solo coordinación global/administración puede crear hitos comunes de las cuatro redes', () => {
  assertSameRoles(
    rolesOn(PlansController.prototype.createMilestone),
    ['SUPERADMIN', 'ADMIN_CENTRO', 'DIRECCION', 'COORDINADOR_CICLOPE'],
    'Los hitos comunes no deben ser creados por una coordinación de red aislada',
  );
});

test('LECTURA no puede escribir actuaciones, evidencias, buzón ni respuestas de comunicaciones', () => {
  const writeEndpoints: Array<[string, object]> = [
    ['crear actuación', ActionsController.prototype.create],
    ['editar actuación', ActionsController.prototype.updateBeforeValidation],
    ['reenviar actuación', ActionsController.prototype.resubmit],
    ['duplicar actuación', ActionsController.prototype.duplicate],
    ['añadir evidencia enlace', EvidenceController.prototype.addLink],
    ['añadir evidencia archivo', EvidenceController.prototype.addFile],
    ['eliminar evidencia', EvidenceController.prototype.remove],
    ['crear consulta', StaffRequestsController.prototype.create],
    ['responder consulta', StaffRequestsController.prototype.addMessage],
    ['responder comunicación', CommunicationsController.prototype.respond],
  ];

  for (const [label, endpoint] of writeEndpoints) {
    const roles = rolesOn(endpoint);
    assert.ok(roles.length > 0, `${label} debe declarar una política de escritura`);
    assert.equal(roles.includes('LECTURA'), false, `${label} no puede admitir LECTURA`);
    assertSameRoles(roles, CONTENT_WRITE_ROLES, `${label} debe usar la política común de escritura`);
  }
});

test('PROFESOR_FP, responsables y miembros CÍCLOPE conservan los flujos de contenido', () => {
  for (const role of ['PROFESOR_FP', 'RESPONSABLE_PROYECTO', 'MIEMBRO_CICLOPE']) {
    assert.equal(CONTENT_WRITE_ROLES.includes(role as never), true, `${role} debe conservar permiso de escritura funcional`);
  }
});
