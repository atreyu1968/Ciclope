import { IsBoolean, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class UpdateAiDto {
  @IsBoolean()
  enabled!: boolean;

  @IsString()
  @MaxLength(100)
  providerName!: string;

  @IsUrl({ require_tld: false })
  @MaxLength(500)
  baseUrl!: string;

  @IsString()
  @MaxLength(160)
  model!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  apiKey?: string;
}
