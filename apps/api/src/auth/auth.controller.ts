import { Body, Controller, Get, Headers, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ConfirmPasswordResetDto } from './dto/confirm-password-reset.dto';
import { SessionGuard } from './session.guard';
import type { AuthenticatedUser } from './auth.types';

function clientKey(request: Request) {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  if (Array.isArray(forwarded) && forwarded[0]) return forwarded[0];
  const realIp = request.headers['x-real-ip'];
  if (typeof realIp === 'string') return realIp;
  return request.ip || 'unknown';
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const user = await this.auth.verifyCredentials(dto.email, dto.password, clientKey(request));
    const session = await this.auth.createSession(user.id);
    response.setHeader('Set-Cookie', this.auth.cookie(session.token, session.expiresAt));
    return { success: true, mustChangePassword: user.mustChangePassword };
  }

  @UseGuards(SessionGuard)
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  @UseGuards(SessionGuard)
  @Post('change-password')
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.auth.changePassword(user.id, dto.currentPassword, dto.newPassword);
    response.setHeader('Set-Cookie', this.auth.cookie(session.token, session.expiresAt));
    return { success: true };
  }

  @Post('password-reset/request')
  requestPasswordReset(
    @Body() dto: RequestPasswordResetDto,
    @Req() request: Request,
  ) {
    return this.auth.requestPasswordReset(dto.email, clientKey(request));
  }

  @Post('password-reset/confirm')
  confirmPasswordReset(@Body() dto: ConfirmPasswordResetDto) {
    return this.auth.confirmPasswordReset(dto.token, dto.newPassword);
  }

  @Post('logout')
  async logout(
    @Headers('cookie') cookieHeader: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.destroySession(this.auth.readToken(cookieHeader));
    response.setHeader('Set-Cookie', this.auth.clearCookie());
    return { success: true };
  }
}
