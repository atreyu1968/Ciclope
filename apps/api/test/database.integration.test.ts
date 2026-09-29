import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaService } from '../src/database/prisma.service';
import {
  ActionStatus,
  AnnualPlanStatus,
  NetworkCode,
  PlanMetric,
  PlanObjectiveStatus,
  PlanTaskStatus,
  Shift,
} from '../src/generated/prisma/client';

const prisma = new PrismaService();

test.before(async () => {
  await prisma.$connect();
});

test.after(async () => {
  await prisma.$disconnect();
});

test('las migraciones y el seed dejan disponibles las cuatro redes y los roles esenciales', async () => {
  const [networks, roles] = await Promise.all([
    prisma.network.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.role.findMany({ orderBy: { key: 'asc' } }),
  ]);

  assert.deepEqual(
    networks.map((network) => network.code),
    [
      NetworkCode.INNOVATION,
      NetworkCode.ENTREPRENEURSHIP,
      NetworkCode.GUIDANCE,
      NetworkCode.QUALITY,
    ],
  );

  const roleKeys = new Set(roles.map((role) => role.key));
  for (const key of [
    'SUPERADMIN',
    'ADMIN_CENTRO',
    'DIRECCION',
    'COORDINADOR_CICLOPE',
    'COORD_INNOVACION',
    'COORD_EMPRENDIMIENTO',
    'COORD_IOP',
    'COORD_CALIDAD',
    'PROFESOR_FP',
  ]) {
    assert.equal(roleKeys.has(key), true, `Falta el rol ${key}`);
  }
});

test('PostgreSQL persiste y relaciona el flujo básico de un curso completo', async () => {
  const suffix = Date.now().toString(36);
  const center = await prisma.center.create({
    data: {
      name: 'Centro CI integración',
      code: `CI-${suffix}`,
    },
  });

  try {
    const academicYear = await prisma.academicYear.create({
      data: {
        centerId: center.id,
        name: '2098-2099',
        startsAt: new Date('2098-09-01T00:00:00.000Z'),
        endsAt: new Date('2099-06-30T23:59:59.000Z'),
        isActive: true,
      },
    });

    const family = await prisma.professionalFamily.create({
      data: {
        centerId: center.id,
        name: 'Administración y Gestión CI',
        code: `ADG-${suffix}`,
      },
    });

    const group = await prisma.teachingGroup.create({
      data: {
        academicYearId: academicYear.id,
        professionalFamilyId: family.id,
        name: `2º CFGM GA CI ${suffix}`,
        shift: Shift.MORNING,
        studentCount: 20,
      },
    });

    const teacher = await prisma.user.create({
      data: {
        centerId: center.id,
        email: `docente-${suffix}@example.test`,
        firstName: 'Docente',
        lastName: 'Integración',
        shift: Shift.MORNING,
      },
    });

    const innovation = await prisma.network.findUniqueOrThrow({
      where: { code: NetworkCode.INNOVATION },
    });

    const action = await prisma.action.create({
      data: {
        academicYearId: academicYear.id,
        title: 'Actuación de integración',
        description: 'Prueba automática de persistencia y relaciones.',
        type: 'PROYECTO',
        status: ActionStatus.PENDING_VALIDATION,
        activityDate: new Date('2098-10-15T10:00:00.000Z'),
        durationMinutes: 110,
        studentCount: 20,
        submittedById: teacher.id,
        submittedByName: 'Docente Integración',
        submittedByEmail: teacher.email,
        networks: { create: [{ networkId: innovation.id }] },
        groups: { create: [{ teachingGroupId: group.id }] },
        evidence: {
          create: [{
            uploadedById: teacher.id,
            kind: 'LINK',
            title: 'Evidencia CI',
            url: 'https://example.test/evidencia',
          }],
        },
      },
    });

    const plan = await prisma.annualPlan.create({
      data: {
        academicYearId: academicYear.id,
        networkId: innovation.id,
        title: 'Plan anual CI',
        status: AnnualPlanStatus.ACTIVE,
        objectives: {
          create: [{
            title: 'Objetivo medible CI',
            metric: PlanMetric.ACTIONS,
            targetValue: 1,
            status: PlanObjectiveStatus.IN_PROGRESS,
          }],
        },
      },
      include: { objectives: true },
    });

    const objective = plan.objectives[0];
    assert.ok(objective);

    await prisma.actionObjective.create({
      data: { actionId: action.id, objectiveId: objective.id },
    });

    const task = await prisma.planTask.create({
      data: {
        planId: plan.id,
        objectiveId: objective.id,
        ownerId: teacher.id,
        title: 'Tarea CI',
        dueDate: new Date('2098-10-31T23:59:00.000Z'),
        status: PlanTaskStatus.TODO,
      },
    });

    const loaded = await prisma.action.findUniqueOrThrow({
      where: { id: action.id },
      include: {
        networks: { include: { network: true } },
        groups: { include: { teachingGroup: { include: { professionalFamily: true } } } },
        evidence: true,
        objectives: { include: { objective: true } },
      },
    });

    assert.equal(loaded.submittedById, teacher.id);
    assert.equal(loaded.networks[0]?.network.code, NetworkCode.INNOVATION);
    assert.equal(loaded.groups[0]?.teachingGroup.professionalFamily.id, family.id);
    assert.equal(loaded.evidence.length, 1);
    assert.equal(loaded.objectives[0]?.objective.id, objective.id);

    const loadedTask = await prisma.planTask.findUniqueOrThrow({
      where: { id: task.id },
      include: { plan: true, objective: true, owner: true },
    });
    assert.equal(loadedTask.plan.academicYearId, academicYear.id);
    assert.equal(loadedTask.objective?.id, objective.id);
    assert.equal(loadedTask.owner?.id, teacher.id);

    const validatedAt = new Date();
    const validated = await prisma.action.update({
      where: { id: action.id },
      data: {
        status: ActionStatus.VALIDATED,
        validatedById: teacher.id,
        validatedAt,
      },
    });
    assert.equal(validated.status, ActionStatus.VALIDATED);
    assert.ok(validated.validatedAt);
  } finally {
    await prisma.center.delete({ where: { id: center.id } }).catch(() => undefined);
  }
});
