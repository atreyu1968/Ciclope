import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CommunicationStatus, EmailOutboxStatus, Shift } from '../generated/prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { MailOutboxService } from '../mail/mail-outbox.service';
import { CreateCommunicationDto } from './dto/create-communication.dto';

@Injectable()
export class CommunicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailOutboxService,
  ) {}

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

  async mailStatus(centerId: string) {
    return {
      provider: 'Resend',
      configured: await this.mail.isConfigured(centerId),
    };
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
      select: { id: true, email: true },
    });

    if (!recipients.length) {
      throw new BadRequestException('La selección no contiene ningún destinatario.');
    }

    const now = new Date();
    const communication = await this.prisma.communication.create({
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
        recipients: {
          select: { userId: true, readAt: true, respondedAt: true },
        },
        _count: { select: { recipients: true } },
      },
    });

    const delivery = await this.mail.enqueueCommunication(
      user.centerId,
      communication.id,
      communication.title,
      communication.body,
      recipients,
      communication.originNetwork?.name ?? 'CÍCLOPE FP',
    );

    return { ...communication, emailDelivery: delivery, resendConfigured: await this.mail.isConfigured(user.centerId) };
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
        ...(this.canPublishGlobally(user)
          ? {}
          : { originNetworkId: { in: user.coordinatorNetworkIds } }),
      },
      include: {
        originNetwork: true,
        author: { select: { firstName: true, lastName: true } },
        recipients: {
          select: { userId: true, readAt: true, respondedAt: true },
        },
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

  async mailJobs(user: AuthenticatedUser) {
    if (!user.academicYearId) return [];

    return this.prisma.emailOutbox.findMany({
      where: {
        communicationId: { not: null },
        communication: {
          academicYearId: user.academicYearId,
          ...(this.canPublishGlobally(user)
            ? {}
            : { originNetworkId: { in: user.coordinatorNetworkIds } }),
        },
      },
      include: {
        communication: {
          select: {
            id: true,
            title: true,
            originNetwork: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
  }

  async retryMailJob(user: AuthenticatedUser, jobId: string) {
    const job = await this.prisma.emailOutbox.findUnique({
      where: { id: jobId },
      include: {
        communication: {
          include: {
            academicYear: true,
            originNetwork: true,
          },
        },
      },
    });

    if (!job?.communication || job.communication.academicYear.centerId !== user.centerId) {
      throw new NotFoundException('Envío no encontrado.');
    }
    if (job.communication.academicYearId !== user.academicYearId) {
      throw new ForbiddenException('El envío pertenece a otro curso académico.');
    }
    if (
      !this.canPublishGlobally(user) &&
      (!job.communication.originNetworkId || !user.coordinatorNetworkIds.includes(job.communication.originNetworkId))
    ) {
      throw new ForbiddenException('No puedes gestionar este envío.');
    }
    if (job.status !== EmailOutboxStatus.FAILED) {
      throw new BadRequestException('Solo pueden reintentarse envíos que han agotado sus intentos automáticos.');
    }

    await this.prisma.$transaction([
      this.prisma.emailOutbox.update({
        where: { id: job.id },
        data: {
          status: EmailOutboxStatus.QUEUED,
          attempts: 0,
          nextAttemptAt: new Date(),
          lastError: null,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          centerId: user.centerId,
          actorId: user.id,
          action: 'EMAIL_DELIVERY_RETRIED',
          entityType: 'EmailOutbox',
          entityId: job.id,
          details: { communicationId: job.communicationId, recipientEmail: job.recipientEmail },
        },
      }),
    ]);

    void this.mail.processBatch();
    return { success: true };
  }

  async remindPending(user: AuthenticatedUser, communicationId: string) {
    const communication = await this.prisma.communication.findUnique({
      where: { id: communicationId },
      include: {
        academicYear: true,
        originNetwork: true,
        recipients: {
          include: {
            user: { select: { id: true, email: true } },
          },
        },
      },
    });

    if (!communication || communication.academicYear.centerId !== user.centerId) {
      throw new NotFoundException('Comunicación no encontrada.');
    }
    if (communication.academicYearId !== user.academicYearId) {
      throw new ForbiddenException('La comunicación pertenece a otro curso académico.');
    }
    if (
      !this.canPublishGlobally(user) &&
      (!communication.originNetworkId || !user.coordinatorNetworkIds.includes(communication.originNetworkId))
    ) {
      throw new ForbiddenException('No puedes gestionar esta comunicación.');
    }

    const pending = communication.recipients
      .filter((recipient) => communication.responseRequired ? !recipient.respondedAt : !recipient.readAt)
      .map((recipient) => recipient.user);

    if (!pending.length) return { queued: 0, message: 'No hay destinatarios pendientes.' };

    return this.mail.enqueueCommunication(
      communication.academicYear.centerId,
      communication.id,
      `Recordatorio: ${communication.title}`,
      communication.body,
      pending,
      communication.originNetwork?.name ?? 'CÍCLOPE FP',
    );
  }
}
