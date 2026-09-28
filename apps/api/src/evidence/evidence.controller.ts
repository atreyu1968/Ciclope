import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { createReadStream, mkdirSync } from 'node:fs';
import { basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import { diskStorage } from 'multer';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionGuard } from '../auth/session.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CreateLinkEvidenceDto } from './dto/create-link-evidence.dto';
import { EvidenceService } from './evidence.service';

const ALLOWED_MIME_TYPES = new Set([
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
  'video/mp4',
]);

function uploadDirectory() {
  const dir = process.env.UPLOAD_DIR || '/tmp/ciclope-fp-uploads';
  mkdirSync(dir, { recursive: true });
  return dir;
}

@Controller('evidence')
@UseGuards(SessionGuard)
export class EvidenceController {
  constructor(private readonly evidence: EvidenceService) {}

  @Get('action/:actionId')
  list(@Param('actionId') actionId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.evidence.list(actionId, user);
  }

  @Post('action/:actionId/link')
  addLink(
    @Param('actionId') actionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateLinkEvidenceDto,
  ) {
    return this.evidence.addLink(actionId, user, dto.url, dto.title);
  }

  @Post('action/:actionId/file')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (_request, _file, callback) => callback(null, uploadDirectory()),
      filename: (_request, _file, callback) => callback(null, randomUUID()),
    }),
    limits: { fileSize: 25 * 1024 * 1024 },
    fileFilter: (_request, file, callback) => {
      if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
        callback(new Error('Tipo de archivo no permitido.'));
        return;
      }
      callback(null, true);
    },
  }))
  addFile(
    @Param('actionId') actionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.evidence.addFile(actionId, user, file);
  }

  @Get(':id/download')
  async download(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() response: Response,
  ) {
    const evidence = await this.evidence.fileForDownload(id, user);
    response.setHeader('Content-Type', evidence.mimeType || 'application/octet-stream');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(evidence.title || basename(evidence.path!))}`,
    );
    createReadStream(evidence.path!).pipe(response);
  }
}
