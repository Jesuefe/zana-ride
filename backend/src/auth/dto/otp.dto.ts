import { IsString, IsOptional, IsEmail, Matches, Length } from 'class-validator';

export class RequestOtpDto {
  @IsString()
  @Matches(/^\+?[0-9]{9,15}$/, { message: 'phone must be a valid international phone number' })
  phone: string;

  // A traveller on a foreign SIM has a genuinely real phone number —
  // it's just not one Africa's Talking's African-carrier routing can
  // reliably reach. When set, the code goes to this address instead
  // of SMS, while the phone number still identifies the account.
  @IsOptional()
  @IsEmail()
  email?: string;
}

export class VerifyOtpDto {
  @IsString()
  @Matches(/^\+?[0-9]{9,15}$/)
  phone: string;

  @IsString()
  @Length(6, 6, { message: 'code must be exactly 6 digits' })
  code: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
