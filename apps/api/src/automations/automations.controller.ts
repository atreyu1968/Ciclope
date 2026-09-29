import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SessionGuard } from '../auth/session.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AutomationsService } from './automations.service';

const COORDINATION_ROLES = [
  'SUPERADMIN',
  'ADMIN_CENTRO',
  'DIRECCION',
  'COORDINADOR_CICLOPE',
  'COORD_INNOVACION',
  'COORD_EMPRENDIMIENTO',
  'COORD_IOP',
  'COORD_CALIDAD',
];

@Controller('automations')
@UseGuards(SessionGuard, RolesGuard)
@Roles(...COORDINATION_ROLES)
export class AutomationsController {
  constructor(private readonly automations: AutomationsService) {}

  @Get('status')
  status(@CurrentUser() user: AuthenticatedUser) {
    return this.automations.status(user);
  }
}
