import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SessionGuard } from '../auth/session.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ActionsService } from './actions.service';
import { CreateActionDto } from './dto/create-action.dto';
import { ReturnActionDto } from './dto/return-action.dto';

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

@Controller('actions')
@UseGuards(SessionGuard, RolesGuard)
export class ActionsController {
  constructor(private readonly actions: ActionsService) {}

  @Post()
  create(@Body() dto: CreateActionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.actions.create(dto, user);
  }

  @Get('mine')
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.actions.findMine(user);
  }

  @Get()
  @Roles(...COORDINATION_ROLES)
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
  ) {
    return this.actions.findAll(user, status);
  }

  @Patch(':id/validate')
  @Roles(...COORDINATION_ROLES)
  validate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.actions.validate(id, user);
  }

  @Patch(':id/return')
  @Roles(...COORDINATION_ROLES)
  returnForCorrection(
    @Param('id') id: string,
    @Body() dto: ReturnActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.actions.returnForCorrection(id, dto.reason, user);
  }
}
