import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  list(centerId: string) {
    return this.prisma.user.findMany({
      where: { centerId, active: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        networkCoordinations: {
          where: { academicYear: { isActive: true } },
          include: { network: true },
        },
        ciclopeCoordinations: {
          where: { academicYear: { isActive: true } },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }
}
