import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { UpdateNetworkInstitutionalDto } from './dto/update-network-institutional.dto';

@Injectable()
export class NetworksService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(centerId: string) {
    const networks = await this.prisma.network.findMany({
      where: { active: true },
      include: {
        centerConfigs: {
          where: { centerId },
          take: 1,
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    return networks.map(({ centerConfigs, ...network }) => {
      const config = centerConfigs[0];
      const objectives = Array.isArray(config?.institutionalObjectives)
        ? config.institutionalObjectives.filter((item): item is string => typeof item === 'string')
        : [];

      return {
        ...network,
        description: config?.description ?? network.description,
        institutionalObjectives: objectives,
        institutionalConfigured: Boolean(config),
      };
    });
  }

  async updateInstitutional(
    user: AuthenticatedUser,
    networkId: string,
    dto: UpdateNetworkInstitutionalDto,
  ) {
    const network = await this.prisma.network.findFirst({
      where: { id: networkId, active: true },
      select: { id: true, name: true },
    });
    if (!network) throw new NotFoundException('Red no encontrada.');

    const description = dto.description?.trim() || null;
    const institutionalObjectives = dto.institutionalObjectives
      .map((item) => item.trim())
      .filter(Boolean);

    await this.prisma.$transaction([
      this.prisma.centerNetworkConfig.upsert({
        where: {
          centerId_networkId: {
            centerId: user.centerId,
            networkId,
          },
        },
        update: {
          description,
          institutionalObjectives,
        },
        create: {
          centerId: user.centerId,
          networkId,
          description,
          institutionalObjectives,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          centerId: user.centerId,
          actorId: user.id,
          action: 'NETWORK_INSTITUTIONAL_CONFIG_UPDATED',
          entityType: 'Network',
          entityId: networkId,
          details: {
            networkName: network.name,
            objectiveCount: institutionalObjectives.length,
            descriptionConfigured: Boolean(description),
          },
        },
      }),
    ]);

    const all = await this.findAll(user.centerId);
    return all.find((item) => item.id === networkId);
  }
}
