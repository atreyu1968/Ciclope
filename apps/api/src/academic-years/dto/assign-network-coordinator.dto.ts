import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class AssignNetworkCoordinatorDto {
  @IsString()
  userId!: string;

  @IsString()
  networkId!: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
