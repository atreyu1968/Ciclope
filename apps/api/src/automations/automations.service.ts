import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AnnualPlanStatus, CommunicationStatus, PlanTaskStatus } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { MailOutboxService } from '../mail/mail-outbox.service';

@Injectable()
export class AutomationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AutomationsService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailOutboxService,
  ) {}

  onModuleInit() {
    if (String(process.env.AUTOMATIONS_ENABLED ?? 'true').toLowerCase() === 'false') {
      this.logger.log('Automatizaciones desactivadas por configuración.');
      return;
    }
    const configuredMinutes = Number(process.env.AUTOMATIONS_INTERVAL_MINUTES ?? 60);
    const intervalMinutes = Number.isFinite(configuredMinutes)
      ? Math.max(15, configuredMinutes)
      : 60;

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

  private async run() {
    if (this.running) return;
    this.running = true;
    try {
      const taskQueued = await this.remindPlanTasks();
      const communicationQueued = await this.remindCommunicationDeadlines();
      if (taskQueued + communicationQueued > 0) {
        this.logger.log(`Recordatorios encolados: ${taskQueued + communicationQueued}.`);
      }
    } catch (error) {
      this.logger.error(
        'Error ejecutando automatizaciones.',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.running = false;
    }
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
          plan: {
            status: AnnualPlanStatus.ACTIVE,
            academicYear: { isActive: true },
          },
        },
        include,
      }),
      this.prisma.planTask.findMany({
        where: {
          ownerId: { not: null },
          status: { in: [PlanTaskStatus.TODO, PlanTaskStatus.IN_PROGRESS] },
          dueDate: { lt: now },
          plan: {
            status: AnnualPlanStatus.ACTIVE,
            academicYear: { isActive: true },
          },
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
        include: {
          user: { select: { id: true, email: true, firstName: true, active: true } },
        },
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
