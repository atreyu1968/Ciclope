import { IsEnum } from 'class-validator';
import { AnnualPlanStatus } from '../../generated/prisma/client';

export class UpdatePlanStatusDto {
  @IsEnum(AnnualPlanStatus)
  status!: AnnualPlanStatus;
}
