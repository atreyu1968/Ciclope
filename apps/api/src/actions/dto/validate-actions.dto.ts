import { ArrayMaxSize, ArrayMinSize, IsArray, IsString } from 'class-validator';

export class ValidateActionsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  ids!: string[];
}
