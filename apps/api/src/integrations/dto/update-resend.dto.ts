import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateResendDto {
  @IsBoolean()
  enabled!: boolean;

  @IsEmail()
  fromEmail!: string;

  @IsString()
  @MaxLength(120)
  fromName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  apiKey?: string;
}
