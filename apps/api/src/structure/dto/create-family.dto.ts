import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateFamilyDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  code?: string;
}
