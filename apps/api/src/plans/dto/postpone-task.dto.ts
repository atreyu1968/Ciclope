import { IsInt, Max, Min } from 'class-validator';

export class PostponeTaskDto {
  @IsInt()
  @Min(1)
  @Max(60)
  days!: number;
}
