import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ActionStatus } from '../generated/prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { CreateActionDto } from './dto/create-action.dto';

@Injectable()
export class ActionsService {
  constructor(private readonly prisma: PrismaService) {}

  private canManageAll(user: AuthenticatedUser) {
    return ['SUPERADMIN', 'ADMIN_CENTRO', 'DIRECCION', 'COORDINADOR_CICLOPE']
      .some((role) => user.roles.includes(role));
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
    const networkCount = await this.prisma.network.count({
      where: { id: { in: uniqueNetworkIds }, active: true },
    });
    if (networkCount !== uniqueNetworkIds.length) {
      throw new BadRequestException('Una o más redes seleccionadas no son válidas.');
    }

    return this.prisma.action.create({
      data: {
        title: dto.title.trim(),
        description: dto.description.trim(),
        type: dto.type,
        activityDate: new Date(dto.activityDate),
        durationMinutes: dto.durationMinutes,
        studentCount: dto.studentCount,
        submittedById: user.id,
        submittedByName: `${user.firstName} ${user.lastName}`.trim(),
        submittedByEmail: user.email,
        academicYearId: user.academicYearId,
        networks: { create: uniqueNetworkIds.map((networkId) => ({ networkId })) },
      },
      include: { networks: { include: { network: true } } },
    });
  }

  findMine(user: AuthenticatedUser) {
    return this.prisma.action.findMany({
      where: {
        submittedById: user.id,
        ...(user.academicYearId ? { academicYearId: user.academicYearId } : {}),
      },
      include: { networks: { include: { network: true } }, evidence: true },
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
        evidence: true,
        submittedBy: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
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
