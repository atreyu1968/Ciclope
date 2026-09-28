import { IsEnum } from 'class-validator';
import { PlanTaskStatus } from '../../generated/prisma/client';

export class UpdateTaskStatusDto {
  @IsEnum(PlanTaskStatus)
  status!: PlanTaskStatus;
}
