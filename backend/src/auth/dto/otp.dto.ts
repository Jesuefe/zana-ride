import { IsString, Matches, Length } from 'class-validator';

export class RequestOtpDto {
  @IsString()
  @Matches(/^\+?[0-9]{9,15}$/, { message: 'phone must be a valid international phone number' })
  phone: string;
}

export class VerifyOtpDto {
  @IsString()
  @Matches(/^\+?[0-9]{9,15}$/)
  phone: string;

  @IsString()
  @Length(6, 6, { message: 'code must be exactly 6 digits' })
  code: string;
}
