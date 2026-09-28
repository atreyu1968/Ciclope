import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { Shift } from '../../generated/prisma/client';

export class CreateGroupDto {
  @IsString()
  professionalFamilyId!: string;

  @IsString()
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsEnum(Shift)
  shift?: Shift;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  studentCount?: number;
}
