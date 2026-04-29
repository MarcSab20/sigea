import { IsString, MinLength, MaxLength } from 'class-validator';

export class LoginDto {
  @IsString() @MinLength(3) @MaxLength(50)
  login!: string;

  @IsString() @MinLength(12)
  password!: string;
}
