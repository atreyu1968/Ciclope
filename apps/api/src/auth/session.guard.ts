import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { AuthenticatedRequest } from './auth.types';

function readCookie(cookieHeader: string | undefined, name: string) {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

const NETWORK_ROLE: Record<string, string> = {
  INNOVATION: 'COORD_INNOVACION',
  ENTREPRENEURSHIP: 'COORD_EMPRENDIMIENTO',
  GUIDANCE: 'COORD_IOP',
  QUALITY: 'COORD_CALIDAD',
};

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest & { headers: { cookie?: string }; originalUrl?: string }>();
    const token = readCookie(request.headers.cookie, 'ciclope_session');
    if (!token) throw new UnauthorizedException('Sesión no iniciada.');

    const tokenHash = createHash('sha256').update(token).digest('hex');
    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            roles: { include: { role: true } },
            center: {
              include: {
                academicYears: {
                  where: { isActive: true },
                  orderBy: { startsAt: 'desc' },
                  take: 1,
                },
              },
            },
            networkCoordinations: {
              where: { academicYear: { isActive: true } },
              include: { network: true },
            },
            ciclopeCoordinations: {
              where: { academicYear: { isActive: true } },
            },
          },
        },
      },
    });

    if (!session || session.expiresAt <= new Date() || !session.user.active) {
      if (session) await this.prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
      throw new UnauthorizedException('La sesión ha caducado.');
    }

    const activeYear = session.user.center.academicYears[0];
    const roleSet = new Set(session.user.roles.map((item) => item.role.key));

    for (const assignment of session.user.networkCoordinations) {
      const role = NETWORK_ROLE[assignment.network.code];
      if (role) roleSet.add(role);
    }
    if (session.user.ciclopeCoordinations.length) {
      roleSet.add('COORDINADOR_CICLOPE');
    }

    request.user = {
      id: session.user.id,
      centerId: session.user.centerId,
      email: session.user.email,
      firstName: session.user.firstName,
      lastName: session.user.lastName,
      roles: [...roleSet],
      mustChangePassword: session.user.mustChangePassword,
      academicYearId: activeYear?.id,
      academicYearName: activeYear?.name,
      centerName: session.user.center.name,
      coordinatorNetworkIds: session.user.networkCoordinations.map((item) => item.networkId),
      coordinatorNetworkCodes: session.user.networkCoordinations.map((item) => item.network.code),
    };

    if (session.user.mustChangePassword) {
      const path = (request.originalUrl || '').split('?')[0];
      const allowed = new Set([
        '/api/auth/me',
        '/api/auth/change-password',
        '/api/auth/logout',
      ]);
      if (!allowed.has(path)) {
        throw new ForbiddenException('Debes cambiar la contraseña temporal antes de continuar.');
      }
    }

    return true;
  }
}
