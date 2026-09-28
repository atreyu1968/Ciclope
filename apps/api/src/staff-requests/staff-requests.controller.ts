import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { StaffRequestStatus } from '../generated/prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SessionGuard } from '../auth/session.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AddStaffRequestMessageDto } from './dto/add-staff-request-message.dto';
import { CreateStaffRequestDto } from './dto/create-staff-request.dto';
import { UpdateStaffRequestStatusDto } from './dto/update-staff-request-status.dto';
import { StaffRequestsService } from './staff-requests.service';

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

@Controller('staff-requests')
@UseGuards(SessionGuard, RolesGuard)
export class StaffRequestsController {
  constructor(private readonly requests: StaffRequestsService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateStaffRequestDto) {
    return this.requests.create(user, dto);
  }

  @Get('mine')
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.requests.mine(user);
  }

  @Get('coordination')
  @Roles(...COORDINATION_ROLES)
  coordination(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: StaffRequestStatus,
  ) {
    return this.requests.coordinationInbox(user, status);
  }

  @Get(':id')
  detail(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.requests.detail(id, user);
  }

  @Post(':id/messages')
  addMessage(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddStaffRequestMessageDto,
  ) {
    return this.requests.addMessage(id, user, dto.body);
  }

  @Patch(':id/status')
  @Roles(...COORDINATION_ROLES)
  status(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateStaffRequestStatusDto,
  ) {
    return this.requests.updateStatus(id, user, dto.status);
  }
}
