import { IsString, Length } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  challenge_token!: string;

  @IsString() @Length(6, 6)
  otp_code!: string;
}
