import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { DraftCommunicationDto } from './assistant.dto';

@Injectable()
export class AssistantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly integrations: IntegrationsService,
  ) {}

  private isGlobal(user: AuthenticatedUser) {
    return ['SUPERADMIN', 'ADMIN_CENTRO', 'DIRECCION', 'COORDINADOR_CICLOPE']
      .some((role) => user.roles.includes(role));
  }

  draftCommunication(user: AuthenticatedUser, dto: DraftCommunicationDto) {
    return this.integrations.draftCommunication(
      user.centerId,
      {
        brief: dto.brief.trim(),
        title: dto.title?.trim() || undefined,
        currentBody: dto.currentBody?.trim() || undefined,
        audience: dto.audience?.trim() || undefined,
      },
      user.id,
    );
  }

  async summarizeInbox(user: AuthenticatedUser) {
    if (!user.academicYearId) {
      throw new BadRequestException('No existe un curso académico activo.');
    }
    if (!this.isGlobal(user) && !user.coordinatorNetworkIds.length) {
      throw new ForbiddenException('No tienes una coordinación asignada en el curso activo.');
    }

    const requests = await this.prisma.staffRequest.findMany({
      where: {
        academicYearId: user.academicYearId,
        status: { in: ['NEW', 'IN_PROGRESS'] },
        ...(!this.isGlobal(user)
          ? { networks: { some: { networkId: { in: user.coordinatorNetworkIds } } } }
          : {}),
      },
      select: {
        id: true,
        category: true,
        subject: true,
        status: true,
        updatedAt: true,
        networks: { select: { network: { select: { name: true } } } },
        messages: {
          select: { body: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 60,
    });

    const context = requests.map((request) => ({
      category: request.category,
      subject: request.subject,
      status: request.status,
      updatedAt: request.updatedAt,
      networks: request.networks.map((item) => item.network.name),
      latestMessage: request.messages[0]?.body.slice(0, 1200) || '',
    }));

    return this.integrations.summarizeStaffInbox(user.centerId, context, user.id);
  }

  async planSuggestions(user: AuthenticatedUser, planId: string) {
    if (!user.academicYearId) {
      throw new BadRequestException('No existe un curso académico activo.');
    }

    const plan = await this.prisma.annualPlan.findUnique({
      where: { id: planId },
      include: {
        academicYear: true,
        network: { select: { id: true, name: true } },
        objectives: {
          select: {
            title: true,
            description: true,
            status: true,
            metric: true,
            targetValue: true,
          },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        },
        tasks: {
          select: {
            title: true,
            description: true,
            status: true,
            dueDate: true,
            official: true,
            objective: { select: { title: true } },
          },
          orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!plan || plan.academicYear.centerId !== user.centerId) {
      throw new NotFoundException('Plan anual no encontrado.');
    }
    if (plan.academicYearId !== user.academicYearId) {
      throw new ForbiddenException('El plan pertenece a otro curso académico.');
    }
    if (!this.isGlobal(user) && !user.coordinatorNetworkIds.includes(plan.networkId)) {
      throw new ForbiddenException('No puedes utilizar la IA sobre el plan de otra red.');
    }

    return this.integrations.proposePlanWork(
      user.centerId,
      {
        network: plan.network.name,
        title: plan.title,
        summary: plan.summary,
        status: plan.status,
        objectives: plan.objectives,
        tasks: plan.tasks.map((task) => ({
          title: task.title,
          description: task.description,
          status: task.status,
          dueDate: task.dueDate,
          official: task.official,
          objective: task.objective?.title || null,
        })),
      },
      user.id,
    );
  }
}
