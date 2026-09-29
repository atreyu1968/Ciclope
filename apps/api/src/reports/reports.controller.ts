import { Body, Controller, Get, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SessionGuard } from '../auth/session.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ReportsService } from './reports.service';
import { CreateReportSnapshotDto } from './dto/create-report-snapshot.dto';
import { UpdateReportSnapshotStatusDto } from './dto/update-report-snapshot-status.dto';
import { UpdateReportSnapshotNarrativeDto } from './dto/update-report-snapshot-narrative.dto';
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
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reports.summary(user, academicYearId, networkId, from, to);
  }

  @Post('interpret')
  async interpret(
    @CurrentUser() user: AuthenticatedUser,
    @Query('academicYearId') academicYearId?: string,
    @Query('networkId') networkId?: string,
    @Query('mode') mode?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const report = await this.reports.summary(user, academicYearId, networkId, from, to);
    const safeReport = {
      center: report.center,
      academicYear: report.academicYear,
      network: report.network,
      period: report.period,
      totals: report.totals,
      planProgress: report.planProgress,
      networkInsights: report.networkInsights,
      byNetwork: report.byNetwork,
      byFamily: report.byFamily,
      byType: report.byType,
      byMonth: report.byMonth,
      generatedAt: report.generatedAt,
    };
    return mode === 'draft'
      ? this.integrations.draftReport(user.centerId, safeReport)
      : this.integrations.interpretReport(user.centerId, safeReport);
  }

  @Post('snapshots')
  saveSnapshot(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateReportSnapshotDto,
  ) {
    return this.reports.saveSnapshot(user, dto);
  }

  @Get('snapshots')
  snapshots(
    @CurrentUser() user: AuthenticatedUser,
    @Query('academicYearId') academicYearId?: string,
    @Query('networkId') networkId?: string,
  ) {
    return this.reports.listSnapshots(user, academicYearId, networkId);
  }

  @Get('snapshots/:id')
  snapshot(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.reports.snapshotDetail(user, id);
  }

  @Patch('snapshots/:id/narrative')
  updateSnapshotNarrative(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateReportSnapshotNarrativeDto,
  ) {
    return this.reports.updateSnapshotNarrative(user, id, dto.narrative);
  }

  @Patch('snapshots/:id/status')
  updateSnapshotStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateReportSnapshotStatusDto,
  ) {
    return this.reports.updateSnapshotStatus(user, id, dto.status);
  }

  @Get('actions.csv')
  async csv(
    @CurrentUser() user: AuthenticatedUser,
    @Res() response: Response,
    @Query('academicYearId') academicYearId?: string,
    @Query('networkId') networkId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const csv = await this.reports.csv(user, academicYearId, networkId, from, to);
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', 'attachment; filename="ciclope-actuaciones.csv"');
    response.send(csv);
  }
}
