import { BadRequestException, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../database/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  list(centerId: string) {
    return this.prisma.user.findMany({
      where: { centerId, active: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        networkCoordinations: {
          where: { academicYear: { isActive: true } },
          include: { network: true },
        },
        ciclopeCoordinations: {
          where: { academicYear: { isActive: true } },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  async create(centerId: string, dto: CreateUserDto) {
    const email = dto.email.toLowerCase().trim();
    const exists = await this.prisma.user.findFirst({ where: { centerId, email } });
    if (exists) throw new BadRequestException('Ya existe una cuenta con ese correo en el centro.');

    const temporaryPassword = dto.temporaryPassword ?? `Ciclope-${randomBytes(6).toString('hex')}A1!`;
    const passwordHash = await this.auth.hashPassword(temporaryPassword);
    const professorRole = await this.prisma.role.findUniqueOrThrow({ where: { key: 'PROFESOR_FP' } });

    const user = await this.prisma.user.create({
      data: {
        centerId,
        email,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        passwordHash,
        roles: { create: [{ roleId: professorRole.id }] },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    });

    return { user, temporaryPassword };
  }
}
