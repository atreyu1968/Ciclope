import { Body, Controller, Get, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from '../auth/auth.service';
import { InitializeDto } from './dto/initialize.dto';
import { SetupService } from './setup.service';

@Controller('setup')
export class SetupController {
  constructor(
    private readonly setup: SetupService,
    private readonly auth: AuthService,
  ) {}

  @Get('status')
  status() {
    return this.setup.status();
  }

  @Post('initialize')
  async initialize(
    @Body() dto: InitializeDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.setup.initialize(dto);
    response.setHeader('Set-Cookie', this.auth.cookie(result.session.token, result.session.expiresAt));

    return {
      center: result.center,
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        roles: result.user.roles.map((item) => item.role.key),
      },
    };
  }
}
