import { Injectable } from '@nestjs/common';
import { ActionStatus, CommunicationStatus, PlanObjectiveStatus, PlanTaskStatus, ReportSnapshotStatus, StaffRequestStatus } from '../generated/prisma/client';
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
        nextPlanDeadline: null,
        openStaffRequests: 0,
        returnedOwnActions: 0,
        unreadCommunications: 0,
        communicationFollowups: 0,
        savedReportSnapshots: 0,
        inactiveNetworks: [],
        inactiveObjectives: [],
        estimatedMinutes: 0,
        agendaMinutes: 0,
        deferredPriorityCount: 0,
        agenda: [],
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
      nextPlanDeadline,
      openStaffRequests,
      returnedOwnActions,
      unreadCommunications,
      savedReportSnapshots,
      communications,
      recentActiveNetworkLinks,
      inactiveObjectiveCandidates,
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
      this.prisma.planTask.findFirst({
        where: {
          dueDate: {
            gte: new Date(),
            lte: new Date(Date.now() + 30 * 24 * 60 * 60_000),
          },
          status: { in: [PlanTaskStatus.TODO, PlanTaskStatus.IN_PROGRESS] },
          plan: {
            academicYearId: user.academicYearId,
            ...(global ? {} : { networkId: { in: user.coordinatorNetworkIds } }),
          },
        },
        select: {
          id: true,
          title: true,
          dueDate: true,
          official: true,
          plan: { select: { network: { select: { name: true } } } },
        },
        orderBy: { dueDate: 'asc' },
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
      this.prisma.reportSnapshot.count({
        where: {
          academicYearId: user.academicYearId,
          status: ReportSnapshotStatus.SAVED,
          ...(global
            ? {}
            : {
                OR: [
                  { createdById: user.id },
                  { networkId: { in: user.coordinatorNetworkIds } },
                ],
              }),
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
      this.prisma.actionNetwork.findMany({
        where: {
          ...(global ? {} : { networkId: { in: user.coordinatorNetworkIds } }),
          action: {
            academicYearId: user.academicYearId,
            status: ActionStatus.VALIDATED,
            activityDate: { gte: new Date(Date.now() - 30 * 24 * 60 * 60_000) },
          },
        },
        select: { networkId: true },
        distinct: ['networkId'],
      }),
      this.prisma.planObjective.findMany({
        where: {
          status: { in: [PlanObjectiveStatus.PLANNED, PlanObjectiveStatus.IN_PROGRESS] },
          plan: {
            academicYearId: user.academicYearId,
            ...(global ? {} : { networkId: { in: user.coordinatorNetworkIds } }),
          },
          actions: {
            none: {
              action: {
                status: ActionStatus.VALIDATED,
                activityDate: { gte: new Date(Date.now() - 30 * 24 * 60 * 60_000) },
              },
            },
          },
        },
        select: {
          id: true,
          title: true,
          plan: {
            select: {
              network: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { updatedAt: 'asc' },
        take: 20,
      }),
    ]);

    const inactivityMonitoringEnabled = Boolean(
      year && Date.now() - year.startsAt.getTime() >= 21 * 24 * 60 * 60_000,
    );
    const recentlyActiveNetworkIds = new Set(recentActiveNetworkLinks.map((item) => item.networkId));
    const inactiveNetworks = inactivityMonitoringEnabled
      ? coordinationNetworks
          .filter((network) => !recentlyActiveNetworkIds.has(network.id))
          .map((network) => ({ id: network.id, name: network.name }))
      : [];
    const inactiveObjectives = inactivityMonitoringEnabled
      ? inactiveObjectiveCandidates.map((objective) => ({
          id: objective.id,
          title: objective.title,
          network: objective.plan.network,
        }))
      : [];

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
      savedReportSnapshots * 2 +
      returnedOwnActions * 2 +
      inactiveNetworks.length * 2 +
      inactiveObjectives.length * 2 +
      Math.min(unreadCommunications, 10);

    const focus = [
      ...(openStaffRequests ? [{
        key: 'staff-requests',
        priority: 'high',
        title: `${openStaffRequests} consultas o propuestas del claustro abiertas`,
        href: '/coordinacion/buzon',
        estimatedMinutes: Math.min(15, Math.max(5, openStaffRequests * 3)),
        reason: 'Las consultas del claustro pueden bloquear trabajo de otras personas y conviene responderlas al comienzo de la sesión.',
      }] : []),
      ...(pendingActions ? [{
        key: 'pending-actions',
        priority: 'high',
        title: `${pendingActions} actuaciones pendientes de validar`,
        href: '/coordinacion/actuaciones',
        estimatedMinutes: Math.min(20, Math.max(5, pendingActions)),
        reason: 'Validar actuaciones consolida los datos de las redes y evita que se acumulen registros pendientes.',
      }] : []),
      ...(overduePlanTasks ? [{
        key: 'overdue-plan-tasks',
        priority: 'high',
        title: `${overduePlanTasks} tareas del plan anual fuera de plazo`,
        href: '/coordinacion/planes',
        estimatedMinutes: Math.min(15, Math.max(5, overduePlanTasks * 2)),
        reason: 'Hay compromisos del plan anual fuera de plazo; resolverlos reduce el riesgo de incumplir hitos de coordinación.',
      }] : []),
      ...(inactiveNetworks.length ? [{
        key: 'inactive-networks',
        priority: 'medium',
        title: `${inactiveNetworks.length} redes sin actividad validada en los últimos 30 días`,
        href: '/informes',
        estimatedMinutes: Math.min(10, Math.max(4, inactiveNetworks.length * 2)),
        reason: 'La falta de actividad reciente puede indicar que una red necesita impulso, registro de actuaciones o revisión del plan.',
      }] : []),
      ...(inactiveObjectives.length ? [{
        key: 'inactive-objectives',
        priority: 'medium',
        title: `${inactiveObjectives.length} objetivos sin actividad vinculada en los últimos 30 días`,
        href: '/coordinacion/planes',
        estimatedMinutes: Math.min(12, Math.max(4, inactiveObjectives.length * 2)),
        reason: 'Estos objetivos siguen abiertos pero no muestran actuaciones validadas recientes; conviene revisar su ejecución.',
      }] : []),
      ...(nextPlanDeadline?.dueDate ? [{
        key: 'next-plan-deadline',
        priority: nextPlanDeadline.official ? 'medium' : 'low',
        title: `${nextPlanDeadline.official ? 'Hito oficial' : 'Próxima tarea'}: ${nextPlanDeadline.title} · ${nextPlanDeadline.dueDate.toLocaleDateString('es-ES', { timeZone: 'Atlantic/Canary' })}`,
        href: '/coordinacion/planes',
        estimatedMinutes: 5,
        reason: 'Es la fecha más próxima del plan y revisarla ahora permite anticipar trabajo antes de que venza.',
      }] : []),
      ...(validatedWithoutEvidence ? [{
        key: 'missing-evidence',
        priority: 'medium',
        title: `${validatedWithoutEvidence} actuaciones validadas sin evidencia`,
        href: '/informes',
        estimatedMinutes: Math.min(10, Math.max(4, validatedWithoutEvidence)),
        reason: 'Las actuaciones sin evidencia debilitan la trazabilidad y la memoria final de las redes.',
      }] : []),
      ...(communicationFollowups ? [{
        key: 'communications-followup',
        priority: 'medium',
        title: `${communicationFollowups} comunicaciones con personas pendientes`,
        href: '/coordinacion/comunicaciones',
        estimatedMinutes: Math.min(10, Math.max(4, communicationFollowups * 2)),
        reason: 'Existen comunicaciones publicadas con lecturas o respuestas todavía pendientes.',
      }] : []),
      ...(savedReportSnapshots ? [{
        key: 'saved-reports',
        priority: 'medium',
        title: `${savedReportSnapshots} cortes de informe guardados pendientes de marcar como entregados`,
        href: '/informes/historico',
        estimatedMinutes: Math.min(10, Math.max(4, savedReportSnapshots * 2)),
        reason: 'Los cortes ya guardados deben revisarse o marcarse como presentados para cerrar correctamente el seguimiento.',
      }] : []),
      ...(returnedOwnActions ? [{
        key: 'returned-actions',
        priority: 'medium',
        title: `${returnedOwnActions} actuaciones tuyas devueltas para corrección`,
        href: '/actuaciones/mis-actuaciones',
        estimatedMinutes: Math.min(10, Math.max(4, returnedOwnActions * 2)),
        reason: 'Estas actuaciones necesitan corrección para volver al circuito de validación y no quedar fuera de los indicadores.',
      }] : []),
      ...(unreadCommunications ? [{
        key: 'unread-communications',
        priority: 'low',
        title: `${unreadCommunications} comunicaciones sin leer`,
        href: '/comunicaciones',
        estimatedMinutes: Math.min(10, Math.max(3, unreadCommunications)),
        reason: 'Revisar los mensajes sin leer evita perder avisos o solicitudes que afecten a la coordinación.',
      }] : []),
    ];

    let agendaMinutes = 0;
    const agenda = focus.flatMap((item, index) => {
      if (agendaMinutes >= 60) return [];
      const allocatedMinutes = Math.min(item.estimatedMinutes, 60 - agendaMinutes);
      agendaMinutes += allocatedMinutes;
      return [{
        ...item,
        order: index + 1,
        allocatedMinutes,
      }];
    });
    const deferredPriorityCount = Math.max(0, focus.length - agenda.length);

    return {
      activeYear: year,
      coordinationNetworks,
      pendingActions,
      pendingActionItems,
      validatedWithoutEvidence,
      overduePlanTasks,
      nextPlanDeadline,
      openStaffRequests,
      returnedOwnActions,
      unreadCommunications,
      communicationFollowups,
      savedReportSnapshots,
      inactiveNetworks,
      inactiveObjectives,
      communicationItems: communicationItems.slice(0, 5),
      estimatedMinutes: Math.min(rawMinutes, 120),
      agendaMinutes,
      deferredPriorityCount,
      agenda,
      focus,
    };
  }
}
