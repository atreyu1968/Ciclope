import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SessionGuard } from '../auth/session.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CreateFamilyDto } from './dto/create-family.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { StructureService } from './structure.service';

const ADMIN = ['SUPERADMIN', 'ADMIN_CENTRO', 'DIRECCION'];

@Controller('structure')
@UseGuards(SessionGuard, RolesGuard)
export class StructureController {
  constructor(private readonly structure: StructureService) {}

  @Get('families')
  families(@CurrentUser() user: AuthenticatedUser) {
    return this.structure.listFamilies(user.centerId);
  }

  @Post('families')
  @Roles(...ADMIN)
  createFamily(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateFamilyDto) {
    return this.structure.createFamily(user.centerId, dto);
  }

  @Get('groups')
  groups(
    @CurrentUser() user: AuthenticatedUser,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.structure.listGroups(user, academicYearId);
  }

  @Post('groups')
  @Roles(...ADMIN)
  createGroup(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateGroupDto) {
    return this.structure.createGroup(user, dto);
  }
}
