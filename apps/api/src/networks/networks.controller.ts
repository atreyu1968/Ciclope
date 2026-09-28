import { Controller, Get, UseGuards } from '@nestjs/common';
import { SessionGuard } from '../auth/session.guard';
import { NetworksService } from './networks.service';

@Controller('networks')
@UseGuards(SessionGuard)
export class NetworksController {
  constructor(private readonly networks: NetworksService) {}

  @Get()
  findAll() {
    return this.networks.findAll();
  }
}
