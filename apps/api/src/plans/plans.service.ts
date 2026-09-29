import { BadRequestException, ForbiddenException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import {
  ActionStatus,
  AnnualPlanStatus,
  PlanMetric,
  PlanObjectiveStatus,
  PlanTaskStatus,
} from '../generated/prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { CreateObjectiveDto } from './dto/create-objective.dto';
import { CreatePlanDto } from './dto/create-plan.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { officialPlanDeadlines } from './official-deadlines.config';

@Injectable()
export class PlansService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    const plans = await this.prisma.annualPlan.findMany({
      include: {
        academicYear: { select: { id: true, name: true } },
        network: { select: { id: true } },
      },
    });

    for (const plan of plans) {
      await this.ensureOfficialDeadlines(
        plan.id,
        plan.academicYear.id,
        plan.academicYear.name,
        plan.network.id,
      );
      await this.ensureSharedMilestones(
        plan.id,
        plan.academicYear.id,
        plan.network.id,
      );
    }
  }

  private async ensureOfficialDeadlines(
    planId: string,
    academicYearId: string,
    academicYearName: string,
    networkId: string,
  ) {
    const deadlines = officialPlanDeadlines(academicYearName);
    if (!deadlines.length) return;

    const primaryCoordinator = await this.prisma.networkCoordinator.findFirst({
      where: {
        academicYearId,
        networkId,
        user: { active: true },
      },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      select: { userId: true },
    });

    await this.prisma.planTask.createMany({
      data: deadlines.map((deadline) => ({
        planId,
        title: deadline.title,
        description: deadline.description,
        dueDate: new Date(deadline.dueDate),
        ownerId: primaryCoordinator?.userId,
        official: true,
        officialKey: deadline.key,
      })),
      skipDuplicates: true,
    });
  }

  private async ensureSharedMilestones(
    planId: string,
    academicYearId: string,
    networkId: string,
  ) {
    const milestones = await this.prisma.academicYearMilestone.findMany({
      where: { academicYearId },
      orderBy: { dueDate: 'asc' },
    });
    if (!milestones.length) return;

    const primaryCoordinator = await this.prisma.networkCoordinator.findFirst({
      where: {
        academicYearId,
        networkId,
        user: { active: true },
      },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      select: { userId: true },
    });

    await this.prisma.planTask.createMany({
      data: milestones.map((milestone) => ({
        planId,
        title: milestone.title,
        description: milestone.description,
        dueDate: milestone.dueDate,
        ownerId: primaryCoordinator?.userId,
        official: milestone.official,
        officialKey: `YEAR_MILESTONE:${milestone.id}`,
      })),
      skipDuplicates: true,
    });
  }

  private parseDueDate(value: string) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T23:59:59.999Z`)
      : new Date(value);
  }

  private isGlobal(user: AuthenticatedUser) {
    return ['SUPERADMIN', 'ADMIN_CENTRO', 'DIRECCION', 'COORDINADOR_CICLOPE']
      .some((role) => user.roles.includes(role));
  }

  private async assertYear(user: AuthenticatedUser, academicYearId: string) {
    const year = await this.prisma.academicYear.findFirst({
      where: { id: academicYearId, centerId: user.centerId },
    });
    if (!year) throw new NotFoundException('Curso académico no encontrado.');
    return year;
  }

  private async canManageNetwork(user: AuthenticatedUser, academicYearId: string, networkId: string) {
    if (this.isGlobal(user)) return true;
    const assignment = await this.prisma.networkCoordinator.findFirst({
      where: { academicYearId, networkId, userId: user.id },
      select: { id: true },
    });
    return Boolean(assignment);
  }

  private async assertCanManagePlan(user: AuthenticatedUser, planId: string) {
    const plan = await this.prisma.annualPlan.findUnique({
      where: { id: planId },
      include: { academicYear: true, network: true },
    });
    if (!plan || plan.academicYear.centerId !== user.centerId) {
      throw new NotFoundException('Plan anual no encontrado.');
    }
    if (!(await this.canManageNetwork(user, plan.academicYearId, plan.networkId))) {
      throw new ForbiddenException('No puedes gestionar el plan de esa red.');
    }
    return plan;
  }

  async list(user: AuthenticatedUser, academicYearId?: string) {
    const targetYearId = academicYearId ?? user.academicYearId;
    if (!targetYearId) return [];
    await this.assertYear(user, targetYearId);

    let networkIds: string[] | undefined;
    if (!this.isGlobal(user)) {
      const assignments = await this.prisma.networkCoordinator.findMany({
        where: { academicYearId: targetYearId, userId: user.id },
        select: { networkId: true },
      });
      networkIds = assignments.map((item) => item.networkId);
      if (!networkIds.length) return [];
    }

    return this.prisma.annualPlan.findMany({
      where: {
        academicYearId: targetYearId,
        ...(networkIds ? { networkId: { in: networkIds } } : {}),
      },
      include: {
        network: true,
        academicYear: { select: { id: true, name: true, isActive: true } },
        _count: { select: { objectives: true, tasks: true } },
      },
      orderBy: { network: { sortOrder: 'asc' } },
    });
  }

  async calendar(user: AuthenticatedUser, academicYearId?: string) {
    const targetYearId = academicYearId ?? user.academicYearId;
    if (!targetYearId) {
      return { academicYear: null, tasks: [] };
    }

    const year = await this.assertYear(user, targetYearId);
    let networkIds: string[] | undefined;
    if (!this.isGlobal(user)) {
      const assignments = await this.prisma.networkCoordinator.findMany({
        where: { academicYearId: targetYearId, userId: user.id },
        select: { networkId: true },
      });
      networkIds = assignments.map((item) => item.networkId);
      if (!networkIds.length) {
        return {
          academicYear: {
            id: year.id,
            name: year.name,
            startsAt: year.startsAt,
            endsAt: year.endsAt,
          },
          tasks: [],
        };
      }
    }

    const tasks = await this.prisma.planTask.findMany({
      where: {
        dueDate: { not: null },
        status: { not: PlanTaskStatus.CANCELLED },
        plan: {
          academicYearId: targetYearId,
          ...(networkIds ? { networkId: { in: networkIds } } : {}),
        },
      },
      select: {
        id: true,
        title: true,
        description: true,
        dueDate: true,
        status: true,
        official: true,
        objective: { select: { id: true, title: true } },
        owner: { select: { id: true, firstName: true, lastName: true } },
        plan: {
          select: {
            id: true,
            network: { select: { id: true, name: true, code: true } },
          },
        },
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
    });

    return {
      academicYear: {
        id: year.id,
        name: year.name,
        startsAt: year.startsAt,
        endsAt: year.endsAt,
      },
      tasks,
    };
  }

  async create(user: AuthenticatedUser, dto: CreatePlanDto) {
    if (!user.academicYearId) throw new BadRequestException('No existe un curso académico activo.');
    const [year, network] = await Promise.all([
      this.assertYear(user, user.academicYearId),
      this.prisma.network.findFirst({ where: { id: dto.networkId, active: true } }),
    ]);
    if (!network) throw new BadRequestException('La red seleccionada no existe.');
    if (!(await this.canManageNetwork(user, year.id, network.id))) {
      throw new ForbiddenException('No puedes crear el plan de esa red.');
    }

    const existing = await this.prisma.annualPlan.findUnique({
      where: {
        academicYearId_networkId: {
          academicYearId: year.id,
          networkId: network.id,
        },
      },
    });
    if (existing) throw new BadRequestException('Ya existe un plan para esa red y curso.');

    const [primaryCoordinator, sharedMilestones] = await Promise.all([
      this.prisma.networkCoordinator.findFirst({
        where: {
          academicYearId: year.id,
          networkId: network.id,
          user: { active: true },
        },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        select: { userId: true },
      }),
      this.prisma.academicYearMilestone.findMany({
        where: { academicYearId: year.id },
        orderBy: { dueDate: 'asc' },
      }),
    ]);
    const officialDeadlines = officialPlanDeadlines(year.name);
    const seededTasks = [
      ...officialDeadlines.map((deadline) => ({
        title: deadline.title,
        description: deadline.description,
        dueDate: new Date(deadline.dueDate),
        ownerId: primaryCoordinator?.userId,
        official: true,
        officialKey: deadline.key,
      })),
      ...sharedMilestones.map((milestone) => ({
        title: milestone.title,
        description: milestone.description,
        dueDate: milestone.dueDate,
        ownerId: primaryCoordinator?.userId,
        official: milestone.official,
        officialKey: `YEAR_MILESTONE:${milestone.id}`,
      })),
    ];

    return this.prisma.annualPlan.create({
      data: {
        academicYearId: year.id,
        networkId: network.id,
        title: dto.title?.trim() || `Plan anual de ${network.name} · ${year.name}`,
        summary: dto.summary?.trim() || null,
        tasks: seededTasks.length ? { create: seededTasks } : undefined,
      },
      include: { network: true, academicYear: true, tasks: true },
    });
  }

  async detail(user: AuthenticatedUser, id: string) {
    const plan = await this.prisma.annualPlan.findUnique({
      where: { id },
      include: {
        academicYear: true,
        network: true,
        objectives: {
          include: {
            actions: {
              include: {
                action: {
                  include: {
                    evidence: { select: { id: true } },
                  },
                },
              },
            },
            tasks: {
              include: {
                owner: { select: { id: true, firstName: true, lastName: true, email: true } },
              },
              orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
            },
          },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        },
        tasks: {
          include: {
            owner: { select: { id: true, firstName: true, lastName: true, email: true } },
            objective: { select: { id: true, title: true } },
          },
          orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!plan || plan.academicYear.centerId !== user.centerId) {
      throw new NotFoundException('Plan anual no encontrado.');
    }
    if (!(await this.canManageNetwork(user, plan.academicYearId, plan.networkId))) {
      throw new ForbiddenException('No puedes consultar el plan de esa red.');
    }

    const objectives = plan.objectives.map((objective) => {
      const validated = objective.actions
        .map((item) => item.action)
        .filter((action) => action.status === ActionStatus.VALIDATED);

      let currentValue: number | null = null;
      if (objective.metric === PlanMetric.ACTIONS) {
        currentValue = validated.length;
      } else if (objective.metric === PlanMetric.PARTICIPATIONS) {
        currentValue = validated.reduce((sum, action) => sum + (action.studentCount ?? 0), 0);
      } else if (objective.metric === PlanMetric.HOURS) {
        currentValue = Math.round(
          (validated.reduce((sum, action) => sum + (action.durationMinutes ?? 0), 0) / 60) * 10,
        ) / 10;
      } else if (objective.metric === PlanMetric.EVIDENCE) {
        currentValue = validated.reduce((sum, action) => sum + action.evidence.length, 0);
      }

      const progressPercent =
        currentValue !== null && objective.targetValue && objective.targetValue > 0
          ? Math.min(100, Math.round((currentValue / objective.targetValue) * 100))
          : null;

      return {
        ...objective,
        linkedValidatedActions: validated.length,
        currentValue,
        progressPercent,
      };
    });

    return { ...plan, objectives };
  }

  async availableObjectives(user: AuthenticatedUser) {
    if (!user.academicYearId) return [];
    return this.prisma.planObjective.findMany({
      where: {
        plan: {
          academicYearId: user.academicYearId,
          status: AnnualPlanStatus.ACTIVE,
        },
        status: { in: [PlanObjectiveStatus.PLANNED, PlanObjectiveStatus.IN_PROGRESS, PlanObjectiveStatus.COMPLETED] },
      },
      select: {
        id: true,
        title: true,
        description: true,
        metric: true,
        targetValue: true,
        plan: {
          select: {
            id: true,
            networkId: true,
            network: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ plan: { network: { sortOrder: 'asc' } } }, { sortOrder: 'asc' }],
    });
  }

  async listMilestones(user: AuthenticatedUser, academicYearId?: string) {
    const targetYearId = academicYearId ?? user.academicYearId;
    if (!targetYearId) return [];
    await this.assertYear(user, targetYearId);

    return this.prisma.academicYearMilestone.findMany({
      where: { academicYearId: targetYearId },
      orderBy: { dueDate: 'asc' },
    });
  }

  async createMilestone(user: AuthenticatedUser, dto: CreateMilestoneDto) {
    if (!this.isGlobal(user)) {
      throw new ForbiddenException('Solo la coordinación CÍCLOPE o la administración puede crear hitos comunes.');
    }
    if (!user.academicYearId) {
      throw new BadRequestException('No existe un curso académico activo.');
    }

    const year = await this.assertYear(user, user.academicYearId);
    const dueDate = this.parseDueDate(dto.dueDate);
    if (Number.isNaN(dueDate.getTime()) || dueDate < year.startsAt || dueDate > year.endsAt) {
      throw new BadRequestException('La fecha del hito debe estar dentro del curso académico.');
    }

    const title = dto.title.trim();
    const duplicate = await this.prisma.academicYearMilestone.findFirst({
      where: { academicYearId: year.id, title, dueDate },
      select: { id: true },
    });
    if (duplicate) throw new BadRequestException('Ese hito ya está registrado para la misma fecha.');

    const milestone = await this.prisma.academicYearMilestone.create({
      data: {
        academicYearId: year.id,
        title,
        description: dto.description?.trim() || null,
        dueDate,
        official: true,
      },
    });

    const plans = await this.prisma.annualPlan.findMany({
      where: { academicYearId: year.id },
      select: { id: true, networkId: true },
    });
    for (const plan of plans) {
      await this.ensureSharedMilestones(plan.id, year.id, plan.networkId);
    }

    return { ...milestone, distributedToPlans: plans.length };
  }

  async updatePlanStatus(user: AuthenticatedUser, id: string, status: AnnualPlanStatus) {
    await this.assertCanManagePlan(user, id);
    return this.prisma.annualPlan.update({ where: { id }, data: { status } });
  }

  async createObjective(user: AuthenticatedUser, planId: string, dto: CreateObjectiveDto) {
    await this.assertCanManagePlan(user, planId);
    if ((dto.metric && dto.targetValue === undefined) || (!dto.metric && dto.targetValue !== undefined)) {
      throw new BadRequestException('La métrica y el valor objetivo deben configurarse conjuntamente.');
    }

    return this.prisma.planObjective.create({
      data: {
        planId,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        metric: dto.metric,
        targetValue: dto.targetValue,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateObjectiveStatus(
    user: AuthenticatedUser,
    objectiveId: string,
    status: PlanObjectiveStatus,
  ) {
    const objective = await this.prisma.planObjective.findUnique({
      where: { id: objectiveId },
      include: { plan: true },
    });
    if (!objective) throw new NotFoundException('Objetivo no encontrado.');
    await this.assertCanManagePlan(user, objective.planId);

    return this.prisma.planObjective.update({
      where: { id: objectiveId },
      data: { status },
    });
  }

  async createTask(user: AuthenticatedUser, planId: string, dto: CreateTaskDto) {
    const plan = await this.assertCanManagePlan(user, planId);

    if (dto.objectiveId) {
      const objective = await this.prisma.planObjective.findFirst({
        where: { id: dto.objectiveId, planId },
      });
      if (!objective) throw new BadRequestException('El objetivo no pertenece a este plan.');
    }

    if (dto.ownerId) {
      const owner = await this.prisma.user.findFirst({
        where: { id: dto.ownerId, centerId: plan.academicYear.centerId, active: true },
      });
      if (!owner) throw new BadRequestException('La persona responsable no pertenece al centro.');
    }

    return this.prisma.planTask.create({
      data: {
        planId,
        objectiveId: dto.objectiveId,
        ownerId: dto.ownerId,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        dueDate: dto.dueDate ? this.parseDueDate(dto.dueDate) : null,
      },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, email: true } },
        objective: { select: { id: true, title: true } },
      },
    });
  }

  async updateTaskStatus(user: AuthenticatedUser, taskId: string, status: PlanTaskStatus) {
    const task = await this.prisma.planTask.findUnique({
      where: { id: taskId },
      include: { plan: true },
    });
    if (!task) throw new NotFoundException('Tarea no encontrada.');
    await this.assertCanManagePlan(user, task.planId);

    return this.prisma.planTask.update({
      where: { id: taskId },
      data: {
        status,
        completedAt: status === PlanTaskStatus.DONE ? task.completedAt ?? new Date() : null,
      },
    });
  }

  async postponeTask(user: AuthenticatedUser, taskId: string, days: number) {
    const task = await this.prisma.planTask.findUnique({
      where: { id: taskId },
      include: {
        plan: {
          include: { academicYear: true },
        },
      },
    });
    if (!task) throw new NotFoundException('Tarea no encontrada.');
    await this.assertCanManagePlan(user, task.planId);

    if (task.official) {
      throw new BadRequestException('Los hitos oficiales no pueden posponerse desde el panel.');
    }
    if (
      task.status === PlanTaskStatus.DONE ||
      task.status === PlanTaskStatus.CANCELLED
    ) {
      throw new BadRequestException('Solo se pueden posponer tareas abiertas.');
    }

    const baseDate = task.dueDate && task.dueDate > new Date() ? task.dueDate : new Date();
    const postponedDate = new Date(baseDate.getTime() + days * 24 * 60 * 60_000);
    if (postponedDate > task.plan.academicYear.endsAt) {
      throw new BadRequestException('La nueva fecha quedaría fuera del curso académico.');
    }

    return this.prisma.planTask.update({
      where: { id: taskId },
      data: { dueDate: postponedDate },
    });
  }
}
