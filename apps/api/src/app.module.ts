import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ActionsModule } from './actions/actions.module';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health.controller';
import { NetworksModule } from './networks/networks.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    DatabaseModule,
    NetworksModule,
    ActionsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
