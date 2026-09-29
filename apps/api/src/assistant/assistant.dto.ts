import { IsNotEmpty, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class DraftCommunicationDto {
  @IsString()
  @Length(3, 4000)
  brief!: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(12000)
  currentBody?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  audience?: string;
}

export class PlanSuggestionsDto {
  @IsString()
  @IsNotEmpty()
  planId!: string;
}
