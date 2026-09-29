import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SessionGuard } from '../auth/session.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CommunicationsService } from './communications.service';
import { CreateCommunicationDto } from './dto/create-communication.dto';
import { RespondCommunicationDto } from './dto/respond-communication.dto';

const PUBLISHERS = [
  'SUPERADMIN',
  'ADMIN_CENTRO',
  'DIRECCION',
  'COORDINADOR_CICLOPE',
  'COORD_INNOVACION',
  'COORD_EMPRENDIMIENTO',
  'COORD_IOP',
  'COORD_CALIDAD',
];

@Controller('communications')
@UseGuards(SessionGuard, RolesGuard)
export class CommunicationsController {
  constructor(private readonly communications: CommunicationsService) {}

  @Get('mail-status')
  @Roles(...PUBLISHERS)
  mailStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.communications.mailStatus(user.centerId);
  }

  @Post()
  @Roles(...PUBLISHERS)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCommunicationDto) {
    return this.communications.createAndPublish(user, dto);
  }

  @Get('inbox')
  inbox(@CurrentUser() user: AuthenticatedUser) {
    return this.communications.inbox(user);
  }

  @Get('sent')
  @Roles(...PUBLISHERS)
  sent(@CurrentUser() user: AuthenticatedUser) {
    return this.communications.sent(user);
  }

  @Get('mail-jobs')
  @Roles(...PUBLISHERS)
  mailJobs(@CurrentUser() user: AuthenticatedUser) {
    return this.communications.mailJobs(user);
  }

  @Post('mail-jobs/:jobId/retry')
  @Roles(...PUBLISHERS)
  retryMailJob(
    @CurrentUser() user: AuthenticatedUser,
    @Param('jobId') jobId: string,
  ) {
    return this.communications.retryMailJob(user, jobId);
  }

  @Patch(':id/read')
  read(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.communications.markRead(user, id);
  }

  @Post(':id/respond')
  respond(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RespondCommunicationDto,
  ) {
    return this.communications.respond(user, id, dto.response);
  }

  @Post(':id/remind-pending')
  @Roles(...PUBLISHERS)
  remindPending(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.communications.remindPending(user, id);
  }
}
