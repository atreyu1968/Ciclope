import { IsString, MaxLength } from 'class-validator';

export class AddStaffRequestMessageDto {
  @IsString()
  @MaxLength(6000)
  body!: string;
}
