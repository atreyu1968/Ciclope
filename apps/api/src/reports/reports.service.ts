import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ActionStatus, NetworkCode, PlanMetric, PlanTaskStatus, ReportSnapshotStatus } from '../generated/prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { ACTION_NETWORK_FIELDS } from '../actions/action-form.config';
import { CreateReportSnapshotDto } from './dto/create-report-snapshot.dto';

type ReportScope = {
  academicYearId: string;
  networkIds?: string[];
  requestedNetworkId?: string;
  from?: Date;
  to?: Date;
};

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private isGlobal(user: AuthenticatedUser) {
    return ['SUPERADMIN', 'ADMIN_CENTRO', 'DIRECCION', 'COORDINADOR_CICLOPE']
      .some((role) => user.roles.includes(role));
  }

  private parsePeriodDate(value: string | undefined, endOfDay = false) {
    if (!value) return undefined;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new NotFoundException('El periodo del informe no tiene un formato válido.');
    }
    const parsed = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
    if (Number.isNaN(parsed.getTime())) {
      throw new NotFoundException('El periodo del informe no es válido.');
    }
    return parsed;
  }

  private async resolveScope(
    user: AuthenticatedUser,
    academicYearId?: string,
    networkId?: string,
    from?: string,
    to?: string,
  ): Promise<ReportScope> {
    const targetYearId = academicYearId ?? user.academicYearId;
    if (!targetYearId) throw new NotFoundException('No existe un curso académico disponible.');

    const year = await this.prisma.academicYear.findFirst({
      where: { id: targetYearId, centerId: user.centerId },
      select: { id: true, startsAt: true, endsAt: true },
    });
    if (!year) throw new NotFoundException('Curso académico no encontrado.');

    const fromDate = this.parsePeriodDate(from);
    const toDate = this.parsePeriodDate(to, true);
    if (fromDate && toDate && fromDate > toDate) {
      throw new NotFoundException('La fecha inicial del periodo no puede ser posterior a la final.');
    }
    if (fromDate && fromDate < year.startsAt) {
      throw new NotFoundException('La fecha inicial está fuera del curso académico.');
    }
    if (toDate && toDate > year.endsAt) {
      throw new NotFoundException('La fecha final está fuera del curso académico.');
    }

    if (this.isGlobal(user)) {
      if (networkId) {
        const network = await this.prisma.network.findFirst({ where: { id: networkId, active: true } });
        if (!network) throw new NotFoundException('Red no encontrada.');
      }
      return {
        academicYearId: targetYearId,
        requestedNetworkId: networkId,
        from: fromDate,
        to: toDate,
      };
    }

    const assignments = await this.prisma.networkCoordinator.findMany({
      where: { academicYearId: targetYearId, userId: user.id },
      select: { networkId: true },
    });
    const allowedNetworkIds = assignments.map((item) => item.networkId);

    if (!allowedNetworkIds.length) {
      throw new ForbiddenException('No tienes coordinaciones asignadas en ese curso académico.');
    }
    if (networkId && !allowedNetworkIds.includes(networkId)) {
      throw new ForbiddenException('No puedes consultar informes de esa red.');
    }

    return {
      academicYearId: targetYearId,
      networkIds: networkId ? [networkId] : allowedNetworkIds,
      requestedNetworkId: networkId,
      from: fromDate,
      to: toDate,
    };
  }

  private actionWhere(scope: ReportScope, status?: ActionStatus) {
    return {
      academicYearId: scope.academicYearId,
      ...(status ? { status } : {}),
      ...((scope.from || scope.to)
        ? {
            activityDate: {
              ...(scope.from ? { gte: scope.from } : {}),
              ...(scope.to ? { lte: scope.to } : {}),
            },
          }
        : {}),
      ...(scope.networkIds
        ? { networks: { some: { networkId: { in: scope.networkIds } } } }
        : scope.requestedNetworkId
          ? { networks: { some: { networkId: scope.requestedNetworkId } } }
          : {}),
    };
  }

  async summary(
    user: AuthenticatedUser,
    academicYearId?: string,
    networkId?: string,
    from?: string,
    to?: string,
  ) {
    const scope = await this.resolveScope(user, academicYearId, networkId, from, to);
    const year = await this.prisma.academicYear.findUniqueOrThrow({
      where: { id: scope.academicYearId },
      include: { center: { select: { name: true, code: true } } },
    });

    const [validated, pendingCount, returnedCount, annualPlans] = await Promise.all([
      this.prisma.action.findMany({
        where: this.actionWhere(scope, ActionStatus.VALIDATED),
        include: {
          networks: { include: { network: true } },
          groups: {
            include: {
              teachingGroup: { include: { professionalFamily: true } },
            },
          },
          evidence: { select: { id: true, kind: true } },
          submittedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        orderBy: { activityDate: 'asc' },
      }),
      this.prisma.action.count({
        where: this.actionWhere(scope, ActionStatus.PENDING_VALIDATION),
      }),
      this.prisma.action.count({
        where: this.actionWhere(scope, ActionStatus.RETURNED),
      }),
      this.prisma.annualPlan.findMany({
        where: {
          academicYearId: scope.academicYearId,
          ...(scope.networkIds
            ? { networkId: { in: scope.networkIds } }
            : scope.requestedNetworkId
              ? { networkId: scope.requestedNetworkId }
              : {}),
        },
        include: {
          network: { select: { id: true, name: true } },
          objectives: {
            include: {
              actions: {
                include: {
                  action: {
                    select: {
                      id: true,
                      status: true,
                      activityDate: true,
                      studentCount: true,
                      durationMinutes: true,
                      evidence: { select: { id: true } },
                    },
                  },
                },
              },
            },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          },
          tasks: {
            select: {
              id: true,
              title: true,
              status: true,
              dueDate: true,
              official: true,
            },
            orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
          },
        },
        orderBy: { network: { sortOrder: 'asc' } },
      }),
    ]);

    const uniqueTeachers = new Map<string, string>();
    let studentParticipations = 0;
    let totalMinutes = 0;
    let evidenceCount = 0;
    let evidenceFileCount = 0;
    let evidenceLinkCount = 0;
    let actionsWithEvidence = 0;

    const networkMap = new Map<string, { id: string; name: string; actions: number; participants: number; evidence: number }>();
    const familyMap = new Map<string, { id: string; name: string; actions: number; participants: number }>();
    const typeMap = new Map<string, { type: string; actions: number; participants: number }>();
    const monthMap = new Map<string, { month: string; actions: number; participants: number }>();
    const insightMap = new Map<string, {
      id: string;
      name: string;
      code: NetworkCode;
      fields: Map<string, {
        key: string;
        label: string;
        values: Map<string, { value: string; label: string; count: number }>;
      }>;
    }>();

    for (const action of validated) {
      const participants = action.studentCount ?? 0;
      studentParticipations += participants;
      totalMinutes += action.durationMinutes ?? 0;
      evidenceCount += action.evidence.length;
      if (action.evidence.length) actionsWithEvidence += 1;
      evidenceFileCount += action.evidence.filter((item) => item.kind === 'FILE').length;
      evidenceLinkCount += action.evidence.filter((item) => item.kind === 'LINK').length;

      const teacherKey = action.submittedById ?? action.submittedByEmail;
      uniqueTeachers.set(
        teacherKey,
        action.submittedBy
          ? `${action.submittedBy.firstName} ${action.submittedBy.lastName}`
          : action.submittedByName,
      );

      const type = typeMap.get(action.type) ?? { type: action.type, actions: 0, participants: 0 };
      type.actions += 1;
      type.participants += participants;
      typeMap.set(action.type, type);

      const monthKey = action.activityDate.toISOString().slice(0, 7);
      const month = monthMap.get(monthKey) ?? { month: monthKey, actions: 0, participants: 0 };
      month.actions += 1;
      month.participants += participants;
      monthMap.set(monthKey, month);

      for (const relation of action.networks) {
        if (scope.networkIds && !scope.networkIds.includes(relation.networkId)) continue;
        if (scope.requestedNetworkId && relation.networkId !== scope.requestedNetworkId) continue;

        const row = networkMap.get(relation.networkId) ?? {
          id: relation.networkId,
          name: relation.network.name,
          actions: 0,
          participants: 0,
          evidence: 0,
        };
        row.actions += 1;
        row.participants += participants;
        row.evidence += action.evidence.length;
        networkMap.set(relation.networkId, row);

        const rootDetails =
          action.networkDetails &&
          typeof action.networkDetails === 'object' &&
          !Array.isArray(action.networkDetails)
            ? action.networkDetails as Record<string, unknown>
            : {};
        const networkDetails = rootDetails[relation.network.code];
        if (networkDetails && typeof networkDetails === 'object' && !Array.isArray(networkDetails)) {
          const values = networkDetails as Record<string, unknown>;
          const insight = insightMap.get(relation.networkId) ?? {
            id: relation.networkId,
            name: relation.network.name,
            code: relation.network.code,
            fields: new Map(),
          };

          for (const field of ACTION_NETWORK_FIELDS[relation.network.code]) {
            const rawValue = values[field.key];
            if (rawValue === undefined || rawValue === null || rawValue === '') continue;

            let value = '';
            let label = '';
            if (field.type === 'boolean' && typeof rawValue === 'boolean') {
              value = rawValue ? 'true' : 'false';
              label = rawValue ? 'Sí' : 'No';
            } else if (typeof rawValue === 'string') {
              value = rawValue;
              label = field.options?.find((option) => option.value === rawValue)?.label ?? rawValue;
            } else {
              continue;
            }

            const fieldRow = insight.fields.get(field.key) ?? {
              key: field.key,
              label: field.label,
              values: new Map(),
            };
            const valueRow = fieldRow.values.get(value) ?? { value, label, count: 0 };
            valueRow.count += 1;
            fieldRow.values.set(value, valueRow);
            insight.fields.set(field.key, fieldRow);
          }

          insightMap.set(relation.networkId, insight);
        }
      }

      const familiesInAction = new Map<string, { id: string; name: string; participants: number }>();
      for (const relation of action.groups) {
        const group = relation.teachingGroup;
        const family = group.professionalFamily;
        const current = familiesInAction.get(family.id) ?? {
          id: family.id,
          name: family.name,
          participants: 0,
        };
        current.participants += group.studentCount ?? 0;
        familiesInAction.set(family.id, current);
      }
      for (const family of familiesInAction.values()) {
        const row = familyMap.get(family.id) ?? {
          id: family.id,
          name: family.name,
          actions: 0,
          participants: 0,
        };
        row.actions += 1;
        row.participants += family.participants;
        familyMap.set(family.id, row);
      }
    }

    const selectedNetwork = networkId
      ? await this.prisma.network.findUnique({ where: { id: networkId }, select: { id: true, name: true } })
      : null;

    const planProgress = annualPlans.map((plan) => {
      const objectives = plan.objectives.map((objective) => {
        const validatedActions = objective.actions
          .map((item) => item.action)
          .filter((action) =>
            action.status === ActionStatus.VALIDATED &&
            (!scope.to || action.activityDate <= scope.to),
          );

        let currentValue: number | null = null;
        if (objective.metric === PlanMetric.ACTIONS) {
          currentValue = validatedActions.length;
        } else if (objective.metric === PlanMetric.PARTICIPATIONS) {
          currentValue = validatedActions.reduce((sum, action) => sum + (action.studentCount ?? 0), 0);
        } else if (objective.metric === PlanMetric.HOURS) {
          currentValue = Math.round(
            (validatedActions.reduce((sum, action) => sum + (action.durationMinutes ?? 0), 0) / 60) * 10,
          ) / 10;
        } else if (objective.metric === PlanMetric.EVIDENCE) {
          currentValue = validatedActions.reduce((sum, action) => sum + action.evidence.length, 0);
        }

        const progressPercent =
          currentValue !== null && objective.targetValue && objective.targetValue > 0
            ? Math.min(100, Math.round((currentValue / objective.targetValue) * 100))
            : null;

        return {
          id: objective.id,
          title: objective.title,
          status: objective.status,
          metric: objective.metric,
          targetValue: objective.targetValue,
          currentValue,
          progressPercent,
          linkedValidatedActions: validatedActions.length,
        };
      });

      const measurable = objectives.filter((objective) => objective.progressPercent !== null);
      const averageProgressPercent = measurable.length
        ? Math.round(measurable.reduce((sum, objective) => sum + (objective.progressPercent ?? 0), 0) / measurable.length)
        : null;

      const now = new Date();
      const doneTasks = plan.tasks.filter((task) => task.status === PlanTaskStatus.DONE).length;
      const openTasks = plan.tasks.filter((task) =>
        task.status === PlanTaskStatus.TODO || task.status === PlanTaskStatus.IN_PROGRESS,
      );
      const overdueTasks = openTasks.filter((task) => task.dueDate && task.dueDate < now).length;

      return {
        id: plan.id,
        title: plan.title,
        status: plan.status,
        network: plan.network,
        objectives,
        measurableObjectives: measurable.length,
        averageProgressPercent,
        taskSummary: {
          total: plan.tasks.length,
          done: doneTasks,
          pending: openTasks.length,
          overdue: overdueTasks,
          officialMilestones: plan.tasks
            .filter((task) => task.official)
            .map((task) => ({
              id: task.id,
              title: task.title,
              status: task.status,
              dueDate: task.dueDate,
            })),
        },
      };
    });

    const networkInsights = [...insightMap.values()]
      .map((network) => ({
        id: network.id,
        name: network.name,
        code: network.code,
        fields: [...network.fields.values()]
          .map((field) => ({
            key: field.key,
            label: field.label,
            values: [...field.values.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
          }))
          .filter((field) => field.values.length),
      }))
      .filter((network) => network.fields.length)
      .sort((a, b) => a.name.localeCompare(b.name));

    const actionsWithoutEvidence = validated.length - actionsWithEvidence;
    const evidenceCoveragePercent = validated.length
      ? Math.round((actionsWithEvidence / validated.length) * 100)
      : 0;

    const reportAlerts: Array<{
      key: string;
      severity: 'INFO' | 'WARNING' | 'CRITICAL';
      title: string;
      detail: string;
    }> = [];

    if (validated.length === 0) {
      reportAlerts.push({
        key: 'NO_VALIDATED_ACTIONS',
        severity: 'CRITICAL',
        title: 'Sin actuaciones validadas',
        detail: 'El periodo no contiene actuaciones validadas; las cifras no son representativas de actividad consolidada.',
      });
    }
    if (evidenceCoveragePercent < 80 && validated.length > 0) {
      reportAlerts.push({
        key: 'LOW_EVIDENCE_COVERAGE',
        severity: evidenceCoveragePercent < 50 ? 'CRITICAL' : 'WARNING',
        title: 'Cobertura documental mejorable',
        detail: `Solo el ${evidenceCoveragePercent}% de las actuaciones validadas dispone de al menos una evidencia.`,
      });
    }
    if (pendingCount > 0) {
      reportAlerts.push({
        key: 'PENDING_VALIDATION',
        severity: 'WARNING',
        title: 'Datos pendientes de consolidar',
        detail: `Hay ${pendingCount} actuaciones pendientes de validación que aún no forman parte de los indicadores oficiales.`,
      });
    }
    if (returnedCount > 0) {
      reportAlerts.push({
        key: 'RETURNED_ACTIONS',
        severity: 'WARNING',
        title: 'Actuaciones devueltas',
        detail: `Hay ${returnedCount} actuaciones devueltas al profesorado para corrección.`,
      });
    }

    const overduePlanTasks = planProgress.reduce((sum, plan) => sum + plan.taskSummary.overdue, 0);
    if (overduePlanTasks > 0) {
      reportAlerts.push({
        key: 'OVERDUE_PLAN_TASKS',
        severity: 'WARNING',
        title: 'Planificación fuera de plazo',
        detail: `Los planes incluidos acumulan ${overduePlanTasks} tareas vencidas todavía abiertas.`,
      });
    }

    return {
      center: year.center,
      academicYear: {
        id: year.id,
        name: year.name,
        startsAt: year.startsAt,
        endsAt: year.endsAt,
        isActive: year.isActive,
        closedAt: year.closedAt,
      },
      network: selectedNetwork,
      period: {
        from: scope.from ?? year.startsAt,
        to: scope.to ?? year.endsAt,
        filtered: Boolean(scope.from || scope.to),
      },
      totals: {
        validatedActions: validated.length,
        pendingActions: pendingCount,
        returnedActions: returnedCount,
        teachers: uniqueTeachers.size,
        studentParticipations,
        totalMinutes,
        totalHours: Math.round((totalMinutes / 60) * 10) / 10,
        evidence: evidenceCount,
        evidenceFiles: evidenceFileCount,
        evidenceLinks: evidenceLinkCount,
        actionsWithEvidence,
        actionsWithoutEvidence,
        evidenceCoveragePercent,
      },
      planProgress,
      networkInsights,
      alerts: reportAlerts,
      byNetwork: [...networkMap.values()].sort((a, b) => b.actions - a.actions || a.name.localeCompare(b.name)),
      byFamily: [...familyMap.values()].sort((a, b) => b.actions - a.actions || a.name.localeCompare(b.name)),
      byType: [...typeMap.values()].sort((a, b) => b.actions - a.actions || a.type.localeCompare(b.type)),
      byMonth: [...monthMap.values()].sort((a, b) => a.month.localeCompare(b.month)),
      teachers: [...uniqueTeachers.entries()]
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      generatedAt: new Date().toISOString(),
    };
  }

  async saveSnapshot(user: AuthenticatedUser, dto: CreateReportSnapshotDto) {
    const report = await this.summary(
      user,
      dto.academicYearId,
      dto.networkId,
      dto.from,
      dto.to,
    );

    const start = report.period.from.toISOString().slice(0, 10);
    const end = report.period.to.toISOString().slice(0, 10);
    const title = dto.title?.trim()
      || `${report.network?.name ?? 'Redes de Enseñanzas Profesionales'} · ${start} a ${end}`;

    return this.prisma.reportSnapshot.create({
      data: {
        academicYearId: report.academicYear.id,
        networkId: report.network?.id ?? null,
        createdById: user.id,
        title,
        periodStart: report.period.from,
        periodEnd: report.period.to,
        data: JSON.parse(JSON.stringify(report)),
        narrative: dto.narrative?.trim() || null,
      },
      include: {
        academicYear: { select: { id: true, name: true } },
        network: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async listSnapshots(
    user: AuthenticatedUser,
    academicYearId?: string,
    networkId?: string,
  ) {
    const scope = await this.resolveScope(user, academicYearId, networkId);

    return this.prisma.reportSnapshot.findMany({
      where: {
        academicYearId: scope.academicYearId,
        ...(this.isGlobal(user)
          ? (scope.requestedNetworkId ? { networkId: scope.requestedNetworkId } : {})
          : {
              OR: [
                { createdById: user.id },
                { networkId: { in: scope.networkIds ?? [] } },
              ],
            }),
      },
      include: {
        academicYear: { select: { id: true, name: true } },
        network: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async snapshotDetail(user: AuthenticatedUser, id: string) {
    const snapshot = await this.prisma.reportSnapshot.findUnique({
      where: { id },
      include: {
        academicYear: true,
        network: true,
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!snapshot || snapshot.academicYear.centerId !== user.centerId) {
      throw new NotFoundException('Corte histórico no encontrado.');
    }

    if (!this.isGlobal(user) && snapshot.createdById !== user.id) {
      if (!snapshot.networkId) {
        throw new ForbiddenException('No puedes consultar este corte histórico.');
      }
      const assignment = await this.prisma.networkCoordinator.findFirst({
        where: {
          academicYearId: snapshot.academicYearId,
          networkId: snapshot.networkId,
          userId: user.id,
        },
        select: { id: true },
      });
      if (!assignment) throw new ForbiddenException('No puedes consultar este corte histórico.');
    }

    return snapshot;
  }

  async updateSnapshotNarrative(
    user: AuthenticatedUser,
    id: string,
    narrative: string,
  ) {
    const snapshot = await this.snapshotDetail(user, id);
    if (snapshot.status === ReportSnapshotStatus.SUBMITTED) {
      throw new BadRequestException('El corte está marcado como entregado. Reábrelo antes de modificar la narrativa.');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.reportSnapshot.update({
        where: { id },
        data: { narrative: narrative.trim() || null },
        include: {
          academicYear: { select: { id: true, name: true } },
          network: { select: { id: true, name: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
      });
      await tx.auditLog.create({
        data: {
          centerId: user.centerId,
          actorId: user.id,
          action: 'REPORT_NARRATIVE_UPDATED',
          entityType: 'ReportSnapshot',
          entityId: id,
        },
      });
      return updated;
    });
  }

  async updateSnapshotStatus(
    user: AuthenticatedUser,
    id: string,
    status: ReportSnapshotStatus,
  ) {
    await this.snapshotDetail(user, id);
    return this.prisma.reportSnapshot.update({
      where: { id },
      data: {
        status,
        submittedAt: status === ReportSnapshotStatus.SUBMITTED ? new Date() : null,
      },
      include: {
        academicYear: { select: { id: true, name: true } },
        network: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async actionRows(
    user: AuthenticatedUser,
    academicYearId?: string,
    networkId?: string,
    from?: string,
    to?: string,
  ) {
    const scope = await this.resolveScope(user, academicYearId, networkId, from, to);
    return this.prisma.action.findMany({
      where: this.actionWhere(scope, ActionStatus.VALIDATED),
      include: {
        networks: { include: { network: true } },
        groups: { include: { teachingGroup: { include: { professionalFamily: true } } } },
        evidence: { select: { id: true } },
      },
      orderBy: { activityDate: 'asc' },
    });
  }

  async csv(
    user: AuthenticatedUser,
    academicYearId?: string,
    networkId?: string,
    from?: string,
    to?: string,
  ) {
    const rows = await this.actionRows(user, academicYearId, networkId, from, to);
    const escape = (value: unknown) => {
      const text = String(value ?? '').replace(/"/g, '""');
      return `"${text}"`;
    };

    const header = [
      'Fecha',
      'Título',
      'Tipo',
      'Profesorado',
      'Correo',
      'Redes',
      'Familias profesionales',
      'Grupos',
      'Alumnado',
      'Duración (min)',
      'Evidencias',
      'Datos específicos de red',
    ].map(escape).join(';');

    const lines = rows.map((action) => [
      action.activityDate.toISOString().slice(0, 10),
      action.title,
      action.type,
      action.submittedByName,
      action.submittedByEmail,
      action.networks.map((item) => item.network.name).join(' | '),
      [...new Set(action.groups.map((item) => item.teachingGroup.professionalFamily.name))].join(' | '),
      action.groups.map((item) => item.teachingGroup.name).join(' | '),
      action.studentCount ?? '',
      action.durationMinutes ?? '',
      action.evidence.length,
      action.networks.flatMap((relation) => {
        const rootDetails =
          action.networkDetails &&
          typeof action.networkDetails === 'object' &&
          !Array.isArray(action.networkDetails)
            ? action.networkDetails as Record<string, unknown>
            : {};
        const networkDetails = rootDetails[relation.network.code];
        if (!networkDetails || typeof networkDetails !== 'object' || Array.isArray(networkDetails)) return [];

        const values = networkDetails as Record<string, unknown>;
        return ACTION_NETWORK_FIELDS[relation.network.code].flatMap((field) => {
          const rawValue = values[field.key];
          if (rawValue === undefined || rawValue === null || rawValue === '') return [];
          const valueLabel = field.type === 'boolean' && typeof rawValue === 'boolean'
            ? (rawValue ? 'Sí' : 'No')
            : typeof rawValue === 'string'
              ? field.options?.find((option) => option.value === rawValue)?.label ?? rawValue
              : '';
          return valueLabel ? [`${relation.network.name} · ${field.label}: ${valueLabel}`] : [];
        });
      }).join(' | '),
    ].map(escape).join(';'));

    return '\uFEFF' + [header, ...lines].join('\n');
  }
}
