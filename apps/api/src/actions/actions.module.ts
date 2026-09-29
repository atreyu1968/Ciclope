import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { ActionsController } from './actions.controller';
import { ActionsService } from './actions.service';

@Module({ imports: [MailModule], controllers: [ActionsController], providers: [ActionsService] })
export class ActionsModule {}
