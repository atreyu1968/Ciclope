import { BadRequestException, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../database/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { ImportUsersDto } from './dto/import-users.dto';

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
        shift: true,
        professionalFamilies: {
          include: { professionalFamily: true },
        },
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
        shift: true,
      },
    });

    return { user, temporaryPassword };
  }

  async importMany(centerId: string, dto: ImportUsersDto) {
    const professorRole = await this.prisma.role.findUniqueOrThrow({ where: { key: 'PROFESOR_FP' } });
    const result = {
      created: 0,
      updated: 0,
      familiesCreated: 0,
      errors: [] as Array<{ row: number; email: string; message: string }>,
      temporaryCredentials: [] as Array<{ email: string; password: string }>,
    };

    for (let index = 0; index < dto.rows.length; index += 1) {
      const row = dto.rows[index];
      const email = row.email.toLowerCase().trim();

      try {
        const existing = await this.prisma.user.findFirst({ where: { centerId, email } });
        let userId: string;

        if (existing) {
          const updated = await this.prisma.user.update({
            where: { id: existing.id },
            data: {
              firstName: row.firstName.trim(),
              lastName: row.lastName.trim(),
              shift: row.shift ?? existing.shift,
              active: true,
            },
          });
          userId = updated.id;
          result.updated += 1;
        } else {
          const temporaryPassword = `Ciclope-${randomBytes(6).toString('hex')}A1!`;
          const passwordHash = await this.auth.hashPassword(temporaryPassword);
          const created = await this.prisma.user.create({
            data: {
              centerId,
              email,
              firstName: row.firstName.trim(),
              lastName: row.lastName.trim(),
              shift: row.shift,
              passwordHash,
            },
          });
          userId = created.id;
          result.created += 1;
          result.temporaryCredentials.push({ email, password: temporaryPassword });
        }

        await this.prisma.userRole.upsert({
          where: { userId_roleId: { userId, roleId: professorRole.id } },
          update: {},
          create: { userId, roleId: professorRole.id },
        });

        for (const rawFamilyName of row.families ?? []) {
          const familyName = rawFamilyName.trim();
          if (!familyName) continue;

          let family = await this.prisma.professionalFamily.findUnique({
            where: { centerId_name: { centerId, name: familyName } },
          });

          if (!family) {
            family = await this.prisma.professionalFamily.create({
              data: { centerId, name: familyName },
            });
            result.familiesCreated += 1;
          }

          await this.prisma.userProfessionalFamily.upsert({
            where: {
              userId_professionalFamilyId: {
                userId,
                professionalFamilyId: family.id,
              },
            },
            update: {},
            create: {
              userId,
              professionalFamilyId: family.id,
            },
          });
        }
      } catch (error) {
        result.errors.push({
          row: index + 2,
          email,
          message: error instanceof Error ? error.message : 'Error desconocido',
        });
      }
    }

    return result;
  }
}
