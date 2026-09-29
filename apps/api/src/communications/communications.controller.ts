import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { createReadStream, mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { basename, join } from 'node:path';
import { diskStorage } from 'multer';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SessionGuard } from '../auth/session.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CONTENT_WRITE_ROLES } from '../auth/role-policy';
import { CommunicationsService } from './communications.service';
import { CreateCommunicationDto } from './dto/create-communication.dto';
import { RespondCommunicationDto } from './dto/respond-communication.dto';

const PUBLISHERS = [
  'SUPERADMIN',
  'ADMIN_CENTRO',
  'DIRECCION',
  'COORDINADOR_CICLOPE',
  'COORD_INNOVACION',
  'COORD_EMPRENDIMIENTO',
  'COORD_IOP',
  'COORD_CALIDAD',
];

const COMMUNICATION_ATTACHMENT_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
]);

function communicationAttachmentDirectory() {
  const root = process.env.UPLOAD_DIR || '/tmp/ciclope-fp-uploads';
  const directory = join(root, 'communication-attachments');
  mkdirSync(directory, { recursive: true });
  return directory;
}

function communicationAttachmentMaxBytes() {
  const configured = Number(process.env.COMMUNICATION_ATTACHMENT_MAX_MB || '15');
  const mb = Number.isFinite(configured) ? Math.min(Math.max(configured, 1), 50) : 15;
  return mb * 1024 * 1024;
}

@Controller('communications')
@UseGuards(SessionGuard, RolesGuard)
export class CommunicationsController {
  constructor(private readonly communications: CommunicationsService) {}

  @Get('mail-status')
  @Roles(...PUBLISHERS)
  mailStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.communications.mailStatus(user.centerId);
  }

  @Post()
  @Roles(...PUBLISHERS)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCommunicationDto) {
    return this.communications.createAndPublish(user, dto);
  }

  @Post(':id/attachments')
  @Roles(...PUBLISHERS)
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (_request, _file, callback) => callback(null, communicationAttachmentDirectory()),
      filename: (_request, _file, callback) => callback(null, randomUUID()),
    }),
    limits: { fileSize: communicationAttachmentMaxBytes() },
    fileFilter: (_request, file, callback) => {
      if (!COMMUNICATION_ATTACHMENT_MIME_TYPES.has(file.mimetype)) {
        callback(new Error('Tipo de archivo adjunto no permitido.'), false);
        return;
      }
      callback(null, true);
    },
  }))
  addAttachment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.communications.addAttachment(user, id, file);
  }

  @Get(':id/attachments/:attachmentId/download')
  async downloadAttachment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Res() response: Response,
  ) {
    const attachment = await this.communications.attachmentForDownload(user, id, attachmentId);
    response.setHeader('Content-Type', attachment.mimeType || 'application/octet-stream');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(attachment.originalName || basename(attachment.path))}`,
    );
    createReadStream(attachment.path).pipe(response);
  }

  @Get('inbox')
  inbox(@CurrentUser() user: AuthenticatedUser) {
    return this.communications.inbox(user);
  }

  @Get('sent')
  @Roles(...PUBLISHERS)
  sent(@CurrentUser() user: AuthenticatedUser) {
    return this.communications.sent(user);
  }

  @Get('mail-jobs')
  @Roles(...PUBLISHERS)
  mailJobs(@CurrentUser() user: AuthenticatedUser) {
    return this.communications.mailJobs(user);
  }

  @Post('mail-jobs/:jobId/retry')
  @Roles(...PUBLISHERS)
  retryMailJob(
    @CurrentUser() user: AuthenticatedUser,
    @Param('jobId') jobId: string,
  ) {
    return this.communications.retryMailJob(user, jobId);
  }

  @Patch(':id/read')
  read(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.communications.markRead(user, id);
  }

  @Post(':id/respond')
  @Roles(...CONTENT_WRITE_ROLES)
  respond(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RespondCommunicationDto,
  ) {
    return this.communications.respond(user, id, dto.response);
  }

  @Post(':id/remind-pending')
  @Roles(...PUBLISHERS)
  remindPending(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.communications.remindPending(user, id);
  }
}
