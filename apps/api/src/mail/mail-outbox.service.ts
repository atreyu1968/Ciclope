import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EmailOutboxStatus } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { IntegrationsService } from '../integrations/integrations.service';

type Recipient = {
  id: string;
  email: string;
};

type MailPreference = 'general' | 'reminder' | 'weekly';

@Injectable()
export class MailOutboxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MailOutboxService.name);
  private timer?: NodeJS.Timeout;
  private processing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly integrations: IntegrationsService,
  ) {}

  async onModuleInit() {
    await this.recoverInterruptedJobs();
    void this.processBatch();
    this.timer = setInterval(() => void this.processBatch(), 30_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async isConfigured(centerId: string) {
    return Boolean(await this.integrations.resendConfig(centerId));
  }

  private async filterRecipientsByPreference(
    recipients: Recipient[],
    preference: MailPreference,
  ) {
    const unique = [...new Map(recipients.map((recipient) => [recipient.id, recipient])).values()];
    if (!unique.length) return [];

    const allowed = await this.prisma.user.findMany({
      where: {
        id: { in: unique.map((recipient) => recipient.id) },
        active: true,
        emailNotifications: true,
        ...(preference === 'reminder' ? { reminderEmails: true } : {}),
        ...(preference === 'weekly' ? { weeklySummaryEmail: true } : {}),
      },
      select: { id: true },
    });
    const allowedIds = new Set(allowed.map((user) => user.id));
    return unique.filter((recipient) => allowedIds.has(recipient.id));
  }


  private async recoverInterruptedJobs() {
    const cutoff = new Date(Date.now() - 10 * 60 * 1000);
    await this.prisma.emailOutbox.updateMany({
      where: {
        status: EmailOutboxStatus.PROCESSING,
        updatedAt: { lt: cutoff },
      },
      data: {
        status: EmailOutboxStatus.QUEUED,
        nextAttemptAt: new Date(),
      },
    });
  }

  async enqueueDirect(
    centerId: string,
    subject: string,
    textBody: string,
    recipients: Recipient[],
    preference: MailPreference = 'general',
  ) {
    if (!(await this.isConfigured(centerId))) return { queued: 0, configured: false };

    const uniqueRecipients = await this.filterRecipientsByPreference(recipients, preference);
    if (!uniqueRecipients.length) return { queued: 0, configured: true };

    await this.prisma.emailOutbox.createMany({
      data: uniqueRecipients.map((recipient) => ({
        userId: recipient.id,
        recipientEmail: recipient.email,
        subject,
        textBody,
      })),
    });

    void this.processBatch();
    return { queued: uniqueRecipients.length, configured: true };
  }

  async enqueueDirectOnce(
    centerId: string,
    dedupeKey: string,
    subject: string,
    textBody: string,
    recipient: Recipient,
    preference: MailPreference = 'general',
  ) {
    if (!(await this.isConfigured(centerId))) return { queued: 0, configured: false };
    const allowed = await this.filterRecipientsByPreference([recipient], preference);
    if (!allowed.length) return { queued: 0, configured: true };

    const result = await this.prisma.emailOutbox.createMany({
      data: [{
        dedupeKey,
        userId: recipient.id,
        recipientEmail: recipient.email,
        subject,
        textBody,
      }],
      skipDuplicates: true,
    });

    if (result.count) void this.processBatch();
    return { queued: result.count, configured: true };
  }

  async enqueueCommunication(
    centerId: string,
    communicationId: string,
    title: string,
    body: string,
    recipients: Recipient[],
    prefix = 'CÍCLOPE FP',
  ) {
    if (!(await this.isConfigured(centerId))) return { queued: 0, configured: false };
    const allowedRecipients = await this.filterRecipientsByPreference(recipients, 'general');
    if (!allowedRecipients.length) return { queued: 0, configured: true };

    const appUrl = process.env.APP_BASE_URL?.replace(/\/$/, '');
    const footer = appUrl
      ? `\n\nConsulta la comunicación y responde, si procede, en: ${appUrl}/comunicaciones`
      : '';

    await this.prisma.emailOutbox.createMany({
      data: allowedRecipients.map((recipient) => ({
        communicationId,
        userId: recipient.id,
        recipientEmail: recipient.email,
        subject: `[${prefix}] ${title}`,
        textBody: `${body}${footer}`,
      })),
    });

    void this.processBatch();
    return { queued: allowedRecipients.length, configured: true };
  }

  async processBatch() {
    if (this.processing) return;
    this.processing = true;

    try {
      const jobs = await this.prisma.emailOutbox.findMany({
        where: {
          status: EmailOutboxStatus.QUEUED,
          nextAttemptAt: { lte: new Date() },
        },
        include: {
          user: { select: { centerId: true } },
          communication: {
            select: {
              academicYear: { select: { centerId: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
        take: 10,
      });

      for (const job of jobs) {
        const centerId = job.user?.centerId ?? job.communication?.academicYear.centerId;
        if (!centerId) {
          await this.prisma.emailOutbox.update({
            where: { id: job.id },
            data: {
              status: EmailOutboxStatus.FAILED,
              attempts: { increment: 1 },
              lastError: 'No se pudo determinar el centro para el envío.',
            },
          });
          continue;
        }

        if (!(await this.isConfigured(centerId))) {
          await this.prisma.emailOutbox.update({
            where: { id: job.id },
            data: { nextAttemptAt: new Date(Date.now() + 60 * 60_000) },
          });
          continue;
        }

        const claimed = await this.prisma.emailOutbox.updateMany({
          where: { id: job.id, status: EmailOutboxStatus.QUEUED },
          data: { status: EmailOutboxStatus.PROCESSING },
        });
        if (!claimed.count) continue;

        try {
          await this.integrations.sendResend(
            centerId,
            job.recipientEmail,
            job.subject,
            job.textBody,
            job.dedupeKey || `outbox-${job.id}`,
          );

          await this.prisma.emailOutbox.update({
            where: { id: job.id },
            data: {
              status: EmailOutboxStatus.SENT,
              sentAt: new Date(),
              attempts: { increment: 1 },
              lastError: null,
            },
          });
        } catch (error) {
          const attempts = job.attempts + 1;
          const finalFailure = attempts >= 5;
          const delays = [1, 5, 15, 60, 180];
          const delayMinutes = delays[Math.min(attempts - 1, delays.length - 1)];

          await this.prisma.emailOutbox.update({
            where: { id: job.id },
            data: {
              status: finalFailure ? EmailOutboxStatus.FAILED : EmailOutboxStatus.QUEUED,
              attempts,
              nextAttemptAt: new Date(Date.now() + delayMinutes * 60_000),
              lastError: (error instanceof Error ? error.message : 'Error de Resend').slice(0, 1000),
            },
          });
        }
      }
    } catch (error) {
      this.logger.error('Error procesando la cola de correo.', error instanceof Error ? error.stack : String(error));
    } finally {
      this.processing = false;
    }
  }
}
