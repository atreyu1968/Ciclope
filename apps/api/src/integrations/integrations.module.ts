import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { SecretCryptoService } from './secret-crypto.service';

@Module({
  imports: [AuthModule],
  controllers: [IntegrationsController],
  providers: [IntegrationsService, SecretCryptoService],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
