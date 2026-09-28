import { Body, Controller, Get, Headers, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { SessionGuard } from './session.guard';
import type { AuthenticatedUser } from './auth.types';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const user = await this.auth.verifyCredentials(dto.email, dto.password);
    const session = await this.auth.createSession(user.id);
    response.setHeader('Set-Cookie', this.auth.cookie(session.token, session.expiresAt));
    return { success: true };
  }

  @UseGuards(SessionGuard)
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
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
