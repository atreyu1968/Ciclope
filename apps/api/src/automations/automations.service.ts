import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  ActionStatus,
  AnnualPlanStatus,
  CommunicationStatus,
  EmailOutboxStatus,
  PlanTaskStatus,
} from '../generated/prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { MailOutboxService } from '../mail/mail-outbox.service';

@Injectable()
export class AutomationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AutomationsService.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  private lastRunAt?: Date;
  private lastCompletedAt?: Date;
  private lastError?: string;
  private lastQueued = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailOutboxService,
  ) {}

  private enabled() {
    return String(process.env.AUTOMATIONS_ENABLED ?? 'true').toLowerCase() !== 'false';
  }

  private intervalMinutes() {
    const configured = Number(process.env.AUTOMATIONS_INTERVAL_MINUTES ?? 60);
    return Number.isFinite(configured) ? Math.max(15, configured) : 60;
  }

  onModuleInit() {
    if (!this.enabled()) {
      this.logger.log('Automatizaciones desactivadas por configuración.');
      return;
    }

    const intervalMinutes = this.intervalMinutes();
    void this.run();
    this.timer = setInterval(() => void this.run(), intervalMinutes * 60_000);
    this.timer.unref();
    this.logger.log(`Automatizaciones activas cada ${intervalMinutes} minutos.`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private appUrl(path: string) {
    const base = process.env.APP_BASE_URL?.replace(/\/$/, '');
    return base ? `${base}${path}` : '';
  }

  private formatDate(value: Date) {
    return new Intl.DateTimeFormat('es-ES', {
      dateStyle: 'long',
      timeZone: process.env.APP_TIME_ZONE || 'Atlantic/Canary',
    }).format(value);
  }

  private localDateKey(value = new Date()) {
    return new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: process.env.APP_TIME_ZONE || 'Atlantic/Canary',
    }).format(value);
  }

  private localWeekday(value = new Date()) {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      timeZone: process.env.APP_TIME_ZONE || 'Atlantic/Canary',
    }).format(value).toUpperCase().slice(0, 3);
  }

  private async run() {
    if (this.running || !this.enabled()) return;
    this.running = true;
    this.lastRunAt = new Date();
    this.lastError = undefined;

    try {
      const [taskQueued, communicationQueued, milestoneQueued, weeklyQueued] = await Promise.all([
        this.remindPlanTasks(),
        this.remindCommunicationDeadlines(),
        this.remindAcademicYearMilestones(),
        this.sendWeeklyCoordinationSummary(),
      ]);
      this.lastQueued = taskQueued + communicationQueued + milestoneQueued + weeklyQueued;
      this.lastCompletedAt = new Date();
      if (this.lastQueued > 0) {
        this.logger.log(`Recordatorios/resúmenes encolados: ${this.lastQueued}.`);
      }
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      this.logger.error(
        'Error ejecutando automatizaciones.',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.running = false;
    }
  }

  async status(user: AuthenticatedUser) {
    const now = new Date();
    const days = Math.max(1, Number(process.env.TASK_REMINDER_DAYS ?? 3) || 3);
    const until = new Date(now.getTime() + days * 24 * 60 * 60_000);

    const [overdueTasks, upcomingMilestones, failedMail, queuedMail] = await Promise.all([
      user.academicYearId
        ? this.prisma.planTask.count({
            where: {
              status: { in: [PlanTaskStatus.TODO, PlanTaskStatus.IN_PROGRESS] },
              dueDate: { lt: now },
              plan: { academicYearId: user.academicYearId, status: AnnualPlanStatus.ACTIVE },
            },
          })
        : 0,
      user.academicYearId
        ? this.prisma.academicYearMilestone.count({
            where: { academicYearId: user.academicYearId, dueDate: { gt: now, lte: until } },
          })
        : 0,
      this.prisma.emailOutbox.count({
        where: {
          status: EmailOutboxStatus.FAILED,
          OR: [
            { user: { centerId: user.centerId } },
            { communication: { academicYear: { centerId: user.centerId } } },
          ],
        },
      }),
      this.prisma.emailOutbox.count({
        where: {
          status: { in: [EmailOutboxStatus.QUEUED, EmailOutboxStatus.PROCESSING] },
          OR: [
            { user: { centerId: user.centerId } },
            { communication: { academicYear: { centerId: user.centerId } } },
          ],
        },
      }),
    ]);

    return {
      enabled: this.enabled(),
      running: this.running,
      intervalMinutes: this.intervalMinutes(),
      lastRunAt: this.lastRunAt,
      lastCompletedAt: this.lastCompletedAt,
      lastQueued: this.lastQueued,
      lastError: this.lastError,
      weeklySummaryWeekday: (process.env.WEEKLY_SUMMARY_WEEKDAY || 'MON').toUpperCase(),
      counters: {
        overdueTasks,
        upcomingMilestones,
        failedMail,
        queuedMail,
      },
    };
  }

  private async remindPlanTasks() {
    const now = new Date();
    const dueSoonDays = Math.max(1, Number(process.env.TASK_REMINDER_DAYS ?? 3) || 3);
    const dueSoonEnd = new Date(now.getTime() + dueSoonDays * 24 * 60 * 60_000);

    const include = {
      owner: { select: { id: true, email: true, firstName: true, lastName: true, active: true } },
      plan: {
        include: {
          network: { select: { name: true } },
          academicYear: { select: { centerId: true } },
        },
      },
    } as const;

    const [dueSoon, overdue] = await Promise.all([
      this.prisma.planTask.findMany({
        where: {
          ownerId: { not: null },
          status: { in: [PlanTaskStatus.TODO, PlanTaskStatus.IN_PROGRESS] },
          dueDate: { gt: now, lte: dueSoonEnd },
          plan: { status: AnnualPlanStatus.ACTIVE, academicYear: { isActive: true } },
        },
        include,
      }),
      this.prisma.planTask.findMany({
        where: {
          ownerId: { not: null },
          status: { in: [PlanTaskStatus.TODO, PlanTaskStatus.IN_PROGRESS] },
          dueDate: { lt: now },
          plan: { status: AnnualPlanStatus.ACTIVE, academicYear: { isActive: true } },
        },
        include,
      }),
    ]);

    let queued = 0;
    const planUrl = this.appUrl('/coordinacion/planes');

    for (const task of dueSoon) {
      if (!task.owner?.active || !task.dueDate) continue;
      const result = await this.mail.enqueueDirectOnce(
        task.plan.academicYear.centerId,
        `plan-task:${task.id}:due-soon:${task.dueDate.toISOString()}`,
        `[CÍCLOPE FP] Tarea próxima: ${task.title}`,
        [
          `Hola ${task.owner.firstName},`,
          '',
          `La tarea “${task.title}” del plan de ${task.plan.network.name} vence el ${this.formatDate(task.dueDate)}.`,
          task.description ? `Detalle: ${task.description}` : '',
          planUrl ? `Consulta la planificación en: ${planUrl}` : '',
        ].filter(Boolean).join('\n'),
        { id: task.owner.id, email: task.owner.email },
      );
      queued += result.queued;
    }

    for (const task of overdue) {
      if (!task.owner?.active || !task.dueDate) continue;
      const result = await this.mail.enqueueDirectOnce(
        task.plan.academicYear.centerId,
        `plan-task:${task.id}:overdue:${task.dueDate.toISOString()}`,
        `[CÍCLOPE FP] Tarea vencida: ${task.title}`,
        [
          `Hola ${task.owner.firstName},`,
          '',
          `La tarea “${task.title}” del plan de ${task.plan.network.name} venció el ${this.formatDate(task.dueDate)} y continúa pendiente.`,
          task.description ? `Detalle: ${task.description}` : '',
          planUrl ? `Actualiza su estado en: ${planUrl}` : '',
        ].filter(Boolean).join('\n'),
        { id: task.owner.id, email: task.owner.email },
      );
      queued += result.queued;
    }

    return queued;
  }

  private async remindAcademicYearMilestones() {
    const now = new Date();
    const days = Math.max(1, Number(process.env.MILESTONE_REMINDER_DAYS ?? 7) || 7);
    const until = new Date(now.getTime() + days * 24 * 60 * 60_000);
    const milestones = await this.prisma.academicYearMilestone.findMany({
      where: {
        dueDate: { gt: now, lte: until },
        academicYear: { isActive: true },
      },
      include: {
        academicYear: {
          include: {
            networkCoordinators: {
              where: { user: { active: true } },
              include: { user: { select: { id: true, email: true, firstName: true } } },
            },
            ciclopeCoordinators: {
              where: { user: { active: true } },
              include: { user: { select: { id: true, email: true, firstName: true } } },
            },
          },
        },
      },
    });

    let queued = 0;
    const planUrl = this.appUrl('/coordinacion/planes');

    for (const milestone of milestones) {
      const recipients = new Map<string, { id: string; email: string; firstName: string }>();
      for (const assignment of milestone.academicYear.networkCoordinators) {
        recipients.set(assignment.user.id, assignment.user);
      }
      for (const assignment of milestone.academicYear.ciclopeCoordinators) {
        recipients.set(assignment.user.id, assignment.user);
      }

      for (const recipient of recipients.values()) {
        const result = await this.mail.enqueueDirectOnce(
          milestone.academicYear.centerId,
          `academic-milestone:${milestone.id}:${recipient.id}:${milestone.dueDate.toISOString()}`,
          `[CÍCLOPE FP] Hito próximo: ${milestone.title}`,
          [
            `Hola ${recipient.firstName},`,
            '',
            `El hito “${milestone.title}” vence el ${this.formatDate(milestone.dueDate)}.`,
            milestone.description ? `Detalle: ${milestone.description}` : '',
            planUrl ? `Revisa la planificación en: ${planUrl}` : '',
          ].filter(Boolean).join('\n'),
          { id: recipient.id, email: recipient.email },
        );
        queued += result.queued;
      }
    }

    return queued;
  }

  private async sendWeeklyCoordinationSummary() {
    const configuredDay = (process.env.WEEKLY_SUMMARY_WEEKDAY || 'MON').toUpperCase().slice(0, 3);
    if (this.localWeekday() !== configuredDay) return 0;

    const years = await this.prisma.academicYear.findMany({
      where: { isActive: true },
      include: {
        networkCoordinators: {
          where: { user: { active: true } },
          include: { user: { select: { id: true, email: true, firstName: true } } },
        },
        ciclopeCoordinators: {
          where: { user: { active: true } },
          include: { user: { select: { id: true, email: true, firstName: true } } },
        },
      },
    });

    let queued = 0;
    const dashboardUrl = this.appUrl('/coordinacion');
    const now = new Date();

    for (const year of years) {
      const recipients = new Map<string, {
        id: string;
        email: string;
        firstName: string;
        global: boolean;
        networkIds: Set<string>;
      }>();

      for (const assignment of year.networkCoordinators) {
        const current = recipients.get(assignment.user.id) ?? {
          ...assignment.user,
          global: false,
          networkIds: new Set<string>(),
        };
        current.networkIds.add(assignment.networkId);
        recipients.set(assignment.user.id, current);
      }
      for (const assignment of year.ciclopeCoordinators) {
        const current = recipients.get(assignment.user.id) ?? {
          ...assignment.user,
          global: true,
          networkIds: new Set<string>(),
        };
        current.global = true;
        recipients.set(assignment.user.id, current);
      }

      for (const recipient of recipients.values()) {
        const networkFilter = recipient.global
          ? {}
          : { networks: { some: { networkId: { in: [...recipient.networkIds] } } } };

        const [pendingActions, overdueTasks, communicationFollowups] = await Promise.all([
          this.prisma.action.count({
            where: {
              academicYearId: year.id,
              status: ActionStatus.PENDING_VALIDATION,
              ...networkFilter,
            },
          }),
          this.prisma.planTask.count({
            where: {
              ownerId: recipient.id,
              status: { in: [PlanTaskStatus.TODO, PlanTaskStatus.IN_PROGRESS] },
              dueDate: { lt: now },
              plan: { academicYearId: year.id, status: AnnualPlanStatus.ACTIVE },
            },
          }),
          this.prisma.communication.count({
            where: {
              academicYearId: year.id,
              status: CommunicationStatus.PUBLISHED,
              responseRequired: true,
              ...(recipient.global ? {} : { originNetworkId: { in: [...recipient.networkIds] } }),
              recipients: { some: { respondedAt: null } },
            },
          }),
        ]);

        if (pendingActions + overdueTasks + communicationFollowups === 0) continue;

        const result = await this.mail.enqueueDirectOnce(
          year.centerId,
          `weekly-coordination:${recipient.id}:${this.localDateKey()}`,
          '[CÍCLOPE FP] Resumen semanal de coordinación',
          [
            `Hola ${recipient.firstName},`,
            '',
            `Resumen del curso ${year.name}:`,
            `• ${pendingActions} actuaciones pendientes de validación.`,
            `• ${overdueTasks} tareas asignadas vencidas.`,
            `• ${communicationFollowups} comunicaciones con respuestas pendientes.`,
            '',
            dashboardUrl ? `Abre “Mi hora de coordinación” para priorizar: ${dashboardUrl}` : '',
          ].filter(Boolean).join('\n'),
          { id: recipient.id, email: recipient.email },
        );
        queued += result.queued;
      }
    }

    return queued;
  }

  private async remindCommunicationDeadlines() {
    const now = new Date();
    const warningHours = Math.max(1, Number(process.env.COMMUNICATION_REMINDER_HOURS ?? 24) || 24);
    const warningEnd = new Date(now.getTime() + warningHours * 60 * 60_000);
    const overdueCutoff = new Date(now.getTime() - 14 * 24 * 60 * 60_000);

    const include = {
      originNetwork: { select: { name: true } },
      academicYear: { select: { centerId: true } },
      recipients: {
        where: { respondedAt: null },
        include: { user: { select: { id: true, email: true, firstName: true, active: true } } },
      },
    } as const;

    const [dueSoon, overdue] = await Promise.all([
      this.prisma.communication.findMany({
        where: {
          status: CommunicationStatus.PUBLISHED,
          responseRequired: true,
          deadline: { gt: now, lte: warningEnd },
          academicYear: { isActive: true },
        },
        include,
      }),
      this.prisma.communication.findMany({
        where: {
          status: CommunicationStatus.PUBLISHED,
          responseRequired: true,
          deadline: { gte: overdueCutoff, lt: now },
          academicYear: { isActive: true },
        },
        include,
      }),
    ]);

    let queued = 0;
    const inboxUrl = this.appUrl('/comunicaciones');

    for (const communication of dueSoon) {
      if (!communication.deadline) continue;
      for (const recipient of communication.recipients) {
        if (!recipient.user.active) continue;
        const result = await this.mail.enqueueDirectOnce(
          communication.academicYear.centerId,
          `communication:${communication.id}:due-soon:${recipient.user.id}:${communication.deadline.toISOString()}`,
          `[CÍCLOPE FP] Respuesta pendiente: ${communication.title}`,
          [
            `Hola ${recipient.user.firstName},`,
            '',
            `La comunicación “${communication.title}” requiere respuesta antes del ${this.formatDate(communication.deadline)}.`,
            communication.originNetwork ? `Red: ${communication.originNetwork.name}.` : '',
            inboxUrl ? `Puedes responder en: ${inboxUrl}` : '',
          ].filter(Boolean).join('\n'),
          { id: recipient.user.id, email: recipient.user.email },
        );
        queued += result.queued;
      }
    }

    for (const communication of overdue) {
      if (!communication.deadline) continue;
      for (const recipient of communication.recipients) {
        if (!recipient.user.active) continue;
        const result = await this.mail.enqueueDirectOnce(
          communication.academicYear.centerId,
          `communication:${communication.id}:overdue:${recipient.user.id}:${communication.deadline.toISOString()}`,
          `[CÍCLOPE FP] Plazo vencido: ${communication.title}`,
          [
            `Hola ${recipient.user.firstName},`,
            '',
            `La comunicación “${communication.title}” sigue pendiente de respuesta y su plazo venció el ${this.formatDate(communication.deadline)}.`,
            communication.originNetwork ? `Red: ${communication.originNetwork.name}.` : '',
            inboxUrl ? `Puedes responder en: ${inboxUrl}` : '',
          ].filter(Boolean).join('\n'),
          { id: recipient.user.id, email: recipient.user.email },
        );
        queued += result.queued;
      }
    }

    return queued;
  }
}
