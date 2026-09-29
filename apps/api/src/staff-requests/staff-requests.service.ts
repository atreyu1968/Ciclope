import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { StaffRequestStatus } from '../generated/prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { MailOutboxService } from '../mail/mail-outbox.service';
import { CreateStaffRequestDto } from './dto/create-staff-request.dto';

@Injectable()
export class StaffRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailOutboxService,
  ) {}

  private isGlobal(user: AuthenticatedUser) {
    return ['SUPERADMIN', 'ADMIN_CENTRO', 'DIRECCION', 'COORDINADOR_CICLOPE']
      .some((role) => user.roles.includes(role));
  }

  private async findRequest(id: string) {
    return this.prisma.staffRequest.findUnique({
      where: { id },
      include: {
        academicYear: true,
        networks: { include: { network: true } },
        submittedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        messages: {
          include: {
            author: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  private canManage(request: Awaited<ReturnType<StaffRequestsService['findRequest']>>, user: AuthenticatedUser) {
    if (!request) return false;
    if (request.academicYear.centerId !== user.centerId) return false;
    if (this.isGlobal(user)) return true;
    return request.networks.some((item) => user.coordinatorNetworkIds.includes(item.networkId));
  }

  private async coordinatorRecipients(academicYearId: string, networkIds: string[], excludeUserId?: string) {
    const [networkAssignments, ciclopeAssignments] = await Promise.all([
      this.prisma.networkCoordinator.findMany({
        where: {
          academicYearId,
          networkId: { in: networkIds },
          user: { active: true },
        },
        include: { user: { select: { id: true, email: true } } },
      }),
      this.prisma.ciclopeCoordinator.findMany({
        where: {
          academicYearId,
          user: { active: true },
        },
        include: { user: { select: { id: true, email: true } } },
      }),
    ]);

    const recipients = [...networkAssignments, ...ciclopeAssignments]
      .map((item) => item.user)
      .filter((recipient) => recipient.id !== excludeUserId);

    return [...new Map(recipients.map((recipient) => [recipient.id, recipient])).values()];
  }

  private requestLink(id: string) {
    const base = process.env.APP_BASE_URL?.replace(/\/$/, '');
    return base ? `${base}/buzon/${id}` : '';
  }

  async create(user: AuthenticatedUser, dto: CreateStaffRequestDto) {
    if (!user.academicYearId) throw new BadRequestException('No existe un curso académico activo.');

    const networkIds = [...new Set(dto.networkIds)];
    const count = await this.prisma.network.count({
      where: { id: { in: networkIds }, active: true },
    });
    if (count !== networkIds.length) {
      throw new BadRequestException('Una o más redes seleccionadas no son válidas.');
    }

    const request = await this.prisma.staffRequest.create({
      data: {
        academicYearId: user.academicYearId,
        submittedById: user.id,
        category: dto.category.trim(),
        subject: dto.subject.trim(),
        networks: {
          create: networkIds.map((networkId) => ({ networkId })),
        },
        messages: {
          create: {
            authorId: user.id,
            body: dto.body.trim(),
          },
        },
      },
      include: {
        networks: { include: { network: true } },
        messages: true,
      },
    });

    const recipients = await this.coordinatorRecipients(user.academicYearId, networkIds, user.id);
    const link = this.requestLink(request.id);
    await this.mail.enqueueDirect(
      user.centerId,
      `[CÍCLOPE FP · Buzón] ${request.subject}`,
      [
        `${user.firstName} ${user.lastName} ha enviado una nueva ${request.category.toLowerCase()}.`,
        '',
        dto.body.trim(),
        link ? `\nAbrir en CÍCLOPE: ${link}` : '',
      ].join('\n'),
      recipients,
    );

    return request;
  }

  mine(user: AuthenticatedUser) {
    if (!user.academicYearId) return [];
    return this.prisma.staffRequest.findMany({
      where: {
        academicYearId: user.academicYearId,
        submittedById: user.id,
      },
      include: {
        networks: { include: { network: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
  }

  coordinationInbox(user: AuthenticatedUser, status?: StaffRequestStatus) {
    if (!user.academicYearId) return [];
    if (!this.isGlobal(user) && !user.coordinatorNetworkIds.length) return [];

    return this.prisma.staffRequest.findMany({
      where: {
        academicYearId: user.academicYearId,
        ...(status ? { status } : {}),
        ...(!this.isGlobal(user)
          ? { networks: { some: { networkId: { in: user.coordinatorNetworkIds } } } }
          : {}),
      },
      include: {
        submittedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        networks: { include: { network: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      take: 100,
    });
  }

  async detail(id: string, user: AuthenticatedUser) {
    const request = await this.findRequest(id);
    if (!request || request.academicYear.centerId !== user.centerId) {
      throw new NotFoundException('Consulta no encontrada.');
    }
    if (request.submittedById !== user.id && !this.canManage(request, user)) {
      throw new ForbiddenException('No tienes acceso a esta consulta.');
    }
    return request;
  }

  async addMessage(id: string, user: AuthenticatedUser, body: string) {
    const request = await this.findRequest(id);
    if (!request || request.academicYear.centerId !== user.centerId) {
      throw new NotFoundException('Consulta no encontrada.');
    }

    const owner = request.submittedById === user.id;
    const manager = this.canManage(request, user);
    if (!owner && !manager) throw new ForbiddenException('No puedes responder a esta consulta.');
    if (request.status === StaffRequestStatus.CLOSED) {
      throw new BadRequestException('La consulta está cerrada.');
    }

    const message = await this.prisma.staffRequestMessage.create({
      data: {
        requestId: id,
        authorId: user.id,
        body: body.trim(),
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    if (manager && request.status === StaffRequestStatus.NEW) {
      await this.prisma.staffRequest.update({
        where: { id },
        data: { status: StaffRequestStatus.IN_PROGRESS },
      });
    } else {
      await this.prisma.staffRequest.update({
        where: { id },
        data: { updatedAt: new Date() },
      });
    }

    const link = this.requestLink(id);
    if (owner) {
      const recipients = await this.coordinatorRecipients(
        request.academicYearId,
        request.networks.map((item) => item.networkId),
        user.id,
      );
      await this.mail.enqueueDirect(
        request.academicYear.centerId,
        `[CÍCLOPE FP · Buzón] Actualización: ${request.subject}`,
        [
          `${user.firstName} ${user.lastName} ha añadido un mensaje.`,
          '',
          body.trim(),
          link ? `\nAbrir en CÍCLOPE: ${link}` : '',
        ].join('\n'),
        recipients,
      );
    } else {
      await this.mail.enqueueDirect(
        request.academicYear.centerId,
        `[CÍCLOPE FP · Buzón] Respuesta: ${request.subject}`,
        [
          `${user.firstName} ${user.lastName} ha respondido a tu consulta.`,
          '',
          body.trim(),
          link ? `\nAbrir en CÍCLOPE: ${link}` : '',
        ].join('\n'),
        [{ id: request.submittedBy.id, email: request.submittedBy.email }],
      );
    }

    return message;
  }

  async updateStatus(id: string, user: AuthenticatedUser, status: StaffRequestStatus) {
    const request = await this.findRequest(id);
    if (!request || request.academicYear.centerId !== user.centerId) {
      throw new NotFoundException('Consulta no encontrada.');
    }
    if (!this.canManage(request, user)) {
      throw new ForbiddenException('No puedes gestionar esta consulta.');
    }

    const updated = await this.prisma.staffRequest.update({
      where: { id },
      data: {
        status,
        resolvedAt: (status === StaffRequestStatus.RESOLVED || status === StaffRequestStatus.CLOSED)
          ? request.resolvedAt ?? new Date()
          : null,
      },
    });

    if (status === StaffRequestStatus.RESOLVED || status === StaffRequestStatus.CLOSED) {
      const link = this.requestLink(id);
      await this.mail.enqueueDirect(
        request.academicYear.centerId,
        `[CÍCLOPE FP · Buzón] ${status === StaffRequestStatus.RESOLVED ? 'Consulta resuelta' : 'Consulta cerrada'}: ${request.subject}`,
        [
          `La coordinación ha actualizado el estado de tu consulta a “${status === StaffRequestStatus.RESOLVED ? 'Resuelta' : 'Cerrada'}”.`,
          link ? `\nAbrir en CÍCLOPE: ${link}` : '',
        ].join('\n'),
        [{ id: request.submittedBy.id, email: request.submittedBy.email }],
      );
    }

    return updated;
  }
}
