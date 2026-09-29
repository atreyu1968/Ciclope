import { Controller, Get, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SessionGuard } from '../auth/session.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ReportsService } from './reports.service';
import { IntegrationsService } from '../integrations/integrations.service';

const REPORT_ROLES = [
  'SUPERADMIN',
  'ADMIN_CENTRO',
  'DIRECCION',
  'COORDINADOR_CICLOPE',
  'COORD_INNOVACION',
  'COORD_EMPRENDIMIENTO',
  'COORD_IOP',
  'COORD_CALIDAD',
];

@Controller('reports')
@UseGuards(SessionGuard, RolesGuard)
@Roles(...REPORT_ROLES)
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly integrations: IntegrationsService,
  ) {}

  @Get('summary')
  summary(
    @CurrentUser() user: AuthenticatedUser,
    @Query('academicYearId') academicYearId?: string,
    @Query('networkId') networkId?: string,
  ) {
    return this.reports.summary(user, academicYearId, networkId);
  }

  @Post('interpret')
  async interpret(
    @CurrentUser() user: AuthenticatedUser,
    @Query('academicYearId') academicYearId?: string,
    @Query('networkId') networkId?: string,
  ) {
    const report = await this.reports.summary(user, academicYearId, networkId);
    const safeReport = {
      center: report.center,
      academicYear: report.academicYear,
      network: report.network,
      totals: report.totals,
      planProgress: report.planProgress,
      byNetwork: report.byNetwork,
      byFamily: report.byFamily,
      byType: report.byType,
      byMonth: report.byMonth,
      generatedAt: report.generatedAt,
    };
    return this.integrations.interpretReport(user.centerId, safeReport);
  }

  @Get('actions.csv')
  async csv(
    @CurrentUser() user: AuthenticatedUser,
    @Res() response: Response,
    @Query('academicYearId') academicYearId?: string,
    @Query('networkId') networkId?: string,
  ) {
    const csv = await this.reports.csv(user, academicYearId, networkId);
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', 'attachment; filename="ciclope-actuaciones.csv"');
    response.send(csv);
  }
}
