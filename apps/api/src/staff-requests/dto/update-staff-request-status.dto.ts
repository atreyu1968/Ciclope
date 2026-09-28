import { IsEnum } from 'class-validator';
import { StaffRequestStatus } from '../../generated/prisma/client';

export class UpdateStaffRequestStatusDto {
  @IsEnum(StaffRequestStatus)
  status!: StaffRequestStatus;
}
