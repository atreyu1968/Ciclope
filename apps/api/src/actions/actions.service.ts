import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ActionStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateActionDto } from './dto/create-action.dto';

@Injectable()
export class ActionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateActionDto) {
    const academicYear = await this.prisma.academicYear.findFirst({
      where: { isActive: true },
      select: { id: true },
    });
    if (!academicYear) throw new BadRequestException('No existe un curso académico activo.');

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
        submittedByName: dto.submittedByName.trim(),
        submittedByEmail: dto.submittedByEmail.toLowerCase().trim(),
        academicYearId: academicYear.id,
        networks: { create: uniqueNetworkIds.map((networkId) => ({ networkId })) },
      },
      include: { networks: { include: { network: true } } },
    });
  }

  findAll(status?: string) {
    const parsedStatus = status && Object.values(ActionStatus).includes(status as ActionStatus)
      ? status as ActionStatus
      : undefined;

    return this.prisma.action.findMany({
      where: parsedStatus ? { status: parsedStatus } : undefined,
      include: { networks: { include: { network: true } }, evidence: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async validate(id: string) {
    const action = await this.prisma.action.findUnique({ where: { id } });
    if (!action) throw new NotFoundException('Actuación no encontrada.');

    return this.prisma.action.update({
      where: { id },
      data: { status: ActionStatus.VALIDATED, validatedAt: new Date() },
    });
  }
}
