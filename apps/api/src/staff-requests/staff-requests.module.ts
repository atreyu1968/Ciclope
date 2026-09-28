import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StaffRequestsController } from './staff-requests.controller';
import { StaffRequestsService } from './staff-requests.service';

@Module({
  imports: [AuthModule],
  controllers: [StaffRequestsController],
  providers: [StaffRequestsService],
  exports: [StaffRequestsService],
})
export class StaffRequestsModule {}
