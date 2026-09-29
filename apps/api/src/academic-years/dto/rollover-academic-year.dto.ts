import { IsBoolean, IsDateString, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class RolloverAcademicYearDto {
  @IsString()
  @MaxLength(9)
  @Matches(/^\d{4}-\d{4}$/)
  name!: string;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;

  @IsOptional()
  @IsBoolean()
  copyGroups?: boolean;

  @IsOptional()
  @IsBoolean()
  copyCoordinators?: boolean;
}
