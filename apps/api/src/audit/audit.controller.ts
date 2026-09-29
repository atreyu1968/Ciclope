import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SessionGuard } from '../auth/session.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from './audit.service';

@Controller('audit')
@UseGuards(SessionGuard, RolesGuard)
@Roles('SUPERADMIN', 'ADMIN_CENTRO', 'DIRECCION')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.audit.list(user.centerId);
  }
}
