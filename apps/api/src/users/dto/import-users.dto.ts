import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEmail, IsEnum, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Shift } from '../../generated/prisma/client';

export class ImportUserRowDto {
  @IsString()
  @MaxLength(80)
  firstName!: string;

  @IsString()
  @MaxLength(120)
  lastName!: string;

  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsOptional()
  @IsEnum(Shift)
  shift?: Shift;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  families?: string[];
}

export class ImportUsersDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => ImportUserRowDto)
  rows!: ImportUserRowDto[];
}
