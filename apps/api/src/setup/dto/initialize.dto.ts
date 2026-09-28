import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class InitializeDto {
  @IsString() @MinLength(3) @MaxLength(180)
  centerName!: string;

  @IsString() @MinLength(3) @MaxLength(30)
  centerCode!: string;

  @IsString() @MinLength(2) @MaxLength(80)
  firstName!: string;

  @IsString() @MinLength(2) @MaxLength(120)
  lastName!: string;

  @IsEmail() @MaxLength(254)
  email!: string;

  @IsString() @MinLength(12) @MaxLength(200)
  @Matches(/[A-Z]/, { message: 'La contraseña debe incluir una mayúscula.' })
  @Matches(/[a-z]/, { message: 'La contraseña debe incluir una minúscula.' })
  @Matches(/[0-9]/, { message: 'La contraseña debe incluir un número.' })
  password!: string;
}
