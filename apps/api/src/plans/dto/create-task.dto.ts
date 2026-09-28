import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTaskDto {
  @IsString()
  @MaxLength(240)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsString()
  objectiveId?: string;

  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
