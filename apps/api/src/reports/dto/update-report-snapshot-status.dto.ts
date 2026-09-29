import { IsEnum } from 'class-validator';
import { ReportSnapshotStatus } from '../../generated/prisma/client';

export class UpdateReportSnapshotStatusDto {
  @IsEnum(ReportSnapshotStatus)
  status!: ReportSnapshotStatus;
}
