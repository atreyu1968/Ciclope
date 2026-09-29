import { IsString, MaxLength } from 'class-validator';

export class UpdateReportSnapshotNarrativeDto {
  @IsString()
  @MaxLength(60000)
  narrative!: string;
}
