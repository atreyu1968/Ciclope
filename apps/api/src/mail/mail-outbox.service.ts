import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import nodemailer, { Transporter } from 'nodemailer';
import { EmailOutboxStatus } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';

type Recipient = {
  id: string;
  email: string;
};

@Injectable()
export class MailOutboxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MailOutboxService.name);
  private timer?: NodeJS.Timeout;
  private transporter?: Transporter;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    this.configureTransport();
    await this.recoverInterruptedJobs();

    if (this.transporter) {
      void this.processBatch();
      this.timer = setInterval(() => void this.processBatch(), 30_000);
      this.timer.unref();
    } else {
      this.logger.warn('SMTP no configurado. Las comunicaciones seguirán disponibles en el portal, pero no se enviarán avisos por correo.');
    }
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  isConfigured() {
    return Boolean(this.transporter);
  }

  private configureTransport() {
    const host = process.env.SMTP_HOST;
    const from = process.env.SMTP_FROM;
    if (!host || !from) return;

    const port = Number(process.env.SMTP_PORT ?? 587);
    const secure = String(process.env.SMTP_SECURE ?? 'false').toLowerCase() === 'true';
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user ? { user, pass: pass ?? '' } : undefined,
    });
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
    subject: string,
    textBody: string,
    recipients: Recipient[],
  ) {
    const uniqueRecipients = [...new Map(recipients.map((recipient) => [recipient.id, recipient])).values()];
    if (!uniqueRecipients.length) return { queued: 0 };

    await this.prisma.emailOutbox.createMany({
      data: uniqueRecipients.map((recipient) => ({
        userId: recipient.id,
        recipientEmail: recipient.email,
        subject,
        textBody,
      })),
    });

    if (this.transporter) void this.processBatch();
    return { queued: uniqueRecipients.length };
  }

  async enqueueCommunication(
    communicationId: string,
    title: string,
    body: string,
    recipients: Recipient[],
    prefix = 'CÍCLOPE FP',
  ) {
    if (!recipients.length) return { queued: 0 };

    const appUrl = process.env.APP_BASE_URL?.replace(/\/$/, '');
    const footer = appUrl
      ? `\n\nConsulta la comunicación y responde, si procede, en: ${appUrl}/comunicaciones`
      : '';

    await this.prisma.emailOutbox.createMany({
      data: recipients.map((recipient) => ({
        communicationId,
        userId: recipient.id,
        recipientEmail: recipient.email,
        subject: `[${prefix}] ${title}`,
        textBody: `${body}${footer}`,
      })),
    });

    if (this.transporter) void this.processBatch();
    return { queued: recipients.length };
  }

  async processBatch() {
    if (!this.transporter) return;

    const jobs = await this.prisma.emailOutbox.findMany({
      where: {
        status: EmailOutboxStatus.QUEUED,
        nextAttemptAt: { lte: new Date() },
      },
      orderBy: { createdAt: 'asc' },
      take: 10,
    });

    for (const job of jobs) {
      const claimed = await this.prisma.emailOutbox.updateMany({
        where: { id: job.id, status: EmailOutboxStatus.QUEUED },
        data: { status: EmailOutboxStatus.PROCESSING },
      });
      if (!claimed.count) continue;

      try {
        await this.transporter.sendMail({
          from: process.env.SMTP_FROM,
          to: job.recipientEmail,
          subject: job.subject,
          text: job.textBody,
        });

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
            lastError: (error instanceof Error ? error.message : 'Error SMTP').slice(0, 1000),
          },
        });
      }
    }
  }
}
