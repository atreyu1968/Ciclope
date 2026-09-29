import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SessionGuard } from '../auth/session.guard';
import { AssistantService } from './assistant.service';
import { DraftCommunicationDto, PlanSuggestionsDto } from './assistant.dto';

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

@Controller('assistant')
@UseGuards(SessionGuard, RolesGuard)
@Roles(...COORDINATION_ROLES)
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Post('communication-draft')
  draftCommunication(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DraftCommunicationDto,
  ) {
    return this.assistant.draftCommunication(user, dto);
  }

  @Post('inbox-summary')
  summarizeInbox(@CurrentUser() user: AuthenticatedUser) {
    return this.assistant.summarizeInbox(user);
  }

  @Post('plan-suggestions')
  planSuggestions(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PlanSuggestionsDto,
  ) {
    return this.assistant.planSuggestions(user, dto.planId);
  }
}
