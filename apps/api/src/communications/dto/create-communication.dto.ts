import { IsArray, IsBoolean, IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { Shift } from '../../generated/prisma/client';

export class CreateCommunicationDto {
  @IsString()
  @MaxLength(180)
  title!: string;

  @IsString()
  @MaxLength(12000)
  body!: string;

  @IsOptional()
  @IsString()
  originNetworkId?: string;

  @IsOptional()
  @IsBoolean()
  responseRequired?: boolean;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsBoolean()
  targetAllFp?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  professionalFamilyIds?: string[];

  @IsOptional()
  @IsArray()
  @IsEnum(Shift, { each: true })
  shifts?: Shift[];
}
