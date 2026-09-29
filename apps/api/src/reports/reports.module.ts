import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportDocumentService } from './report-document.service';

@Module({
  imports: [AuthModule, IntegrationsModule],
  controllers: [ReportsController],
  providers: [ReportsService, ReportDocumentService],
})
export class ReportsModule {}
