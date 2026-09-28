import { Controller, Get } from '@nestjs/common';
import { NetworksService } from './networks.service';

@Controller('networks')
export class NetworksController {
  constructor(private readonly networks: NetworksService) {}
  @Get() findAll() { return this.networks.findAll(); }
}
