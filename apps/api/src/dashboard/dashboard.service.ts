import { Injectable } from '@nestjs/common';
import { ActionStatus, CommunicationStatus, PlanTaskStatus, StaffRequestStatus } from '../generated/prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  private isGlobalCoordinator(user: AuthenticatedUser) {
    return ['SUPERADMIN', 'ADMIN_CENTRO', 'DIRECCION', 'COORDINADOR_CICLOPE']
      .some((role) => user.roles.includes(role));
  }

  async forUser(user: AuthenticatedUser) {
    if (!user.academicYearId) {
      return {
        activeYear: null,
        coordinationNetworks: [],
        pendingActions: 0,
        validatedWithoutEvidence: 0,
        overduePlanTasks: 0,
        openStaffRequests: 0,
        returnedOwnActions: 0,
        unreadCommunications: 0,
        communicationFollowups: 0,
        estimatedMinutes: 0,
        focus: [],
      };
    }

    const global = this.isGlobalCoordinator(user);
    const coordinationNetworkFilter = !global
      ? { networks: { some: { networkId: { in: user.coordinatorNetworkIds } } } }
      : {};

    const [
      year,
      coordinationNetworks,
      pendingActions,
      pendingActionItems,
      validatedWithoutEvidence,
      overduePlanTasks,
      openStaffRequests,
      returnedOwnActions,
      unreadCommunications,
      communications,
    ] = await Promise.all([
      this.prisma.academicYear.findUnique({
        where: { id: user.academicYearId },
        select: { id: true, name: true, startsAt: true, endsAt: true },
      }),
      global
        ? this.prisma.network.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } })
        : this.prisma.network.findMany({
            where: { id: { in: user.coordinatorNetworkIds }, active: true },
            orderBy: { sortOrder: 'asc' },
          }),
      this.prisma.action.count({
        where: {
          academicYearId: user.academicYearId,
          status: ActionStatus.PENDING_VALIDATION,
          ...coordinationNetworkFilter,
        },
      }),
      this.prisma.action.findMany({
        where: {
          academicYearId: user.academicYearId,
          status: ActionStatus.PENDING_VALIDATION,
          ...coordinationNetworkFilter,
        },
        select: {
          id: true,
          title: true,
          createdAt: true,
          networks: { include: { network: true } },
        },
        orderBy: { createdAt: 'asc' },
        take: 5,
      }),
      this.prisma.action.count({
        where: {
          academicYearId: user.academicYearId,
          status: ActionStatus.VALIDATED,
          evidence: { none: {} },
          ...coordinationNetworkFilter,
        },
      }),
      this.prisma.planTask.count({
        where: {
          dueDate: { lt: new Date() },
          status: { in: [PlanTaskStatus.TODO, PlanTaskStatus.IN_PROGRESS] },
          plan: {
            academicYearId: user.academicYearId,
            ...(global ? {} : { networkId: { in: user.coordinatorNetworkIds } }),
          },
        },
      }),
      this.prisma.staffRequest.count({
        where: {
          academicYearId: user.academicYearId,
          status: { in: [StaffRequestStatus.NEW, StaffRequestStatus.IN_PROGRESS] },
          ...coordinationNetworkFilter,
        },
      }),
      this.prisma.action.count({
        where: {
          academicYearId: user.academicYearId,
          submittedById: user.id,
          status: ActionStatus.RETURNED,
        },
      }),
      this.prisma.communicationRecipient.count({
        where: {
          userId: user.id,
          readAt: null,
          communication: {
            academicYearId: user.academicYearId,
            status: CommunicationStatus.PUBLISHED,
          },
        },
      }),
      this.prisma.communication.findMany({
        where: {
          academicYearId: user.academicYearId,
          status: CommunicationStatus.PUBLISHED,
          ...(global ? {} : { originNetworkId: { in: user.coordinatorNetworkIds } }),
        },
        select: {
          id: true,
          title: true,
          responseRequired: true,
          recipients: {
            select: { readAt: true, respondedAt: true },
          },
        },
        orderBy: { publishedAt: 'desc' },
        take: 50,
      }),
    ]);

    const communicationItems = communications
      .map((communication) => {
        const pending = communication.recipients.filter((recipient) =>
          communication.responseRequired ? !recipient.respondedAt : !recipient.readAt,
        ).length;
        return { id: communication.id, title: communication.title, pending };
      })
      .filter((item) => item.pending > 0);

    const communicationFollowups = communicationItems.length;
    const rawMinutes =
      pendingActions * 1 +
      validatedWithoutEvidence * 1 +
      overduePlanTasks * 2 +
      openStaffRequests * 3 +
      communicationFollowups * 2 +
      returnedOwnActions * 2 +
      Math.min(unreadCommunications, 10);

    const focus = [
      ...(openStaffRequests ? [{
        key: 'staff-requests',
        priority: 'high',
        title: `${openStaffRequests} consultas o propuestas del claustro abiertas`,
        href: '/coordinacion/buzon',
      }] : []),
      ...(pendingActions ? [{
        key: 'pending-actions',
        priority: 'high',
        title: `${pendingActions} actuaciones pendientes de validar`,
        href: '/coordinacion/actuaciones',
      }] : []),
      ...(overduePlanTasks ? [{
        key: 'overdue-plan-tasks',
        priority: 'high',
        title: `${overduePlanTasks} tareas del plan anual fuera de plazo`,
        href: '/coordinacion',
      }] : []),
      ...(validatedWithoutEvidence ? [{
        key: 'missing-evidence',
        priority: 'medium',
        title: `${validatedWithoutEvidence} actuaciones validadas sin evidencia`,
        href: '/informes',
      }] : []),
      ...(communicationFollowups ? [{
        key: 'communications-followup',
        priority: 'medium',
        title: `${communicationFollowups} comunicaciones con personas pendientes`,
        href: '/coordinacion/comunicaciones',
      }] : []),
      ...(returnedOwnActions ? [{
        key: 'returned-actions',
        priority: 'medium',
        title: `${returnedOwnActions} actuaciones tuyas devueltas para corrección`,
        href: '/actuaciones/mis-actuaciones',
      }] : []),
      ...(unreadCommunications ? [{
        key: 'unread-communications',
        priority: 'low',
        title: `${unreadCommunications} comunicaciones sin leer`,
        href: '/comunicaciones',
      }] : []),
    ];

    return {
      activeYear: year,
      coordinationNetworks,
      pendingActions,
      pendingActionItems,
      validatedWithoutEvidence,
      overduePlanTasks,
      openStaffRequests,
      returnedOwnActions,
      unreadCommunications,
      communicationFollowups,
      communicationItems: communicationItems.slice(0, 5),
      estimatedMinutes: Math.min(rawMinutes, 120),
      focus,
    };
  }
}
