import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AcademicYearsModule } from './academic-years/academic-years.module';
import { ActionsModule } from './actions/actions.module';
import { AuthModule } from './auth/auth.module';
import { AutomationsModule } from './automations/automations.module';
import { CommunicationsModule } from './communications/communications.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DatabaseModule } from './database/database.module';
import { EvidenceModule } from './evidence/evidence.module';
import { HealthController } from './health.controller';
import { IntegrationsModule } from './integrations/integrations.module';
import { NetworksModule } from './networks/networks.module';
import { PlansModule } from './plans/plans.module';
import { ReportsModule } from './reports/reports.module';
import { SetupModule } from './setup/setup.module';
import { StaffRequestsModule } from './staff-requests/staff-requests.module';
import { StructureModule } from './structure/structure.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    DatabaseModule,
    SetupModule,
    AuthModule,
    IntegrationsModule,
    AutomationsModule,
    UsersModule,
    AcademicYearsModule,
    StructureModule,
    NetworksModule,
    CommunicationsModule,
    DashboardModule,
    EvidenceModule,
    PlansModule,
    ReportsModule,
    StaffRequestsModule,
    ActionsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
