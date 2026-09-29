import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ExportReportDto {
  @IsOptional()
  @IsString()
  @MaxLength(60000)
  narrative?: string;
}
