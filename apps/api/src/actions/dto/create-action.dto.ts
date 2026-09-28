import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateActionDto {
  @IsString() @MaxLength(180)
  title!: string;

  @IsString() @MaxLength(4000)
  description!: string;

  @IsString() @MaxLength(80)
  type!: string;

  @IsDateString()
  activityDate!: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000)
  durationMinutes?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10000)
  studentCount?: number;

  @IsArray() @ArrayMinSize(1) @IsString({ each: true })
  networkIds!: string[];
}
