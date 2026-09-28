import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { AssignNetworkCoordinatorDto } from './dto/assign-network-coordinator.dto';
import { AssignCiclopeCoordinatorDto } from './dto/assign-ciclope-coordinator.dto';

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
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
          orderBy: [{ network: { sortOrder: 'asc' } }, { isPrimary: 'desc' }],
        },
        ciclopeCoordinators: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
          orderBy: { isPrimary: 'desc' },
        },
        _count: { select: { actions: true, communications: true } },
      },
      orderBy: { startsAt: 'desc' },
    });
  }

  async create(centerId: string, dto: CreateAcademicYearDto) {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (endsAt <= startsAt) throw new BadRequestException('La fecha de fin debe ser posterior a la fecha de inicio.');

    return this.prisma.academicYear.create({
      data: {
        centerId,
        name: dto.name,
        startsAt,
        endsAt,
        isActive: false,
      },
    });
  }

  async activate(centerId: string, id: string) {
    const year = await this.prisma.academicYear.findFirst({ where: { id, centerId } });
    if (!year) throw new NotFoundException('Curso académico no encontrado.');

    return this.prisma.$transaction(async (tx) => {
      await tx.academicYear.updateMany({
        where: { centerId, isActive: true },
        data: { isActive: false },
      });
      return tx.academicYear.update({
        where: { id },
        data: { isActive: true, closedAt: null },
      });
    });
  }

  async close(centerId: string, id: string) {
    const year = await this.prisma.academicYear.findFirst({ where: { id, centerId } });
    if (!year) throw new NotFoundException('Curso académico no encontrado.');

    return this.prisma.academicYear.update({
      where: { id },
      data: { isActive: false, closedAt: new Date() },
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
    if (!user) throw new BadRequestException('El usuario no pertenece al centro o está inactivo.');
    if (!network) throw new BadRequestException('La red seleccionada no existe o está inactiva.');

    return this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary !== false) {
        await tx.networkCoordinator.updateMany({
          where: { academicYearId, networkId: dto.networkId },
          data: { isPrimary: false },
        });
      }

      return tx.networkCoordinator.upsert({
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
    if (!user) throw new BadRequestException('El usuario no pertenece al centro o está inactivo.');

    return this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary !== false) {
        await tx.ciclopeCoordinator.updateMany({
          where: { academicYearId },
          data: { isPrimary: false },
        });
      }

      return tx.ciclopeCoordinator.upsert({
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
    await this.prisma.networkCoordinator.delete({ where: { id: assignmentId } });
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
    await this.prisma.ciclopeCoordinator.delete({ where: { id: assignmentId } });
    return { success: true };
  }
}
