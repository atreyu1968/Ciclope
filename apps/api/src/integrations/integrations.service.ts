import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { SecretCryptoService } from './secret-crypto.service';
import { UpdateAiDto } from './dto/update-ai.dto';
import { UpdateResendDto } from './dto/update-resend.dto';

type AiMessage = { role: 'system' | 'user'; content: string };

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: SecretCryptoService,
  ) {}

  private async settings(centerId: string) {
    return this.prisma.centerIntegrationSettings.upsert({
      where: { centerId },
      update: {},
      create: { centerId },
    });
  }

  async publicSettings(centerId: string) {
    const settings = await this.settings(centerId);
    return {
      resend: {
        enabled: settings.resendEnabled,
        configured: Boolean(settings.resendApiKeyEncrypted && settings.resendFromEmail),
        fromEmail: settings.resendFromEmail,
        fromName: settings.resendFromName,
      },
      ai: {
        enabled: settings.aiEnabled,
        configured: Boolean(settings.aiApiKeyEncrypted && settings.aiBaseUrl && settings.aiModel),
        providerName: settings.aiProviderName,
        baseUrl: settings.aiBaseUrl,
        model: settings.aiModel,
      },
    };
  }

  async updateResend(centerId: string, dto: UpdateResendDto, actorId?: string) {
    const current = await this.settings(centerId);
    const apiKeyEncrypted = dto.apiKey?.trim()
      ? this.crypto.encrypt(dto.apiKey.trim())
      : current.resendApiKeyEncrypted;

    if (dto.enabled && !apiKeyEncrypted) {
      throw new BadRequestException('Introduce una API Key de Resend antes de activar el correo.');
    }

    await this.prisma.$transaction([
      this.prisma.centerIntegrationSettings.update({
        where: { centerId },
        data: {
          resendEnabled: dto.enabled,
          resendApiKeyEncrypted: apiKeyEncrypted,
          resendFromEmail: dto.fromEmail.trim().toLowerCase(),
          resendFromName: dto.fromName.trim(),
        },
      }),
      this.prisma.auditLog.create({
        data: {
          centerId,
          actorId,
          action: 'RESEND_SETTINGS_UPDATED',
          entityType: 'CenterIntegrationSettings',
          entityId: centerId,
          details: {
            enabled: dto.enabled,
            fromEmail: dto.fromEmail.trim().toLowerCase(),
            fromName: dto.fromName.trim(),
            apiKeyChanged: Boolean(dto.apiKey?.trim()),
          },
        },
      }),
    ]);

    return this.publicSettings(centerId);
  }

  async updateAi(centerId: string, dto: UpdateAiDto, actorId?: string) {
    const current = await this.settings(centerId);
    const apiKeyEncrypted = dto.apiKey?.trim()
      ? this.crypto.encrypt(dto.apiKey.trim())
      : current.aiApiKeyEncrypted;

    if (dto.enabled && !apiKeyEncrypted) {
      throw new BadRequestException('Introduce una API Key de IA antes de activar la integración.');
    }

    await this.prisma.$transaction([
      this.prisma.centerIntegrationSettings.update({
        where: { centerId },
        data: {
          aiEnabled: dto.enabled,
          aiApiKeyEncrypted: apiKeyEncrypted,
          aiProviderName: dto.providerName.trim(),
          aiBaseUrl: dto.baseUrl.trim().replace(/\/$/, ''),
          aiModel: dto.model.trim(),
        },
      }),
      this.prisma.auditLog.create({
        data: {
          centerId,
          actorId,
          action: 'AI_SETTINGS_UPDATED',
          entityType: 'CenterIntegrationSettings',
          entityId: centerId,
          details: {
            enabled: dto.enabled,
            providerName: dto.providerName.trim(),
            baseUrl: dto.baseUrl.trim().replace(/\/$/, ''),
            model: dto.model.trim(),
            apiKeyChanged: Boolean(dto.apiKey?.trim()),
          },
        },
      }),
    ]);

    return this.publicSettings(centerId);
  }

  async resendConfig(centerId: string) {
    const settings = await this.settings(centerId);
    if (
      !settings.resendEnabled ||
      !settings.resendApiKeyEncrypted ||
      !settings.resendFromEmail
    ) return null;

    return {
      apiKey: this.crypto.decrypt(settings.resendApiKeyEncrypted)!,
      fromEmail: settings.resendFromEmail,
      fromName: settings.resendFromName || 'CÍCLOPE FP',
    };
  }

  async aiConfig(centerId: string) {
    const settings = await this.settings(centerId);
    if (
      !settings.aiEnabled ||
      !settings.aiApiKeyEncrypted ||
      !settings.aiBaseUrl ||
      !settings.aiModel
    ) return null;

    return {
      apiKey: this.crypto.decrypt(settings.aiApiKeyEncrypted)!,
      providerName: settings.aiProviderName || 'IA',
      baseUrl: settings.aiBaseUrl,
      model: settings.aiModel,
    };
  }

  async sendResend(
    centerId: string,
    to: string,
    subject: string,
    text: string,
    idempotencyKey?: string,
  ) {
    const config = await this.resendConfig(centerId);
    if (!config) throw new ServiceUnavailableException('Resend no está configurado para este centro.');

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        'content-type': 'application/json',
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey.slice(0, 256) } : {}),
      },
      body: JSON.stringify({
        from: `${config.fromName} <${config.fromEmail}>`,
        to: [to],
        subject,
        text,
      }),
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = typeof body?.message === 'string' ? body.message : `HTTP ${response.status}`;
      throw new ServiceUnavailableException(`Resend rechazó el envío: ${detail}`);
    }
    return body;
  }

  async testResend(centerId: string, recipientEmail: string) {
    await this.sendResend(
      centerId,
      recipientEmail,
      '[CÍCLOPE FP] Prueba de correo',
      'La integración con Resend funciona correctamente.',
      `ciclope-resend-test-${centerId}-${Date.now()}`,
    );
    return { ok: true };
  }

  private async aiRequest(centerId: string, messages: AiMessage[], temperature = 0.2) {
    const inputChars = messages.reduce((sum, message) => sum + message.content.length, 0);
    if (inputChars > 100_000) {
      throw new BadRequestException('La solicitud de IA supera el tamaño máximo permitido.');
    }

    const config = await this.aiConfig(centerId);
    if (!config) throw new ServiceUnavailableException('La API de IA no está configurada para este centro.');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    let response: Response;
    try {
      response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${config.apiKey}`,
          'content-type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: config.model,
          messages,
          temperature,
          max_tokens: 3000,
        }),
      });
    } catch (cause) {
      if (cause instanceof Error && cause.name === 'AbortError') {
        throw new ServiceUnavailableException('La API de IA agotó el tiempo máximo de respuesta de 30 segundos.');
      }
      throw new ServiceUnavailableException('No se pudo conectar con la API de IA configurada.');
    } finally {
      clearTimeout(timeout);
    }

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = typeof body?.error?.message === 'string'
        ? body.error.message
        : typeof body?.message === 'string'
          ? body.message
          : `HTTP ${response.status}`;
      throw new ServiceUnavailableException(`La API de IA devolvió un error: ${detail}`);
    }

    const content = body?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new ServiceUnavailableException('La API de IA no devolvió texto interpretable.');
    }
    return content.trim().slice(0, 40_000);
  }

  private async aiFeature(
    centerId: string,
    feature: string,
    messages: AiMessage[],
    actorId?: string,
    temperature = 0.2,
  ) {
    const inputChars = messages.reduce((sum, message) => sum + message.content.length, 0);
    try {
      const text = await this.aiRequest(centerId, messages, temperature);
      await this.prisma.auditLog.create({
        data: {
          centerId,
          actorId,
          action: 'AI_FEATURE_USED',
          entityType: 'AI',
          entityId: feature,
          details: {
            feature,
            success: true,
            inputChars,
            outputChars: text.length,
          },
        },
      }).catch(() => undefined);
      return {
        text,
        requiresHumanReview: true,
        notice: 'Borrador generado con IA. Revisa y valida el contenido antes de utilizarlo.',
      };
    } catch (error) {
      await this.prisma.auditLog.create({
        data: {
          centerId,
          actorId,
          action: 'AI_FEATURE_USED',
          entityType: 'AI',
          entityId: feature,
          details: {
            feature,
            success: false,
            inputChars,
            errorType: error instanceof Error ? error.name : 'UnknownError',
          },
        },
      }).catch(() => undefined);
      throw error;
    }
  }

  async testAi(centerId: string) {
    const content = await this.aiRequest(centerId, [
      { role: 'system', content: 'Responde de forma muy breve y profesional en español de España.' },
      { role: 'user', content: 'Responde únicamente: Integración de IA operativa.' },
    ], 0);
    return { ok: true, response: content };
  }

  async interpretReport(centerId: string, report: unknown, actorId?: string) {
    const result = await this.aiFeature(centerId, 'REPORT_INTERPRETATION', [
      {
        role: 'system',
        content: [
          'Eres un asistente técnico de gestión de Formación Profesional.',
          'Redacta en español de España, con tono institucional y objetivo.',
          'Interpreta exclusivamente los datos proporcionados.',
          'No inventes causas, porcentajes, participantes ni conclusiones no respaldadas.',
          'Distingue hechos observados de posibles líneas de mejora.',
          'Estructura la respuesta en: lectura general, indicadores destacados, alertas y líneas de seguimiento.',
        ].join(' '),
      },
      {
        role: 'user',
        content: `Interpreta estos datos agregados de CÍCLOPE FP:\n\n${JSON.stringify(report)}`,
      },
    ], actorId);
    return { ...result, mode: 'interpretation' };
  }

  async draftReport(centerId: string, report: unknown, actorId?: string) {
    const result = await this.aiFeature(centerId, 'REPORT_DRAFT', [
      {
        role: 'system',
        content: [
          'Eres un redactor técnico especializado en memorias institucionales de Formación Profesional.',
          'Escribe en español de España, con estilo formal, cohesionado y apto para revisión y firma.',
          'Utiliza exclusivamente los datos proporcionados y no inventes hechos, causas o resultados.',
          'Cuando un dato no permita concluir causalidad, limita la redacción a describirlo.',
          'Redacta un borrador con: introducción, actuaciones realizadas, participación, evidencias, evolución temporal, seguimiento de objetivos, aspectos pendientes, valoración técnica y propuestas de mejora.',
          'Evita lenguaje promocional, exageraciones y repeticiones.',
        ].join(' '),
      },
      {
        role: 'user',
        content: `Redacta un borrador de memoria a partir de estos datos agregados de CÍCLOPE FP:\n\n${JSON.stringify(report)}`,
      },
    ], actorId, 0.3);
    return { ...result, mode: 'draft' };
  }

  async draftCommunication(centerId: string, context: unknown, actorId?: string) {
    return this.aiFeature(centerId, 'COMMUNICATION_DRAFT', [
      {
        role: 'system',
        content: [
          'Eres un asistente de comunicación institucional para un centro de Formación Profesional.',
          'Redacta en español de España, con tono claro, profesional y cercano.',
          'No inventes fechas, destinatarios, normativa, acuerdos ni compromisos.',
          'Devuelve un borrador con una primera línea que empiece por TÍTULO: y después el cuerpo del mensaje.',
          'El texto debe ser directamente editable por la persona coordinadora antes de su publicación.',
        ].join(' '),
      },
      {
        role: 'user',
        content: `Prepara un borrador usando exclusivamente este contexto:\n\n${JSON.stringify(context)}`,
      },
    ], actorId, 0.35);
  }

  async summarizeStaffInbox(centerId: string, context: unknown, actorId?: string) {
    return this.aiFeature(centerId, 'STAFF_INBOX_SUMMARY', [
      {
        role: 'system',
        content: [
          'Eres un asistente de coordinación de Formación Profesional.',
          'Resume únicamente las consultas proporcionadas, sin identificar ni perfilar a las personas.',
          'Prioriza asuntos abiertos, bloqueos, vencimientos y temas repetidos.',
          'Distingue hechos de sugerencias y no inventes causas.',
          'Estructura en: resumen ejecutivo, asuntos que requieren acción, temas recurrentes y siguiente paso sugerido.',
        ].join(' '),
      },
      {
        role: 'user',
        content: `Resume este buzón anonimizado de coordinación:\n\n${JSON.stringify(context)}`,
      },
    ], actorId, 0.2);
  }

  async proposePlanWork(centerId: string, context: unknown, actorId?: string) {
    return this.aiFeature(centerId, 'PLAN_DRAFT_SUGGESTIONS', [
      {
        role: 'system',
        content: [
          'Eres un asistente técnico para planificación anual de redes de Formación Profesional.',
          'Propón borradores concretos de objetivos y tareas a partir exclusivamente del plan proporcionado.',
          'No modifiques el plan y no des por aprobada ninguna propuesta.',
          'Para cada objetivo sugerido indica título, descripción, posible métrica y meta solo cuando se pueda justificar.',
          'Para cada tarea sugerida indica título, finalidad y relación con el objetivo.',
          'Evita duplicar objetivos o tareas ya existentes.',
        ].join(' '),
      },
      {
        role: 'user',
        content: `Propón borradores de trabajo para este plan:\n\n${JSON.stringify(context)}`,
      },
    ], actorId, 0.3);
  }
}
