import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SessionGuard } from '../auth/session.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ActionsService } from './actions.service';
import { CreateActionDto } from './dto/create-action.dto';
import { ReturnActionDto } from './dto/return-action.dto';
import { ResubmitActionDto } from './dto/resubmit-action.dto';
import { ValidateActionsDto } from './dto/validate-actions.dto';

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

  @Get('form-config')
  formConfig() {
    return this.actions.formConfig();
  }

  @Get('mine')
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.actions.findMine(user);
  }

  @Get(':id')
  mineOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.actions.findMineOne(id, user);
  }

  @Get()
  @Roles(...COORDINATION_ROLES)
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
  ) {
    return this.actions.findAll(user, status);
  }

  @Patch('validate-batch')
  @Roles(...COORDINATION_ROLES)
  validateBatch(@Body() dto: ValidateActionsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.actions.validateBatch(dto.ids, user);
  }

  @Patch(':id/resubmit')
  resubmit(
    @Param('id') id: string,
    @Body() dto: ResubmitActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.actions.resubmit(id, dto, user, true);
  }

  @Patch(':id')
  updateBeforeValidation(
    @Param('id') id: string,
    @Body() dto: CreateActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.actions.resubmit(id, dto, user, false);
  }

  @Post(':id/duplicate')
  duplicate(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.actions.duplicate(id, user);
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
