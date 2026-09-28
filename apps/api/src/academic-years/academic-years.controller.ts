import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SessionGuard } from '../auth/session.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AcademicYearsService } from './academic-years.service';
import { AssignCiclopeCoordinatorDto } from './dto/assign-ciclope-coordinator.dto';
import { AssignNetworkCoordinatorDto } from './dto/assign-network-coordinator.dto';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';

const YEAR_ADMIN = ['SUPERADMIN', 'ADMIN_CENTRO', 'DIRECCION'];

@Controller('academic-years')
@UseGuards(SessionGuard, RolesGuard)
export class AcademicYearsController {
  constructor(private readonly years: AcademicYearsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.years.list(user.centerId);
  }

  @Post()
  @Roles(...YEAR_ADMIN)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAcademicYearDto) {
    return this.years.create(user.centerId, dto);
  }

  @Patch(':id/activate')
  @Roles(...YEAR_ADMIN)
  activate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.years.activate(user.centerId, id);
  }

  @Patch(':id/close')
  @Roles(...YEAR_ADMIN)
  close(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.years.close(user.centerId, id);
  }

  @Post(':id/network-coordinators')
  @Roles(...YEAR_ADMIN)
  assignNetwork(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AssignNetworkCoordinatorDto,
  ) {
    return this.years.assignNetworkCoordinator(user, id, dto);
  }

  @Post(':id/ciclope-coordinators')
  @Roles(...YEAR_ADMIN)
  assignCiclope(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AssignCiclopeCoordinatorDto,
  ) {
    return this.years.assignCiclopeCoordinator(user, id, dto);
  }

  @Delete('network-coordinators/:assignmentId')
  @Roles(...YEAR_ADMIN)
  removeNetwork(
    @CurrentUser() user: AuthenticatedUser,
    @Param('assignmentId') assignmentId: string,
  ) {
    return this.years.removeNetworkCoordinator(user, assignmentId);
  }

  @Delete('ciclope-coordinators/:assignmentId')
  @Roles(...YEAR_ADMIN)
  removeCiclope(
    @CurrentUser() user: AuthenticatedUser,
    @Param('assignmentId') assignmentId: string,
  ) {
    return this.years.removeCiclopeCoordinator(user, assignmentId);
  }
}
