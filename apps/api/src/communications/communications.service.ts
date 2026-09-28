import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CommunicationStatus, Shift } from '../generated/prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { CreateCommunicationDto } from './dto/create-communication.dto';

@Injectable()
export class CommunicationsService {
  constructor(private readonly prisma: PrismaService) {}

  private canPublishGlobally(user: AuthenticatedUser) {
    return ['SUPERADMIN', 'ADMIN_CENTRO', 'DIRECCION', 'COORDINADOR_CICLOPE']
      .some((role) => user.roles.includes(role));
  }

  private async assertOriginNetwork(user: AuthenticatedUser, networkId?: string) {
    if (!networkId) {
      if (!this.canPublishGlobally(user)) {
        throw new ForbiddenException('Selecciona una de las redes que coordinas.');
      }
      return;
    }

    const network = await this.prisma.network.findFirst({ where: { id: networkId, active: true } });
    if (!network) throw new BadRequestException('La red de origen no es válida.');

    if (!this.canPublishGlobally(user) && !user.coordinatorNetworkIds.includes(networkId)) {
      throw new ForbiddenException('No puedes publicar en nombre de esa red.');
    }
  }

  async createAndPublish(user: AuthenticatedUser, dto: CreateCommunicationDto) {
    if (!user.academicYearId) throw new BadRequestException('No existe un curso académico activo.');
    await this.assertOriginNetwork(user, dto.originNetworkId);

    const familyIds = [...new Set(dto.professionalFamilyIds ?? [])];
    if (familyIds.length) {
      const validFamilies = await this.prisma.professionalFamily.count({
        where: { id: { in: familyIds }, centerId: user.centerId, active: true },
      });
      if (validFamilies !== familyIds.length) {
        throw new BadRequestException('Una o más familias profesionales no son válidas.');
      }
    }

    const shifts = [...new Set(dto.shifts ?? [])];
    const shiftFilter = shifts.length
      ? { in: Array.from(new Set([...shifts, Shift.BOTH])) }
      : undefined;

    const targeted = Boolean(dto.targetAllFp) || familyIds.length > 0 || shifts.length > 0;
    if (!targeted) {
      throw new BadRequestException('Selecciona al menos un colectivo destinatario.');
    }

    const recipients = await this.prisma.user.findMany({
      where: {
        centerId: user.centerId,
        active: true,
        roles: { some: { role: { key: 'PROFESOR_FP' } } },
        ...(dto.targetAllFp
          ? {}
          : {
              ...(shiftFilter ? { shift: shiftFilter } : {}),
              ...(familyIds.length
                ? { professionalFamilies: { some: { professionalFamilyId: { in: familyIds } } } }
                : {}),
            }),
      },
      select: { id: true },
    });

    if (!recipients.length) {
      throw new BadRequestException('La selección no contiene ningún destinatario.');
    }

    const now = new Date();
    return this.prisma.communication.create({
      data: {
        academicYearId: user.academicYearId,
        authorId: user.id,
        originNetworkId: dto.originNetworkId,
        title: dto.title.trim(),
        body: dto.body.trim(),
        status: CommunicationStatus.PUBLISHED,
        responseRequired: dto.responseRequired ?? false,
        deadline: dto.deadline ? new Date(dto.deadline) : null,
        publishedAt: now,
        recipients: {
          create: recipients.map((recipient) => ({
            userId: recipient.id,
            deliveredAt: now,
          })),
        },
      },
      include: {
        originNetwork: true,
        _count: { select: { recipients: true } },
      },
    });
  }

  inbox(user: AuthenticatedUser) {
    return this.prisma.communicationRecipient.findMany({
      where: {
        userId: user.id,
        communication: {
          academicYearId: user.academicYearId,
          status: CommunicationStatus.PUBLISHED,
        },
      },
      include: {
        communication: {
          include: {
            originNetwork: true,
            author: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { communication: { publishedAt: 'desc' } },
      take: 100,
    });
  }

  sent(user: AuthenticatedUser) {
    if (!user.academicYearId) return [];
    return this.prisma.communication.findMany({
      where: {
        academicYearId: user.academicYearId,
        authorId: user.id,
      },
      include: {
        originNetwork: true,
        _count: { select: { recipients: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async markRead(user: AuthenticatedUser, communicationId: string) {
    const recipient = await this.prisma.communicationRecipient.findUnique({
      where: { communicationId_userId: { communicationId, userId: user.id } },
    });
    if (!recipient) throw new NotFoundException('Comunicación no encontrada.');

    return this.prisma.communicationRecipient.update({
      where: { communicationId_userId: { communicationId, userId: user.id } },
      data: { readAt: recipient.readAt ?? new Date() },
    });
  }

  async respond(user: AuthenticatedUser, communicationId: string, response: string) {
    const recipient = await this.prisma.communicationRecipient.findUnique({
      where: { communicationId_userId: { communicationId, userId: user.id } },
      include: { communication: true },
    });
    if (!recipient) throw new NotFoundException('Comunicación no encontrada.');
    if (!recipient.communication.responseRequired) {
      throw new BadRequestException('Esta comunicación no solicita respuesta.');
    }

    return this.prisma.communicationRecipient.update({
      where: { communicationId_userId: { communicationId, userId: user.id } },
      data: {
        readAt: recipient.readAt ?? new Date(),
        respondedAt: new Date(),
        responseText: response.trim(),
      },
    });
  }
}
