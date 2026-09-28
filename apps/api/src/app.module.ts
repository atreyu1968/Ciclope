import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AcademicYearsModule } from './academic-years/academic-years.module';
import { ActionsModule } from './actions/actions.module';
import { AuthModule } from './auth/auth.module';
import { CommunicationsModule } from './communications/communications.module';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health.controller';
import { NetworksModule } from './networks/networks.module';
import { SetupModule } from './setup/setup.module';
import { StructureModule } from './structure/structure.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    DatabaseModule,
    SetupModule,
    AuthModule,
    UsersModule,
    AcademicYearsModule,
    StructureModule,
    NetworksModule,
    CommunicationsModule,
    ActionsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
