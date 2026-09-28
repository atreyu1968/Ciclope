import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePlanDto {
  @IsString()
  networkId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(6000)
  summary?: string;
}
