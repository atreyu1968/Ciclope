import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class AssignCiclopeCoordinatorDto {
  @IsString()
  userId!: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
