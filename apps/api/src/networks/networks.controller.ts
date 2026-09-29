import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ADMIN_ROLES } from '../auth/role-policy';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SessionGuard } from '../auth/session.guard';
import { UpdateNetworkInstitutionalDto } from './dto/update-network-institutional.dto';
import { NetworksService } from './networks.service';

@Controller('networks')
@UseGuards(SessionGuard, RolesGuard)
export class NetworksController {
  constructor(private readonly networks: NetworksService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.networks.findAll(user.centerId);
  }

  @Patch(':id/institutional')
  @Roles(...ADMIN_ROLES)
  updateInstitutional(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateNetworkInstitutionalDto,
  ) {
    return this.networks.updateInstitutional(user, id, dto);
  }
}
