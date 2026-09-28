import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { PlanMetric } from '../../generated/prisma/client';

export class CreateObjectiveDto {
  @IsString()
  @MaxLength(240)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(6000)
  description?: string;

  @IsOptional()
  @IsEnum(PlanMetric)
  metric?: PlanMetric;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100000000)
  targetValue?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  sortOrder?: number;
}
