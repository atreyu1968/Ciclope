import { Body, Controller, Get, Param, Patch, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SessionGuard } from '../auth/session.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CreateUserDto } from './dto/create-user.dto';
import { ImportUsersDto } from './dto/import-users.dto';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

const ADMIN = ['SUPERADMIN', 'ADMIN_CENTRO', 'DIRECCION'];

@Controller('users')
@UseGuards(SessionGuard, RolesGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @Roles('SUPERADMIN', 'ADMIN_CENTRO', 'DIRECCION', 'COORDINADOR_CICLOPE', 'COORD_INNOVACION', 'COORD_EMPRENDIMIENTO', 'COORD_IOP', 'COORD_CALIDAD')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.users.list(user.centerId);
  }

  @Get('export.csv')
  @Roles(...ADMIN)
  async exportCsv(
    @CurrentUser() user: AuthenticatedUser,
    @Res() response: Response,
  ) {
    const csv = await this.users.exportCsv(user.centerId);
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', 'attachment; filename="profesorado-ciclope.csv"');
    response.send(csv);
  }

  @Post('import/preview')
  @Roles(...ADMIN)
  previewImport(@CurrentUser() user: AuthenticatedUser, @Body() dto: ImportUsersDto) {
    return this.users.previewImport(user.centerId, dto);
  }

  @Post()
  @Roles(...ADMIN)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateUserDto) {
    return this.users.create(user, dto);
  }

  @Patch(':id')
  @Roles(...ADMIN)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.users.update(user, id, dto);
  }

  @Post(':id/reset-password')
  @Roles(...ADMIN)
  resetPassword(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ResetUserPasswordDto,
  ) {
    return this.users.resetPassword(user, id, dto);
  }

  @Post('import')
  @Roles(...ADMIN)
  importMany(@CurrentUser() user: AuthenticatedUser, @Body() dto: ImportUsersDto) {
    return this.users.importMany(user, dto);
  }
}
