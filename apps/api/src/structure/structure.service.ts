import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Shift } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CreateFamilyDto } from './dto/create-family.dto';
import { CreateGroupDto } from './dto/create-group.dto';

@Injectable()
export class StructureService {
  constructor(private readonly prisma: PrismaService) {}

  listFamilies(centerId: string) {
    return this.prisma.professionalFamily.findMany({
      where: { centerId, active: true },
      include: { _count: { select: { users: true, groups: true } } },
      orderBy: { name: 'asc' },
    });
  }

  createFamily(centerId: string, dto: CreateFamilyDto) {
    return this.prisma.professionalFamily.create({
      data: {
        centerId,
        name: dto.name.trim(),
        code: dto.code?.trim() || null,
      },
    });
  }

  async listGroups(user: AuthenticatedUser, academicYearId?: string) {
    const targetYearId = academicYearId ?? user.academicYearId;
    if (!targetYearId) return [];

    const year = await this.prisma.academicYear.findFirst({
      where: { id: targetYearId, centerId: user.centerId },
      select: { id: true },
    });
    if (!year) throw new NotFoundException('Curso académico no encontrado.');

    return this.prisma.teachingGroup.findMany({
      where: { academicYearId: targetYearId, active: true },
      include: { professionalFamily: true },
      orderBy: [{ professionalFamily: { name: 'asc' } }, { name: 'asc' }],
    });
  }

  async createGroup(user: AuthenticatedUser, dto: CreateGroupDto) {
    if (!user.academicYearId) {
      throw new BadRequestException('No existe un curso académico activo.');
    }
    const family = await this.prisma.professionalFamily.findFirst({
      where: { id: dto.professionalFamilyId, centerId: user.centerId, active: true },
    });
    if (!family) throw new BadRequestException('Familia profesional no válida.');

    return this.prisma.teachingGroup.create({
      data: {
        academicYearId: user.academicYearId,
        professionalFamilyId: family.id,
        name: dto.name.trim(),
        shift: dto.shift ?? Shift.UNSPECIFIED,
        studentCount: dto.studentCount,
      },
      include: { professionalFamily: true },
    });
  }
}
