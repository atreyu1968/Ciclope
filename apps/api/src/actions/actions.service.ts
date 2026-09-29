import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ActionStatus, AnnualPlanStatus, NetworkCode, PlanObjectiveStatus } from '../generated/prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { ACTION_NETWORK_FIELDS, publicActionNetworkFields } from './action-form.config';
import { CreateActionDto } from './dto/create-action.dto';

@Injectable()
export class ActionsService {
  constructor(private readonly prisma: PrismaService) {}

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

  findAll(user: AuthenticatedUser, status?: string) {
    if (!user.academicYearId) return [];

    const parsedStatus = status && Object.values(ActionStatus).includes(status as ActionStatus)
      ? status as ActionStatus
      : undefined;

    return this.prisma.action.findMany({
      where: {
        academicYearId: user.academicYearId,
        ...(parsedStatus ? { status: parsedStatus } : {}),
        ...(!this.canManageAll(user)
          ? { networks: { some: { networkId: { in: user.coordinatorNetworkIds } } } }
          : {}),
      },
      include: {
        networks: { include: { network: true } },
        groups: { include: { teachingGroup: { include: { professionalFamily: true } } } },
        evidence: true,
        submittedBy: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async resubmit(id: string, dto: CreateActionDto, user: AuthenticatedUser) {
    if (!user.academicYearId) throw new BadRequestException('No existe un curso académico activo.');

    const current = await this.prisma.action.findFirst({
      where: {
        id,
        submittedById: user.id,
        academicYearId: user.academicYearId,
      },
    });
    if (!current) throw new NotFoundException('Actuación no encontrada.');
    if (current.status !== ActionStatus.RETURNED) {
      throw new BadRequestException('Solo pueden reenviarse actuaciones devueltas para corrección.');
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
        status: ActionStatus.PENDING_VALIDATION,
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

  async validateBatch(ids: string[], user: AuthenticatedUser) {
    const uniqueIds = [...new Set(ids)];
    for (const id of uniqueIds) {
      await this.assertCanManageAction(id, user);
    }

    const result = await this.prisma.action.updateMany({
      where: {
        id: { in: uniqueIds },
        status: ActionStatus.PENDING_VALIDATION,
      },
      data: {
        status: ActionStatus.VALIDATED,
        validatedAt: new Date(),
        validatedById: user.id,
        returnedAt: null,
        returnedReason: null,
      },
    });

    return { validated: result.count };
  }

  async validate(id: string, user: AuthenticatedUser) {
    await this.assertCanManageAction(id, user);
    return this.prisma.action.update({
      where: { id },
      data: {
        status: ActionStatus.VALIDATED,
        validatedAt: new Date(),
        validatedById: user.id,
        returnedAt: null,
        returnedReason: null,
      },
    });
  }

  async returnForCorrection(id: string, reason: string, user: AuthenticatedUser) {
    await this.assertCanManageAction(id, user);
    return this.prisma.action.update({
      where: { id },
      data: {
        status: ActionStatus.RETURNED,
        returnedAt: new Date(),
        returnedReason: reason.trim(),
        validatedById: user.id,
        validatedAt: null,
      },
    });
  }
}
