import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class NetworksService {
  constructor(private readonly prisma: PrismaService) {}
  findAll() {
    return this.prisma.network.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } });
  }
}
