import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SessionGuard } from '../auth/session.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CreateUserDto } from './dto/create-user.dto';
import { ImportUsersDto } from './dto/import-users.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(SessionGuard, RolesGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @Roles('SUPERADMIN', 'ADMIN_CENTRO', 'DIRECCION', 'COORDINADOR_CICLOPE', 'COORD_INNOVACION', 'COORD_EMPRENDIMIENTO', 'COORD_IOP', 'COORD_CALIDAD')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.users.list(user.centerId);
  }

  @Post()
  @Roles('SUPERADMIN', 'ADMIN_CENTRO', 'DIRECCION')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateUserDto) {
    return this.users.create(user.centerId, dto);
  }

  @Post('import')
  @Roles('SUPERADMIN', 'ADMIN_CENTRO', 'DIRECCION')
  importMany(@CurrentUser() user: AuthenticatedUser, @Body() dto: ImportUsersDto) {
    return this.users.importMany(user.centerId, dto);
  }
}
