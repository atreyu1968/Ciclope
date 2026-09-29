import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SessionGuard } from '../auth/session.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { CreateObjectiveDto } from './dto/create-objective.dto';
import { CreatePlanDto } from './dto/create-plan.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateObjectiveStatusDto } from './dto/update-objective-status.dto';
import { UpdatePlanStatusDto } from './dto/update-plan-status.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { PostponeTaskDto } from './dto/postpone-task.dto';
import { PlansService } from './plans.service';

const PLAN_ROLES = [
  'SUPERADMIN',
  'ADMIN_CENTRO',
  'DIRECCION',
  'COORDINADOR_CICLOPE',
  'COORD_INNOVACION',
  'COORD_EMPRENDIMIENTO',
  'COORD_IOP',
  'COORD_CALIDAD',
];

@Controller('plans')
@UseGuards(SessionGuard, RolesGuard)
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @Get('available-objectives')
  availableObjectives(@CurrentUser() user: AuthenticatedUser) {
    return this.plans.availableObjectives(user);
  }

  @Get('milestones')
  @Roles(...PLAN_ROLES)
  milestones(
    @CurrentUser() user: AuthenticatedUser,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.plans.listMilestones(user, academicYearId);
  }

  @Post('milestones')
  @Roles('SUPERADMIN', 'ADMIN_CENTRO', 'DIRECCION', 'COORDINADOR_CICLOPE')
  createMilestone(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateMilestoneDto,
  ) {
    return this.plans.createMilestone(user, dto);
  }

  @Get()
  @Roles(...PLAN_ROLES)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.plans.list(user, academicYearId);
  }

  @Post()
  @Roles(...PLAN_ROLES)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePlanDto) {
    return this.plans.create(user, dto);
  }

  @Get(':id')
  @Roles(...PLAN_ROLES)
  detail(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.plans.detail(user, id);
  }

  @Patch(':id/status')
  @Roles(...PLAN_ROLES)
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdatePlanStatusDto,
  ) {
    return this.plans.updatePlanStatus(user, id, dto.status);
  }

  @Post(':id/objectives')
  @Roles(...PLAN_ROLES)
  createObjective(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateObjectiveDto,
  ) {
    return this.plans.createObjective(user, id, dto);
  }

  @Post(':id/tasks')
  @Roles(...PLAN_ROLES)
  createTask(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateTaskDto,
  ) {
    return this.plans.createTask(user, id, dto);
  }

  @Patch('objective/:id/status')
  @Roles(...PLAN_ROLES)
  updateObjectiveStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateObjectiveStatusDto,
  ) {
    return this.plans.updateObjectiveStatus(user, id, dto.status);
  }

  @Patch('task/:id/status')
  @Roles(...PLAN_ROLES)
  updateTaskStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateTaskStatusDto,
  ) {
    return this.plans.updateTaskStatus(user, id, dto.status);
  }

  @Patch('task/:id/postpone')
  @Roles(...PLAN_ROLES)
  postponeTask(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: PostponeTaskDto,
  ) {
    return this.plans.postponeTask(user, id, dto.days);
  }
}
