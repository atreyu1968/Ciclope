import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { AuthService } from '../auth/auth.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { ImportUsersDto } from './dto/import-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';

const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  shift: true,
  active: true,
  mustChangePassword: true,
  professionalFamilies: {
    include: { professionalFamily: true },
  },
  roles: {
    include: { role: true },
  },
  networkCoordinations: {
    where: { academicYear: { isActive: true } },
    include: { network: true },
  },
  ciclopeCoordinations: {
    where: { academicYear: { isActive: true } },
  },
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  list(centerId: string) {
    return this.prisma.user.findMany({
      where: { centerId },
      select: userSelect,
      orderBy: [{ active: 'desc' }, { lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  async create(actor: AuthenticatedUser, dto: CreateUserDto) {
    const email = dto.email.toLowerCase().trim();
    const exists = await this.prisma.user.findFirst({ where: { centerId: actor.centerId, email } });
    if (exists) throw new BadRequestException('Ya existe una cuenta con ese correo en el centro.');

    const temporaryPassword = dto.temporaryPassword ?? `Ciclope-${randomBytes(6).toString('hex')}A1!`;
    const passwordHash = await this.auth.hashPassword(temporaryPassword);
    const professorRole = await this.prisma.role.findUniqueOrThrow({ where: { key: 'PROFESOR_FP' } });

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          centerId: actor.centerId,
          email,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          passwordHash,
          mustChangePassword: true,
          roles: { create: [{ roleId: professorRole.id }] },
        },
        select: userSelect,
      });

      await tx.auditLog.create({
        data: {
          centerId: actor.centerId,
          actorId: actor.id,
          action: 'USER_CREATED',
          entityType: 'User',
          entityId: created.id,
          details: { email },
        },
      });
      return created;
    });

    return { user, temporaryPassword };
  }

  async update(actor: AuthenticatedUser, id: string, dto: UpdateUserDto) {
    const current = await this.prisma.user.findFirst({
      where: { id, centerId: actor.centerId },
      select: { id: true, email: true, active: true },
    });
    if (!current) throw new NotFoundException('Docente no encontrado.');

    if (id === actor.id && dto.active === false) {
      throw new BadRequestException('No puedes desactivar tu propia cuenta.');
    }

    const email = dto.email?.toLowerCase().trim();
    if (email && email !== current.email) {
      const duplicate = await this.prisma.user.findFirst({
        where: { centerId: actor.centerId, email, NOT: { id } },
        select: { id: true },
      });
      if (duplicate) throw new BadRequestException('Ya existe una cuenta con ese correo.');
    }

    if (dto.familyIds) {
      const count = await this.prisma.professionalFamily.count({
        where: { centerId: actor.centerId, id: { in: dto.familyIds }, active: true },
      });
      if (count !== new Set(dto.familyIds).size) {
        throw new BadRequestException('Alguna familia profesional seleccionada no es válida.');
      }
    }

    const data: Record<string, unknown> = {};
    if (dto.firstName !== undefined) data.firstName = dto.firstName.trim();
    if (dto.lastName !== undefined) data.lastName = dto.lastName.trim();
    if (email !== undefined) data.email = email;
    if (dto.shift !== undefined) data.shift = dto.shift;
    if (dto.active !== undefined) data.active = dto.active;

    return this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data });

      if (dto.familyIds) {
        const uniqueFamilyIds = [...new Set(dto.familyIds)];
        await tx.userProfessionalFamily.deleteMany({ where: { userId: id } });
        if (uniqueFamilyIds.length) {
          await tx.userProfessionalFamily.createMany({
            data: uniqueFamilyIds.map((professionalFamilyId) => ({
              userId: id,
              professionalFamilyId,
            })),
          });
        }
      }

      if (dto.active === false) {
        await tx.session.deleteMany({ where: { userId: id } });
      }

      await tx.auditLog.create({
        data: {
          centerId: actor.centerId,
          actorId: actor.id,
          action: dto.active === false
            ? 'USER_DEACTIVATED'
            : dto.active === true && !current.active
              ? 'USER_REACTIVATED'
              : 'USER_UPDATED',
          entityType: 'User',
          entityId: id,
          details: { fields: Object.keys(dto) },
        },
      });

      return tx.user.findUniqueOrThrow({ where: { id }, select: userSelect });
    });
  }

  async resetPassword(actor: AuthenticatedUser, id: string, dto: ResetUserPasswordDto) {
    const target = await this.prisma.user.findFirst({
      where: { id, centerId: actor.centerId },
      select: { id: true, email: true },
    });
    if (!target) throw new NotFoundException('Docente no encontrado.');

    const temporaryPassword = dto.temporaryPassword ?? `Ciclope-${randomBytes(6).toString('hex')}A1!`;
    const passwordHash = await this.auth.hashPassword(temporaryPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: { passwordHash, mustChangePassword: true },
      }),
      this.prisma.session.deleteMany({ where: { userId: id } }),
      this.prisma.auditLog.create({
        data: {
          centerId: actor.centerId,
          actorId: actor.id,
          action: 'USER_PASSWORD_RESET_BY_ADMIN',
          entityType: 'User',
          entityId: id,
          details: { email: target.email },
        },
      }),
    ]);

    return { success: true, temporaryPassword };
  }

  async previewImport(centerId: string, dto: ImportUsersDto) {
    const normalizedEmails = dto.rows.map((row) => row.email.toLowerCase().trim());
    const counts = new Map<string, number>();
    for (const email of normalizedEmails) counts.set(email, (counts.get(email) || 0) + 1);

    const [existingUsers, existingFamilies] = await Promise.all([
      this.prisma.user.findMany({
        where: { centerId, email: { in: [...new Set(normalizedEmails)] } },
        select: { id: true, email: true, active: true },
      }),
      this.prisma.professionalFamily.findMany({
        where: { centerId },
        select: { name: true },
      }),
    ]);

    const existingByEmail = new Map(existingUsers.map((user) => [user.email.toLowerCase(), user]));
    const familyNames = new Set(existingFamilies.map((family) => family.name.toLowerCase()));
    const familiesToCreate = new Set<string>();

    const rows = dto.rows.map((row, index) => {
      const email = row.email.toLowerCase().trim();
      const duplicateInFile = (counts.get(email) || 0) > 1;
      for (const family of row.families ?? []) {
        const clean = family.trim();
        if (clean && !familyNames.has(clean.toLowerCase())) familiesToCreate.add(clean);
      }

      return {
        row: index + 2,
        email,
        name: `${row.lastName.trim()}, ${row.firstName.trim()}`,
        action: duplicateInFile
          ? 'ERROR'
          : existingByEmail.has(email)
            ? 'UPDATE'
            : 'CREATE',
        activeAccountExists: existingByEmail.get(email)?.active ?? null,
        issues: duplicateInFile ? ['Correo duplicado dentro del archivo.'] : [],
      };
    });

    return {
      rows,
      summary: {
        create: rows.filter((row) => row.action === 'CREATE').length,
        update: rows.filter((row) => row.action === 'UPDATE').length,
        errors: rows.filter((row) => row.action === 'ERROR').length,
        familiesToCreate: [...familiesToCreate].sort((a, b) => a.localeCompare(b, 'es')),
      },
    };
  }

  async exportCsv(centerId: string) {
    const users = await this.prisma.user.findMany({
      where: { centerId },
      include: {
        professionalFamilies: {
          include: { professionalFamily: true },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    const escape = (value: unknown) => {
      const text = String(value ?? '');
      return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };

    const lines = [
      ['nombre', 'apellidos', 'email', 'turno', 'activo', 'familias'].join(';'),
      ...users.map((user) => [
        escape(user.firstName),
        escape(user.lastName),
        escape(user.email),
        escape(user.shift),
        user.active ? 'sí' : 'no',
        escape(user.professionalFamilies.map((item) => item.professionalFamily.name).join('|')),
      ].join(';')),
    ];
    return '\uFEFF' + lines.join('\r\n') + '\r\n';
  }

  async importMany(actor: AuthenticatedUser, dto: ImportUsersDto) {
    const professorRole = await this.prisma.role.findUniqueOrThrow({ where: { key: 'PROFESOR_FP' } });
    const result = {
      created: 0,
      updated: 0,
      familiesCreated: 0,
      errors: [] as Array<{ row: number; email: string; message: string }>,
      temporaryCredentials: [] as Array<{ email: string; password: string }>,
    };

    const emailCounts = new Map<string, number>();
    for (const row of dto.rows) {
      const normalized = row.email.toLowerCase().trim();
      emailCounts.set(normalized, (emailCounts.get(normalized) || 0) + 1);
    }

    for (let index = 0; index < dto.rows.length; index += 1) {
      const row = dto.rows[index];
      const email = row.email.toLowerCase().trim();

      if ((emailCounts.get(email) || 0) > 1) {
        result.errors.push({
          row: index + 2,
          email,
          message: 'Correo duplicado dentro del archivo. No se ha importado esta fila.',
        });
        continue;
      }

      try {
        const existing = await this.prisma.user.findFirst({ where: { centerId: actor.centerId, email } });
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
              centerId: actor.centerId,
              email,
              firstName: row.firstName.trim(),
              lastName: row.lastName.trim(),
              shift: row.shift,
              passwordHash,
              mustChangePassword: true,
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
            where: { centerId_name: { centerId: actor.centerId, name: familyName } },
          });

          if (!family) {
            family = await this.prisma.professionalFamily.create({
              data: { centerId: actor.centerId, name: familyName },
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

    await this.prisma.auditLog.create({
      data: {
        centerId: actor.centerId,
        actorId: actor.id,
        action: 'USERS_IMPORTED',
        entityType: 'User',
        details: {
          created: result.created,
          updated: result.updated,
          errors: result.errors.length,
        },
      },
    });

    return result;
  }
}
