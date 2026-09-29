import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ActionStatus, AnnualPlanStatus, NetworkCode, PlanObjectiveStatus } from '../generated/prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { MailOutboxService } from '../mail/mail-outbox.service';
import { ACTION_NETWORK_FIELDS, publicActionNetworkFields } from './action-form.config';
import { CreateActionDto } from './dto/create-action.dto';

@Injectable()
export class ActionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailOutboxService,
  ) {}

  private actionPortalLink() {
    const base = process.env.APP_BASE_URL?.replace(/\/$/, '');
    return base ? `${base}/actuaciones/mis-actuaciones` : '';
  }

  private async notifyActionStatus(
    action: {
      id: string;
      title: string;
      submittedById: string | null;
      submittedByEmail: string;
      submittedBy?: { id: string; email: string; firstName: string } | null;
      academicYear: { centerId: string };
    },
    kind: 'validated' | 'returned',
    transitionAt: Date,
    reason?: string,
  ) {
    if (!action.submittedById || !action.submittedBy) return;
    const link = this.actionPortalLink();
    const validated = kind === 'validated';
    const subject = validated
      ? `[CÍCLOPE FP] Actuación validada: ${action.title}`
      : `[CÍCLOPE FP] Actuación devuelta para corrección: ${action.title}`;
    const body = validated
      ? [
          `Hola ${action.submittedBy.firstName},`,
          '',
          `La actuación “${action.title}” ha sido validada por la coordinación.`,
          link ? `Consulta tus actuaciones en: ${link}` : '',
        ].filter(Boolean).join('\n')
      : [
          `Hola ${action.submittedBy.firstName},`,
          '',
          `La actuación “${action.title}” ha sido devuelta para corrección.`,
          reason ? `Motivo: ${reason}` : '',
          link ? `Revísala y vuelve a enviarla desde: ${link}` : '',
        ].filter(Boolean).join('\n');

    await this.mail.enqueueDirectOnce(
      action.academicYear.centerId,
      `action:${action.id}:${kind}:${transitionAt.toISOString()}`,
      subject,
      body,
      { id: action.submittedBy.id, email: action.submittedBy.email },
    );
  }

  private canManageAll(user: AuthenticatedUser) {
    return ['SUPERADMIN', 'ADMIN_CENTRO', 'DIRECCION', 'COORDINADOR_CICLOPE']
      .some((role) => user.roles.includes(role));
  }

  formConfig() {
    return publicActionNetworkFields();
  }

  private normalizeNetworkDetails(
    networkCodes: NetworkCode[],
    raw?: Record<string, unknown>,
  ) {
    if (!raw) return undefined;

    const normalized: Record<string, Record<string, string | boolean>> = {};

    for (const code of networkCodes) {
      const source = raw[code];
      if (!source || typeof source !== 'object' || Array.isArray(source)) continue;

      const values = source as Record<string, unknown>;
      const result: Record<string, string | boolean> = {};

      for (const field of ACTION_NETWORK_FIELDS[code]) {
        const value = values[field.key];

        if (field.type === 'boolean') {
          if (typeof value === 'boolean') result[field.key] = value;
          continue;
        }

        if (typeof value !== 'string') continue;
        const trimmed = value.trim();
        if (!trimmed) continue;

        if (
          field.type === 'select' &&
          field.options &&
          !field.options.some((option) => option.value === trimmed)
        ) {
          throw new BadRequestException(`Valor no válido en “${field.label}”.`);
        }

        result[field.key] = trimmed.slice(0, 180);
      }

      if (Object.keys(result).length) normalized[code] = result;
    }

    return Object.keys(normalized).length ? normalized : undefined;
  }

  private async assertCanManageAction(actionId: string, user: AuthenticatedUser) {
    const action = await this.prisma.action.findUnique({
      where: { id: actionId },
      include: { networks: true, academicYear: true },
    });
    if (!action || action.academicYear.centerId !== user.centerId) {
      throw new NotFoundException('Actuación no encontrada.');
    }
    if (action.academicYearId !== user.academicYearId) {
      throw new ForbiddenException('La actuación pertenece a otro curso académico.');
    }

    if (!this.canManageAll(user)) {
      const allowed = action.networks.some((item) => user.coordinatorNetworkIds.includes(item.networkId));
      if (!allowed) throw new ForbiddenException('No puedes gestionar actuaciones de otra red.');
    }

    return action;
  }

  async create(dto: CreateActionDto, user: AuthenticatedUser) {
    if (!user.academicYearId) {
      throw new BadRequestException('No existe un curso académico activo.');
    }

    const uniqueNetworkIds = [...new Set(dto.networkIds)];
    const selectedNetworks = await this.prisma.network.findMany({
      where: { id: { in: uniqueNetworkIds }, active: true },
      select: { id: true, code: true },
    });
    if (selectedNetworks.length !== uniqueNetworkIds.length) {
      throw new BadRequestException('Una o más redes seleccionadas no son válidas.');
    }
    const networkDetails = this.normalizeNetworkDetails(
      selectedNetworks.map((network) => network.code),
      dto.networkDetails,
    );

    const uniqueGroupIds = [...new Set(dto.teachingGroupIds ?? [])];
    const groups = uniqueGroupIds.length
      ? await this.prisma.teachingGroup.findMany({
          where: {
            id: { in: uniqueGroupIds },
            academicYearId: user.academicYearId,
            active: true,
          },
          select: { id: true, studentCount: true },
        })
      : [];

    if (groups.length !== uniqueGroupIds.length) {
      throw new BadRequestException('Uno o más grupos no pertenecen al curso activo.');
    }

    const inferredStudentCount = groups.reduce((sum, group) => sum + (group.studentCount ?? 0), 0);

    const uniqueObjectiveIds = [...new Set(dto.objectiveIds ?? [])];
    const objectives = uniqueObjectiveIds.length
      ? await this.prisma.planObjective.findMany({
          where: {
            id: { in: uniqueObjectiveIds },
            status: { in: [PlanObjectiveStatus.PLANNED, PlanObjectiveStatus.IN_PROGRESS, PlanObjectiveStatus.COMPLETED] },
            plan: {
              academicYearId: user.academicYearId,
              networkId: { in: uniqueNetworkIds },
              status: AnnualPlanStatus.ACTIVE,
            },
          },
          select: { id: true },
        })
      : [];

    if (objectives.length !== uniqueObjectiveIds.length) {
      throw new BadRequestException('Uno o más objetivos no pertenecen a un plan activo de las redes seleccionadas.');
    }

    return this.prisma.action.create({
      data: {
        title: dto.title.trim(),
        description: dto.description.trim(),
        type: dto.type,
        activityDate: new Date(dto.activityDate),
        durationMinutes: dto.durationMinutes,
        studentCount: dto.studentCount ?? (groups.length ? inferredStudentCount : undefined),
        networkDetails,
        submittedById: user.id,
        submittedByName: `${user.firstName} ${user.lastName}`.trim(),
        submittedByEmail: user.email,
        academicYearId: user.academicYearId,
        status: dto.saveAsDraft ? ActionStatus.DRAFT : ActionStatus.PENDING_VALIDATION,
        networks: { create: uniqueNetworkIds.map((networkId) => ({ networkId })) },
        groups: { create: uniqueGroupIds.map((teachingGroupId) => ({ teachingGroupId })) },
        objectives: { create: uniqueObjectiveIds.map((objectiveId) => ({ objectiveId })) },
      },
      include: {
        networks: { include: { network: true } },
        groups: { include: { teachingGroup: { include: { professionalFamily: true } } } },
        objectives: { include: { objective: { include: { plan: { include: { network: true } } } } } },
      },
    });
  }

  async findMineOne(id: string, user: AuthenticatedUser) {
    const action = await this.prisma.action.findFirst({
      where: {
        id,
        submittedById: user.id,
        ...(user.academicYearId ? { academicYearId: user.academicYearId } : {}),
      },
      include: {
        networks: { include: { network: true } },
        groups: { include: { teachingGroup: { include: { professionalFamily: true } } } },
        evidence: true,
        objectives: {
          include: {
            objective: { include: { plan: { include: { network: true } } } },
          },
        },
      },
    });
    if (!action) throw new NotFoundException('Actuación no encontrada.');
    return action;
  }

  findMine(user: AuthenticatedUser) {
    return this.prisma.action.findMany({
      where: {
        submittedById: user.id,
        ...(user.academicYearId ? { academicYearId: user.academicYearId } : {}),
      },
      include: {
        networks: { include: { network: true } },
        groups: { include: { teachingGroup: { include: { professionalFamily: true } } } },
        evidence: true,
        objectives: {
          include: {
            objective: { include: { plan: { include: { network: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  findAll(
    user: AuthenticatedUser,
    status?: string,
    networkId?: string,
    familyId?: string,
    teacherId?: string,
    from?: string,
    to?: string,
  ) {
    if (!user.academicYearId) return [];

    const parsedStatus = status && Object.values(ActionStatus).includes(status as ActionStatus)
      ? status as ActionStatus
      : undefined;

    if (networkId && !this.canManageAll(user) && !user.coordinatorNetworkIds.includes(networkId)) {
      throw new ForbiddenException('No puedes consultar actuaciones de otra red.');
    }

    const fromDate = from ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(from) ? `${from}T00:00:00.000Z` : from) : undefined;
    const toDate = to ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(to) ? `${to}T23:59:59.999Z` : to) : undefined;
    if (fromDate && Number.isNaN(fromDate.getTime())) {
      throw new BadRequestException('La fecha inicial del filtro no es válida.');
    }
    if (toDate && Number.isNaN(toDate.getTime())) {
      throw new BadRequestException('La fecha final del filtro no es válida.');
    }
    if (fromDate && toDate && fromDate > toDate) {
      throw new BadRequestException('La fecha inicial no puede ser posterior a la fecha final.');
    }

    const networkFilter = networkId
      ? { networks: { some: { networkId } } }
      : !this.canManageAll(user)
        ? { networks: { some: { networkId: { in: user.coordinatorNetworkIds } } } }
        : {};

    return this.prisma.action.findMany({
      where: {
        academicYearId: user.academicYearId,
        ...(parsedStatus ? { status: parsedStatus } : {}),
        ...networkFilter,
        ...(familyId
          ? { groups: { some: { teachingGroup: { professionalFamilyId: familyId } } } }
          : {}),
        ...(teacherId ? { submittedById: teacherId } : {}),
        ...((fromDate || toDate)
          ? {
              activityDate: {
                ...(fromDate ? { gte: fromDate } : {}),
                ...(toDate ? { lte: toDate } : {}),
              },
            }
          : {}),
      },
      include: {
        networks: { include: { network: true } },
        groups: { include: { teachingGroup: { include: { professionalFamily: true } } } },
        evidence: true,
        submittedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 250,
    });
  }

  async resubmit(
    id: string,
    dto: CreateActionDto,
    user: AuthenticatedUser,
    requireReturned = true,
  ) {
    if (!user.academicYearId) throw new BadRequestException('No existe un curso académico activo.');

    const current = await this.prisma.action.findFirst({
      where: {
        id,
        submittedById: user.id,
        academicYearId: user.academicYearId,
      },
    });
    if (!current) throw new NotFoundException('Actuación no encontrada.');
    if (requireReturned && current.status !== ActionStatus.RETURNED) {
      throw new BadRequestException('Solo pueden reenviarse actuaciones devueltas para corrección.');
    }
    if (!requireReturned && current.status !== ActionStatus.DRAFT && current.status !== ActionStatus.PENDING_VALIDATION) {
      throw new BadRequestException('Solo pueden editarse actuaciones que aún no han sido validadas.');
    }

    const uniqueNetworkIds = [...new Set(dto.networkIds)];
    const selectedNetworks = await this.prisma.network.findMany({
      where: { id: { in: uniqueNetworkIds }, active: true },
      select: { id: true, code: true },
    });
    if (selectedNetworks.length !== uniqueNetworkIds.length) {
      throw new BadRequestException('Una o más redes seleccionadas no son válidas.');
    }
    const networkDetails = this.normalizeNetworkDetails(
      selectedNetworks.map((network) => network.code),
      dto.networkDetails,
    );

    const uniqueGroupIds = [...new Set(dto.teachingGroupIds ?? [])];
    const groups = uniqueGroupIds.length
      ? await this.prisma.teachingGroup.findMany({
          where: {
            id: { in: uniqueGroupIds },
            academicYearId: user.academicYearId,
            active: true,
          },
          select: { id: true, studentCount: true },
        })
      : [];
    if (groups.length !== uniqueGroupIds.length) {
      throw new BadRequestException('Uno o más grupos no pertenecen al curso activo.');
    }
    const inferredStudentCount = groups.reduce((sum, group) => sum + (group.studentCount ?? 0), 0);

    const uniqueObjectiveIds = [...new Set(dto.objectiveIds ?? [])];
    const objectives = uniqueObjectiveIds.length
      ? await this.prisma.planObjective.findMany({
          where: {
            id: { in: uniqueObjectiveIds },
            status: { in: [PlanObjectiveStatus.PLANNED, PlanObjectiveStatus.IN_PROGRESS, PlanObjectiveStatus.COMPLETED] },
            plan: {
              academicYearId: user.academicYearId,
              networkId: { in: uniqueNetworkIds },
              status: AnnualPlanStatus.ACTIVE,
            },
          },
          select: { id: true },
        })
      : [];

    if (objectives.length !== uniqueObjectiveIds.length) {
      throw new BadRequestException('Uno o más objetivos no pertenecen a un plan activo de las redes seleccionadas.');
    }

    return this.prisma.action.update({
      where: { id },
      data: {
        title: dto.title.trim(),
        description: dto.description.trim(),
        type: dto.type,
        activityDate: new Date(dto.activityDate),
        durationMinutes: dto.durationMinutes,
        studentCount: dto.studentCount ?? (groups.length ? inferredStudentCount : undefined),
        networkDetails,
        status: requireReturned
          ? ActionStatus.PENDING_VALIDATION
          : dto.saveAsDraft
            ? ActionStatus.DRAFT
            : ActionStatus.PENDING_VALIDATION,
        returnedAt: null,
        returnedReason: null,
        validatedAt: null,
        validatedById: null,
        networks: {
          deleteMany: {},
          create: uniqueNetworkIds.map((networkId) => ({ networkId })),
        },
        groups: {
          deleteMany: {},
          create: uniqueGroupIds.map((teachingGroupId) => ({ teachingGroupId })),
        },
        objectives: {
          deleteMany: {},
          create: uniqueObjectiveIds.map((objectiveId) => ({ objectiveId })),
        },
      },
      include: {
        networks: { include: { network: true } },
        groups: { include: { teachingGroup: true } },
        objectives: { include: { objective: true } },
      },
    });
  }

  async duplicate(id: string, user: AuthenticatedUser) {
    if (!user.academicYearId) throw new BadRequestException('No existe un curso académico activo.');

    const source = await this.prisma.action.findFirst({
      where: {
        id,
        submittedById: user.id,
        academicYearId: user.academicYearId,
      },
      include: {
        networks: true,
        groups: true,
        objectives: true,
      },
    });
    if (!source) throw new NotFoundException('Actuación no encontrada.');

    return this.prisma.action.create({
      data: {
        academicYearId: user.academicYearId,
        title: `${source.title} (copia)`.slice(0, 180),
        description: source.description,
        type: source.type,
        activityDate: source.activityDate,
        durationMinutes: source.durationMinutes,
        studentCount: source.studentCount,
        networkDetails: source.networkDetails ?? undefined,
        status: ActionStatus.DRAFT,
        submittedById: user.id,
        submittedByName: `${user.firstName} ${user.lastName}`.trim(),
        submittedByEmail: user.email,
        networks: {
          create: source.networks.map((item) => ({ networkId: item.networkId })),
        },
        groups: {
          create: source.groups.map((item) => ({ teachingGroupId: item.teachingGroupId })),
        },
        objectives: {
          create: source.objectives.map((item) => ({ objectiveId: item.objectiveId })),
        },
      },
      include: {
        networks: { include: { network: true } },
        groups: { include: { teachingGroup: true } },
        objectives: { include: { objective: true } },
      },
    });
  }

  async validateBatch(ids: string[], user: AuthenticatedUser) {
    const uniqueIds = [...new Set(ids)];
    for (const id of uniqueIds) {
      await this.assertCanManageAction(id, user);
    }

    const validatedAt = new Date();
    const result = await this.prisma.action.updateMany({
      where: {
        id: { in: uniqueIds },
        status: ActionStatus.PENDING_VALIDATION,
      },
      data: {
        status: ActionStatus.VALIDATED,
        validatedAt,
        validatedById: user.id,
        returnedAt: null,
        returnedReason: null,
      },
    });

    if (result.count) {
      const validated = await this.prisma.action.findMany({
        where: { id: { in: uniqueIds }, validatedAt },
        include: {
          academicYear: { select: { centerId: true } },
          submittedBy: { select: { id: true, email: true, firstName: true } },
        },
      });
      await Promise.all(validated.map((action) =>
        this.notifyActionStatus(action, 'validated', validatedAt),
      ));
    }

    return { validated: result.count };
  }

  async validate(id: string, user: AuthenticatedUser) {
    const current = await this.assertCanManageAction(id, user);
    if (current.status !== ActionStatus.PENDING_VALIDATION) {
      throw new BadRequestException('La actuación ya no está pendiente de validación.');
    }

    const validatedAt = new Date();
    const updated = await this.prisma.action.update({
      where: { id },
      data: {
        status: ActionStatus.VALIDATED,
        validatedAt,
        validatedById: user.id,
        returnedAt: null,
        returnedReason: null,
      },
      include: {
        academicYear: { select: { centerId: true } },
        submittedBy: { select: { id: true, email: true, firstName: true } },
      },
    });
    await this.notifyActionStatus(updated, 'validated', validatedAt);
    return updated;
  }

  async returnForCorrection(id: string, reason: string, user: AuthenticatedUser) {
    const current = await this.assertCanManageAction(id, user);
    if (current.status !== ActionStatus.PENDING_VALIDATION) {
      throw new BadRequestException('La actuación ya no está pendiente de validación.');
    }

    const returnedAt = new Date();
    const cleanReason = reason.trim();
    const updated = await this.prisma.action.update({
      where: { id },
      data: {
        status: ActionStatus.RETURNED,
        returnedAt,
        returnedReason: cleanReason,
        validatedById: user.id,
        validatedAt: null,
      },
      include: {
        academicYear: { select: { centerId: true } },
        submittedBy: { select: { id: true, email: true, firstName: true } },
      },
    });
    await this.notifyActionStatus(updated, 'returned', returnedAt, cleanReason);
    return updated;
  }
}
