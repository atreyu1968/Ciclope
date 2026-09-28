import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class CreateLinkEvidenceDto {
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2000)
  url!: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  title?: string;
}
