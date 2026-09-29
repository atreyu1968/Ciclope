import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { AutomationsService } from './automations.service';

@Module({
  imports: [MailModule],
  providers: [AutomationsService],
})
export class AutomationsModule {}
