import { Module } from '@nestjs/common';
import { IntegrationsModule } from '../integrations/integrations.module';
import { MailOutboxService } from './mail-outbox.service';

@Module({
  imports: [IntegrationsModule],
  providers: [MailOutboxService],
  exports: [MailOutboxService],
})
export class MailModule {}
