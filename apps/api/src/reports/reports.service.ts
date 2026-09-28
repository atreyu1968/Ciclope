import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ActionStatus } from '../generated/prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';

type ReportScope = {
  academicYearId: string;
  networkIds?: string[];
  requestedNetworkId?: string;
};

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private isGlobal(user: AuthenticatedUser) {
    return ['SUPERADMIN', 'ADMIN_CENTRO', 'DIRECCION', 'COORDINADOR_CICLOPE']
      .some((role) => user.roles.includes(role));
  }

  private async resolveScope(
    user: AuthenticatedUser,
    academicYearId?: string,
    networkId?: string,
  ): Promise<ReportScope> {
    const targetYearId = academicYearId ?? user.academicYearId;
    if (!targetYearId) throw new NotFoundException('No existe un curso académico disponible.');

    const year = await this.prisma.academicYear.findFirst({
      where: { id: targetYearId, centerId: user.centerId },
      select: { id: true },
    });
    if (!year) throw new NotFoundException('Curso académico no encontrado.');

    if (this.isGlobal(user)) {
      if (networkId) {
        const network = await this.prisma.network.findFirst({ where: { id: networkId, active: true } });
        if (!network) throw new NotFoundException('Red no encontrada.');
      }
      return { academicYearId: targetYearId, requestedNetworkId: networkId };
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
    };
  }

  private actionWhere(scope: ReportScope, status?: ActionStatus) {
    return {
      academicYearId: scope.academicYearId,
      ...(status ? { status } : {}),
      ...(scope.networkIds
        ? { networks: { some: { networkId: { in: scope.networkIds } } } }
        : scope.requestedNetworkId
          ? { networks: { some: { networkId: scope.requestedNetworkId } } }
          : {}),
    };
  }

  async summary(user: AuthenticatedUser, academicYearId?: string, networkId?: string) {
    const scope = await this.resolveScope(user, academicYearId, networkId);
    const year = await this.prisma.academicYear.findUniqueOrThrow({
      where: { id: scope.academicYearId },
      include: { center: { select: { name: true, code: true } } },
    });

    const [validated, pendingCount, returnedCount] = await Promise.all([
      this.prisma.action.findMany({
        where: this.actionWhere(scope, ActionStatus.VALIDATED),
        include: {
          networks: { include: { network: true } },
          groups: {
            include: {
              teachingGroup: { include: { professionalFamily: true } },
            },
          },
          evidence: { select: { id: true } },
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
    ]);

    const uniqueTeachers = new Map<string, string>();
    let studentParticipations = 0;
    let totalMinutes = 0;
    let evidenceCount = 0;

    const networkMap = new Map<string, { id: string; name: string; actions: number; participants: number; evidence: number }>();
    const familyMap = new Map<string, { id: string; name: string; actions: number; participants: number }>();
    const typeMap = new Map<string, { type: string; actions: number; participants: number }>();
    const monthMap = new Map<string, { month: string; actions: number; participants: number }>();

    for (const action of validated) {
      const participants = action.studentCount ?? 0;
      studentParticipations += participants;
      totalMinutes += action.durationMinutes ?? 0;
      evidenceCount += action.evidence.length;

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
      totals: {
        validatedActions: validated.length,
        pendingActions: pendingCount,
        returnedActions: returnedCount,
        teachers: uniqueTeachers.size,
        studentParticipations,
        totalMinutes,
        totalHours: Math.round((totalMinutes / 60) * 10) / 10,
        evidence: evidenceCount,
      },
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

  async actionRows(user: AuthenticatedUser, academicYearId?: string, networkId?: string) {
    const scope = await this.resolveScope(user, academicYearId, networkId);
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

  async csv(user: AuthenticatedUser, academicYearId?: string, networkId?: string) {
    const rows = await this.actionRows(user, academicYearId, networkId);
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
    ].map(escape).join(';'));

    return '\uFEFF' + [header, ...lines].join('\n');
  }
}
