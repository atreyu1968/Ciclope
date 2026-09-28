import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsEmail, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateActionDto {
  @IsString() @MaxLength(180) title!: string;
  @IsString() @MaxLength(4000) description!: string;
  @IsString() @MaxLength(80) type!: string;
  @IsDateString() activityDate!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000) durationMinutes?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10000) studentCount?: number;
  @IsString() @MaxLength(160) submittedByName!: string;
  @IsEmail() @MaxLength(254) submittedByEmail!: string;
  @IsArray() @ArrayMinSize(1) @IsString({ each: true }) networkIds!: string[];
}
