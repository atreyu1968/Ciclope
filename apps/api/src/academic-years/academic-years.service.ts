import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ActionStatus,
  AnnualPlanStatus,
  CommunicationStatus,
  PlanTaskStatus,
} from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { AssignNetworkCoordinatorDto } from './dto/assign-network-coordinator.dto';
import { AssignCiclopeCoordinatorDto } from './dto/assign-ciclope-coordinator.dto';
import { RolloverAcademicYearDto } from './dto/rollover-academic-year.dto';

@Injectable()
export class AcademicYearsService {
  constructor(private readonly prisma: PrismaService) {}

  list(centerId: string) {
    return this.prisma.academicYear.findMany({
      where: { centerId },
      include: {
        networkCoordinators: {
          include: {
            network: true,
            user: { select: { id: true, firstName: true, lastName: true, email: true, active: true } },
          },
          orderBy: [{ network: { sortOrder: 'asc' } }, { isPrimary: 'desc' }],
        },
        ciclopeCoordinators: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true, active: true } },
          },
          orderBy: { isPrimary: 'desc' },
        },
        _count: { select: { actions: true, communications: true, groups: true } },
      },
      orderBy: { startsAt: 'desc' },
    });
  }

  private validateDates(dto: { startsAt: string; endsAt: string }) {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (endsAt <= startsAt) {
      throw new BadRequestException('La fecha de fin debe ser posterior a la fecha de inicio.');
    }
    return { startsAt, endsAt };
  }

  async create(actor: AuthenticatedUser, dto: CreateAcademicYearDto) {
    const { startsAt, endsAt } = this.validateDates(dto);

    return this.prisma.$transaction(async (tx) => {
      const year = await tx.academicYear.create({
        data: {
          centerId: actor.centerId,
          name: dto.name,
          startsAt,
          endsAt,
          isActive: false,
        },
      });
      await tx.auditLog.create({
        data: {
          centerId: actor.centerId,
          actorId: actor.id,
          action: 'ACADEMIC_YEAR_CREATED',
          entityType: 'AcademicYear',
          entityId: year.id,
          details: { name: year.name },
        },
      });
      return year;
    });
  }

  async activationReadiness(actor: AuthenticatedUser, id: string) {
    const year = await this.prisma.academicYear.findFirst({
      where: { id, centerId: actor.centerId },
      select: { id: true, name: true, isActive: true, closedAt: true },
    });
    if (!year) throw new NotFoundException('Curso académico no encontrado.');

    const networks = await this.prisma.network.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { sortOrder: 'asc' },
    });
    const assignments = await this.prisma.networkCoordinator.findMany({
      where: {
        academicYearId: id,
        networkId: { in: networks.map((network) => network.id) },
        user: { active: true },
      },
      select: { networkId: true },
    });
    const covered = new Set(assignments.map((assignment) => assignment.networkId));
    const missingNetworks = networks.filter((network) => !covered.has(network.id)).map((network) => network.name);
    const ciclopeCount = await this.prisma.ciclopeCoordinator.count({
      where: { academicYearId: id, user: { active: true } },
    });

    return {
      year,
      ready: !year.closedAt && missingNetworks.length === 0 && ciclopeCount > 0,
      missingNetworks,
      missingCiclope: ciclopeCount === 0,
    };
  }

  async activate(actor: AuthenticatedUser, id: string) {
    const readiness = await this.activationReadiness(actor, id);
    if (readiness.year.closedAt) {
      throw new BadRequestException('Un curso cerrado no puede reactivarse desde el flujo ordinario.');
    }
    if (readiness.year.isActive) return readiness.year;
    if (!readiness.ready) {
      const problems = [
        readiness.missingNetworks.length ? `redes sin coordinación: ${readiness.missingNetworks.join(', ')}` : '',
        readiness.missingCiclope ? 'falta coordinación CÍCLOPE' : '',
      ].filter(Boolean);
      throw new BadRequestException(`El curso aún no tiene la configuración mínima: ${problems.join('; ')}.`);
    }

    const otherActive = await this.prisma.academicYear.findFirst({
      where: { centerId: actor.centerId, isActive: true, NOT: { id } },
      select: { id: true, name: true },
    });
    if (otherActive) {
      throw new BadRequestException(`Antes de activar este curso debes cerrar el curso activo ${otherActive.name}.`);
    }

    return this.prisma.$transaction(async (tx) => {
      const year = await tx.academicYear.update({
        where: { id },
        data: { isActive: true },
      });
      await tx.auditLog.create({
        data: {
          centerId: actor.centerId,
          actorId: actor.id,
          action: 'ACADEMIC_YEAR_ACTIVATED',
          entityType: 'AcademicYear',
          entityId: id,
          details: { name: year.name },
        },
      });
      return year;
    });
  }

  async closeCheck(actor: AuthenticatedUser, id: string) {
    const year = await this.prisma.academicYear.findFirst({
      where: { id, centerId: actor.centerId },
      select: { id: true, name: true, isActive: true, closedAt: true },
    });
    if (!year) throw new NotFoundException('Curso académico no encontrado.');

    const [pendingActions, draftCommunications, openTasks] = await Promise.all([
      this.prisma.action.count({
        where: {
          academicYearId: id,
          status: {
            in: [ActionStatus.DRAFT, ActionStatus.PENDING_VALIDATION, ActionStatus.RETURNED],
          },
        },
      }),
      this.prisma.communication.count({
        where: { academicYearId: id, status: CommunicationStatus.DRAFT },
      }),
      this.prisma.planTask.count({
        where: {
          plan: { academicYearId: id },
          status: { notIn: [PlanTaskStatus.DONE, PlanTaskStatus.CANCELLED] },
        },
      }),
    ]);

    return {
      year,
      canClose: pendingActions === 0 && draftCommunications === 0,
      blockers: {
        pendingActions,
        draftCommunications,
      },
      warnings: {
        openTasks,
      },
    };
  }

  async close(actor: AuthenticatedUser, id: string) {
    const check = await this.closeCheck(actor, id);
    if (check.year.closedAt) throw new BadRequestException('El curso ya está cerrado.');
    if (!check.canClose) {
      throw new BadRequestException(
        `No se puede cerrar: quedan ${check.blockers.pendingActions} actuaciones pendientes/devueltas y ${check.blockers.draftCommunications} comunicaciones en borrador.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.annualPlan.updateMany({
        where: { academicYearId: id, status: { not: AnnualPlanStatus.CLOSED } },
        data: { status: AnnualPlanStatus.CLOSED },
      });
      const year = await tx.academicYear.update({
        where: { id },
        data: { isActive: false, closedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          centerId: actor.centerId,
          actorId: actor.id,
          action: 'ACADEMIC_YEAR_CLOSED',
          entityType: 'AcademicYear',
          entityId: id,
          details: {
            name: year.name,
            openTasksAtClose: check.warnings.openTasks,
          },
        },
      });
      return year;
    });
  }

  async rollover(actor: AuthenticatedUser, sourceId: string, dto: RolloverAcademicYearDto) {
    const source = await this.prisma.academicYear.findFirst({
      where: { id: sourceId, centerId: actor.centerId },
      include: {
        groups: { where: { active: true } },
        networkCoordinators: {
          where: { user: { active: true } },
        },
        ciclopeCoordinators: {
          where: { user: { active: true } },
        },
      },
    });
    if (!source) throw new NotFoundException('Curso de origen no encontrado.');

    const { startsAt, endsAt } = this.validateDates(dto);
    const exists = await this.prisma.academicYear.findFirst({
      where: { centerId: actor.centerId, name: dto.name },
      select: { id: true },
    });
    if (exists) throw new BadRequestException('Ya existe un curso académico con ese nombre.');

    return this.prisma.$transaction(async (tx) => {
      const year = await tx.academicYear.create({
        data: {
          centerId: actor.centerId,
          name: dto.name,
          startsAt,
          endsAt,
          isActive: false,
        },
      });

      if (dto.copyGroups !== false && source.groups.length) {
        await tx.teachingGroup.createMany({
          data: source.groups.map((group) => ({
            academicYearId: year.id,
            professionalFamilyId: group.professionalFamilyId,
            name: group.name,
            shift: group.shift,
            studentCount: null,
            active: true,
          })),
        });
      }

      if (dto.copyCoordinators !== false) {
        if (source.networkCoordinators.length) {
          await tx.networkCoordinator.createMany({
            data: source.networkCoordinators.map((assignment) => ({
              academicYearId: year.id,
              networkId: assignment.networkId,
              userId: assignment.userId,
              isPrimary: assignment.isPrimary,
            })),
          });
        }
        if (source.ciclopeCoordinators.length) {
          await tx.ciclopeCoordinator.createMany({
            data: source.ciclopeCoordinators.map((assignment) => ({
              academicYearId: year.id,
              userId: assignment.userId,
              isPrimary: assignment.isPrimary,
            })),
          });
        }
      }

      await tx.auditLog.create({
        data: {
          centerId: actor.centerId,
          actorId: actor.id,
          action: 'ACADEMIC_YEAR_ROLLOVER_CREATED',
          entityType: 'AcademicYear',
          entityId: year.id,
          details: {
            sourceYearId: source.id,
            sourceYearName: source.name,
            copiedGroups: dto.copyGroups !== false ? source.groups.length : 0,
            copiedNetworkCoordinators: dto.copyCoordinators !== false ? source.networkCoordinators.length : 0,
            copiedCiclopeCoordinators: dto.copyCoordinators !== false ? source.ciclopeCoordinators.length : 0,
          },
        },
      });

      return year;
    });
  }

  async assignNetworkCoordinator(
    actor: AuthenticatedUser,
    academicYearId: string,
    dto: AssignNetworkCoordinatorDto,
  ) {
    const [year, user, network] = await Promise.all([
      this.prisma.academicYear.findFirst({ where: { id: academicYearId, centerId: actor.centerId } }),
      this.prisma.user.findFirst({ where: { id: dto.userId, centerId: actor.centerId, active: true } }),
      this.prisma.network.findFirst({ where: { id: dto.networkId, active: true } }),
    ]);
    if (!year) throw new NotFoundException('Curso académico no encontrado.');
    if (year.closedAt) throw new BadRequestException('No se puede modificar la coordinación de un curso cerrado.');
    if (!user) throw new BadRequestException('El usuario no pertenece al centro o está inactivo.');
    if (!network) throw new BadRequestException('La red seleccionada no existe o está inactiva.');

    return this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary !== false) {
        await tx.networkCoordinator.updateMany({
          where: { academicYearId, networkId: dto.networkId },
          data: { isPrimary: false },
        });
      }

      const assignment = await tx.networkCoordinator.upsert({
        where: {
          academicYearId_networkId_userId: {
            academicYearId,
            networkId: dto.networkId,
            userId: dto.userId,
          },
        },
        update: { isPrimary: dto.isPrimary !== false },
        create: {
          academicYearId,
          networkId: dto.networkId,
          userId: dto.userId,
          isPrimary: dto.isPrimary !== false,
        },
        include: {
          network: true,
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          centerId: actor.centerId,
          actorId: actor.id,
          action: 'NETWORK_COORDINATOR_ASSIGNED',
          entityType: 'AcademicYear',
          entityId: academicYearId,
          details: { networkId: dto.networkId, userId: dto.userId },
        },
      });
      return assignment;
    });
  }

  async assignCiclopeCoordinator(
    actor: AuthenticatedUser,
    academicYearId: string,
    dto: AssignCiclopeCoordinatorDto,
  ) {
    const [year, user] = await Promise.all([
      this.prisma.academicYear.findFirst({ where: { id: academicYearId, centerId: actor.centerId } }),
      this.prisma.user.findFirst({ where: { id: dto.userId, centerId: actor.centerId, active: true } }),
    ]);
    if (!year) throw new NotFoundException('Curso académico no encontrado.');
    if (year.closedAt) throw new BadRequestException('No se puede modificar la coordinación de un curso cerrado.');
    if (!user) throw new BadRequestException('El usuario no pertenece al centro o está inactivo.');

    return this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary !== false) {
        await tx.ciclopeCoordinator.updateMany({
          where: { academicYearId },
          data: { isPrimary: false },
        });
      }

      const assignment = await tx.ciclopeCoordinator.upsert({
        where: {
          academicYearId_userId: {
            academicYearId,
            userId: dto.userId,
          },
        },
        update: { isPrimary: dto.isPrimary !== false },
        create: {
          academicYearId,
          userId: dto.userId,
          isPrimary: dto.isPrimary !== false,
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          centerId: actor.centerId,
          actorId: actor.id,
          action: 'CICLOPE_COORDINATOR_ASSIGNED',
          entityType: 'AcademicYear',
          entityId: academicYearId,
          details: { userId: dto.userId },
        },
      });
      return assignment;
    });
  }

  async removeNetworkCoordinator(actor: AuthenticatedUser, assignmentId: string) {
    const assignment = await this.prisma.networkCoordinator.findUnique({
      where: { id: assignmentId },
      include: { academicYear: true },
    });
    if (!assignment || assignment.academicYear.centerId !== actor.centerId) {
      throw new NotFoundException('Asignación no encontrada.');
    }
    if (assignment.academicYear.closedAt) {
      throw new BadRequestException('No se puede modificar un curso cerrado.');
    }

    await this.prisma.$transaction([
      this.prisma.networkCoordinator.delete({ where: { id: assignmentId } }),
      this.prisma.auditLog.create({
        data: {
          centerId: actor.centerId,
          actorId: actor.id,
          action: 'NETWORK_COORDINATOR_REMOVED',
          entityType: 'AcademicYear',
          entityId: assignment.academicYearId,
          details: { networkId: assignment.networkId, userId: assignment.userId },
        },
      }),
    ]);
    return { success: true };
  }

  async removeCiclopeCoordinator(actor: AuthenticatedUser, assignmentId: string) {
    const assignment = await this.prisma.ciclopeCoordinator.findUnique({
      where: { id: assignmentId },
      include: { academicYear: true },
    });
    if (!assignment || assignment.academicYear.centerId !== actor.centerId) {
      throw new NotFoundException('Asignación no encontrada.');
    }
    if (assignment.academicYear.closedAt) {
      throw new BadRequestException('No se puede modificar un curso cerrado.');
    }

    await this.prisma.$transaction([
      this.prisma.ciclopeCoordinator.delete({ where: { id: assignmentId } }),
      this.prisma.auditLog.create({
        data: {
          centerId: actor.centerId,
          actorId: actor.id,
          action: 'CICLOPE_COORDINATOR_REMOVED',
          entityType: 'AcademicYear',
          entityId: assignment.academicYearId,
          details: { userId: assignment.userId },
        },
      }),
    ]);
    return { success: true };
  }
}
