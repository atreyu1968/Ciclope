import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { unlink } from 'node:fs/promises';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class EvidenceService {
  constructor(private readonly prisma: PrismaService) {}

  private isGlobal(user: AuthenticatedUser) {
    return ['SUPERADMIN', 'ADMIN_CENTRO', 'DIRECCION', 'COORDINADOR_CICLOPE']
      .some((role) => user.roles.includes(role));
  }

  private async assertActionAccess(actionId: string, user: AuthenticatedUser) {
    const action = await this.prisma.action.findUnique({
      where: { id: actionId },
      include: { academicYear: true, networks: true },
    });
    if (!action || action.academicYear.centerId !== user.centerId) {
      throw new NotFoundException('Actuación no encontrada.');
    }
    if (action.academicYearId !== user.academicYearId) {
      throw new ForbiddenException('La actuación pertenece a otro curso académico.');
    }

    const owner = action.submittedById === user.id;
    const coordinator = action.networks.some((item) => user.coordinatorNetworkIds.includes(item.networkId));
    if (!owner && !coordinator && !this.isGlobal(user)) {
      throw new ForbiddenException('No tienes acceso a las evidencias de esta actuación.');
    }
    return action;
  }

  async list(actionId: string, user: AuthenticatedUser) {
    await this.assertActionAccess(actionId, user);
    return this.prisma.evidence.findMany({
      where: { actionId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addLink(actionId: string, user: AuthenticatedUser, url: string, title?: string) {
    await this.assertActionAccess(actionId, user);
    return this.prisma.evidence.create({
      data: {
        actionId,
        uploadedById: user.id,
        kind: 'LINK',
        title: title?.trim() || url,
        url,
      },
    });
  }

  async addFile(actionId: string, user: AuthenticatedUser, file: Express.Multer.File) {
    try {
      await this.assertActionAccess(actionId, user);
      return await this.prisma.evidence.create({
        data: {
          actionId,
          uploadedById: user.id,
          kind: 'FILE',
          title: file.originalname,
          path: file.path,
          mimeType: file.mimetype,
          sizeBytes: file.size,
        },
      });
    } catch (error) {
      await unlink(file.path).catch(() => undefined);
      throw error;
    }
  }

  async fileForDownload(evidenceId: string, user: AuthenticatedUser) {
    const evidence = await this.prisma.evidence.findUnique({
      where: { id: evidenceId },
      include: {
        action: {
          include: { academicYear: true, networks: true },
        },
      },
    });

    if (!evidence || evidence.kind !== 'FILE' || !evidence.path) {
      throw new NotFoundException('Archivo no encontrado.');
    }

    if (evidence.action.academicYear.centerId !== user.centerId || evidence.action.academicYearId !== user.academicYearId) {
      throw new ForbiddenException('No tienes acceso a este archivo.');
    }

    const owner = evidence.action.submittedById === user.id;
    const coordinator = evidence.action.networks.some((item) => user.coordinatorNetworkIds.includes(item.networkId));
    if (!owner && !coordinator && !this.isGlobal(user)) {
      throw new ForbiddenException('No tienes acceso a este archivo.');
    }

    return evidence;
  }
}
