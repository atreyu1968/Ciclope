import { IsString, MaxLength } from 'class-validator';

export class RespondCommunicationDto {
  @IsString()
  @MaxLength(3000)
  response!: string;
}
