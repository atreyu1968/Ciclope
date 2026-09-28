import { ArrayMinSize, IsArray, IsString, MaxLength } from 'class-validator';

export class CreateStaffRequestDto {
  @IsString()
  @MaxLength(80)
  category!: string;

  @IsString()
  @MaxLength(180)
  subject!: string;

  @IsString()
  @MaxLength(6000)
  body!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  networkIds!: string[];
}
