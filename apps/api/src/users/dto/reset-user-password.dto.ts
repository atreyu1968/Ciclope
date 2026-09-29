import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ResetUserPasswordDto {
  @IsOptional()
  @IsString()
  @MinLength(12)
  @MaxLength(200)
  temporaryPassword?: string;
}
