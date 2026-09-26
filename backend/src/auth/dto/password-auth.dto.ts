import { IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @Matches(/^\+?[0-9]{9,15}$/, { message: 'phone must be a valid international phone number' })
  phone: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6, { message: 'password must be at least 6 characters' })
  password: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;
}

export class RegisterDriverDto {
  @IsString()
  @Matches(/^\+?[0-9]{9,15}$/, { message: 'phone must be a valid international phone number' })
  phone: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6, { message: 'password must be at least 6 characters' })
  password: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsString()
  vehicle: string;

  @IsString()
  plate: string;

  @IsString()
  serviceType: 'BIKE' | 'ECONOMY' | 'COMFORT';
}

export class LoginDto {
  // Accepts either a phone number or an email in the same field.
  @IsString()
  identifier: string;

  @IsString()
  password: string;
}


export class RecoverAdminDto {
  @IsString()
  @Matches(/^\\+?[0-9]{9,15}$/, { message: 'phone must be a valid international phone number' })
  phone: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(12, { message: 'admin password must be at least 12 characters' })
  password: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsString()
  @MinLength(16, { message: 'recovery secret must be at least 16 characters' })
  recoverySecret: string;
}
