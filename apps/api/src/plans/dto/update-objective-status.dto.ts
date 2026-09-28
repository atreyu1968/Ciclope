import { IsEnum } from 'class-validator';
import { PlanObjectiveStatus } from '../../generated/prisma/client';

export class UpdateObjectiveStatusDto {
  @IsEnum(PlanObjectiveStatus)
  status!: PlanObjectiveStatus;
}
