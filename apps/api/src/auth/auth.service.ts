import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';

type LoginAttempt = {
  failures: number;
  windowStartedAt: number;
  blockedUntil?: number;
};

@Injectable()
export class AuthService {
  private readonly loginAttempts = new Map<string, LoginAttempt>();
  private readonly loginWindowMs = 15 * 60 * 1000;
  private readonly loginMaxFailures = 5;

  constructor(private readonly prisma: PrismaService) {}

  private rateKey(email: string, clientKey?: string) {
    return `${clientKey || 'unknown'}|${email.toLowerCase().trim()}`;
  }

  private assertLoginAllowed(key: string) {
    const now = Date.now();
    const state = this.loginAttempts.get(key);
    if (!state) return;

    if (state.blockedUntil && state.blockedUntil > now) {
      throw new HttpException(
        'Demasiados intentos de acceso. Inténtalo de nuevo más tarde.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (now - state.windowStartedAt > this.loginWindowMs) {
      this.loginAttempts.delete(key);
    }
  }

  private recordLoginFailure(key: string) {
    const now = Date.now();
    const current = this.loginAttempts.get(key);

    if (!current || now - current.windowStartedAt > this.loginWindowMs) {
      this.loginAttempts.set(key, { failures: 1, windowStartedAt: now });
      return;
    }

    current.failures += 1;
    if (current.failures >= this.loginMaxFailures) {
      current.blockedUntil = now + this.loginWindowMs;
    }
    this.loginAttempts.set(key, current);
  }

  private clearLoginFailures(key: string) {
    this.loginAttempts.delete(key);
  }

  async verifyCredentials(email: string, password: string, clientKey?: string) {
    const key = this.rateKey(email, clientKey);
    this.assertLoginAllowed(key);

    const user = await this.prisma.user.findFirst({
      where: { email: email.toLowerCase().trim(), active: true },
      include: { roles: { include: { role: true } } },
    });

    if (!user?.passwordHash || !(await argon2.verify(user.passwordHash, password))) {
      this.recordLoginFailure(key);
      throw new UnauthorizedException('Credenciales incorrectas.');
    }

    this.clearLoginFailures(key);
    return user;
  }

  async hashPassword(password: string) {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  async createSession(userId: string) {
    const token = randomBytes(48).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await this.prisma.session.create({
      data: { userId, tokenHash, expiresAt },
    });

    return { token, expiresAt };
  }

  async destroySession(token?: string) {
    if (!token) return;
    const tokenHash = createHash('sha256').update(token).digest('hex');
    await this.prisma.session.deleteMany({ where: { tokenHash } });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        centerId: true,
        passwordHash: true,
      },
    });

    if (!user?.passwordHash || !(await argon2.verify(user.passwordHash, currentPassword))) {
      throw new BadRequestException('La contraseña actual no es correcta.');
    }

    if (await argon2.verify(user.passwordHash, newPassword)) {
      throw new BadRequestException('La nueva contraseña debe ser diferente de la actual.');
    }

    const passwordHash = await this.hashPassword(newPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash, mustChangePassword: false },
      }),
      this.prisma.session.deleteMany({ where: { userId: user.id } }),
      this.prisma.auditLog.create({
        data: {
          centerId: user.centerId,
          actorId: user.id,
          action: 'PASSWORD_CHANGED',
          entityType: 'User',
          entityId: user.id,
        },
      }),
    ]);

    return this.createSession(user.id);
  }

  async requestPasswordReset(email: string) {
    const normalized = email.toLowerCase().trim();
    const user = await this.prisma.user.findFirst({
      where: { email: normalized, active: true },
      select: {
        id: true,
        centerId: true,
        email: true,
        firstName: true,
        center: {
          select: {
            integrationSettings: {
              select: {
                resendEnabled: true,
                resendApiKeyEncrypted: true,
                resendFromEmail: true,
              },
            },
          },
        },
      },
    });

    // Respuesta deliberadamente neutra para no revelar si una cuenta existe.
    if (!user) return { success: true };

    const rawToken = randomBytes(48).toString('base64url');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    const appUrl = process.env.APP_BASE_URL?.replace(/\/$/, '');
    const resend = user.center.integrationSettings;
    const mailConfigured = Boolean(
      resend?.resendEnabled &&
      resend?.resendApiKeyEncrypted &&
      resend?.resendFromEmail &&
      appUrl,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.deleteMany({
        where: { userId: user.id, usedAt: null },
      });

      await tx.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt },
      });

      await tx.auditLog.create({
        data: {
          centerId: user.centerId,
          actorId: user.id,
          action: 'PASSWORD_RESET_REQUESTED',
          entityType: 'User',
          entityId: user.id,
        },
      });

      if (mailConfigured && appUrl) {
        const resetUrl = `${appUrl}/restablecer-contrasena?token=${encodeURIComponent(rawToken)}`;
        await tx.emailOutbox.create({
          data: {
            userId: user.id,
            recipientEmail: user.email,
            subject: '[CÍCLOPE FP] Restablecimiento de contraseña',
            textBody: [
              `Hola ${user.firstName},`,
              '',
              'Se ha solicitado restablecer la contraseña de tu cuenta de CÍCLOPE FP.',
              'El enlace es válido durante 60 minutos y solo puede utilizarse una vez:',
              resetUrl,
              '',
              'Si no has solicitado este cambio, puedes ignorar este mensaje.',
            ].join('\n'),
          },
        });
      }
    });

    return { success: true };
  }

  async confirmPasswordReset(token: string, newPassword: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, centerId: true, active: true } } },
    });

    if (!record || record.usedAt || record.expiresAt <= new Date() || !record.user.active) {
      throw new BadRequestException('El enlace de restablecimiento no es válido o ha caducado.');
    }

    const passwordHash = await this.hashPassword(newPassword);
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.passwordResetToken.updateMany({
        where: { id: record.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (!claimed.count) {
        throw new BadRequestException('El enlace de restablecimiento ya no está disponible.');
      }

      await tx.user.update({
        where: { id: record.user.id },
        data: { passwordHash, mustChangePassword: false },
      });
      await tx.session.deleteMany({ where: { userId: record.user.id } });
      await tx.auditLog.create({
        data: {
          centerId: record.user.centerId,
          actorId: record.user.id,
          action: 'PASSWORD_RESET_COMPLETED',
          entityType: 'User',
          entityId: record.user.id,
        },
      });
    });

    return { success: true };
  }

  cookie(token: string, expiresAt: Date) {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    return `ciclope_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Expires=${expiresAt.toUTCString()}${secure}`;
  }

  clearCookie() {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    return `ciclope_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
  }

  readToken(cookieHeader?: string) {
    if (!cookieHeader) return undefined;
    for (const part of cookieHeader.split(';')) {
      const [key, ...rest] = part.trim().split('=');
      if (key === 'ciclope_session') return decodeURIComponent(rest.join('='));
    }
    return undefined;
  }
}
