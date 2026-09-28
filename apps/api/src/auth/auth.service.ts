import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async verifyCredentials(email: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: { email: email.toLowerCase().trim(), active: true },
      include: { roles: { include: { role: true } } },
    });

    if (!user?.passwordHash || !(await argon2.verify(user.passwordHash, password))) {
      throw new UnauthorizedException('Credenciales incorrectas.');
    }

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
