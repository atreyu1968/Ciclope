import { IsDateString, IsString, Matches, MaxLength } from 'class-validator';

export class CreateAcademicYearDto {
  @IsString()
  @MaxLength(9)
  @Matches(/^\d{4}-\d{4}$/)
  name!: string;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;
}
