import { Module } from '@nestjs/common';
import { MailOutboxService } from './mail-outbox.service';

@Module({
  providers: [MailOutboxService],
  exports: [MailOutboxService],
})
export class MailModule {}
