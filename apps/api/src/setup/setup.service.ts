import { BadRequestException, Injectable } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../database/prisma.service';
import { InitializeDto } from './dto/initialize.dto';

@Injectable()
export class SetupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  async status() {
    const userCount = await this.prisma.user.count();
    return { initialized: userCount > 0 };
  }

  async initialize(dto: InitializeDto) {
    if (await this.prisma.user.count()) {
      throw new BadRequestException('La instalación ya está inicializada.');
    }

    const passwordHash = await this.auth.hashPassword(dto.password);
    const result = await this.prisma.$transaction(async (tx) => {
      const placeholder = await tx.center.findUnique({ where: { code: 'CONFIGURAR' } });
      const center = placeholder
        ? await tx.center.update({
            where: { id: placeholder.id },
            data: { name: dto.centerName.trim(), code: dto.centerCode.trim() },
          })
        : await tx.center.create({
            data: { name: dto.centerName.trim(), code: dto.centerCode.trim() },
          });

      const superadmin = await tx.role.findUniqueOrThrow({ where: { key: 'SUPERADMIN' } });
      const admin = await tx.role.findUniqueOrThrow({ where: { key: 'ADMIN_CENTRO' } });
      const professor = await tx.role.findUniqueOrThrow({ where: { key: 'PROFESOR_FP' } });

      const user = await tx.user.create({
        data: {
          centerId: center.id,
          email: dto.email.toLowerCase().trim(),
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          passwordHash,
          roles: {
            create: [
              { roleId: superadmin.id },
              { roleId: admin.id },
              { roleId: professor.id },
            ],
          },
        },
        include: { roles: { include: { role: true } } },
      });

      return { center, user };
    });

    const session = await this.auth.createSession(result.user.id);
    return { ...result, session };
  }
}
