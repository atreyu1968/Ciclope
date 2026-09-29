import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SessionGuard } from '../auth/session.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { UpdateAiDto } from './dto/update-ai.dto';
import { UpdateResendDto } from './dto/update-resend.dto';
import { IntegrationsService } from './integrations.service';

@Controller('integrations')
@UseGuards(SessionGuard, RolesGuard)
@Roles('SUPERADMIN', 'ADMIN_CENTRO', 'DIRECCION')
export class IntegrationsController {
  constructor(private readonly integrations: IntegrationsService) {}

  @Get()
  settings(@CurrentUser() user: AuthenticatedUser) {
    return this.integrations.publicSettings(user.centerId);
  }

  @Patch('resend')
  updateResend(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateResendDto) {
    return this.integrations.updateResend(user.centerId, dto);
  }

  @Post('resend/test')
  testResend(@CurrentUser() user: AuthenticatedUser) {
    return this.integrations.testResend(user.centerId, user.email);
  }

  @Patch('ai')
  updateAi(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateAiDto) {
    return this.integrations.updateAi(user.centerId, dto);
  }

  @Post('ai/test')
  testAi(@CurrentUser() user: AuthenticatedUser) {
    return this.integrations.testAi(user.centerId);
  }
}
