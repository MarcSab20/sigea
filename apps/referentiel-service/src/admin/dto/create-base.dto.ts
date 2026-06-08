import { IsString, MinLength, IsOptional } from 'class-validator';

export class CreateBaseDto {
  @IsString() @MinLength(2) code_base!: string;
  @IsString() @MinLength(2) nom!: string;
  @IsString() @MinLength(2) region!: string;
}

export class UpdateBaseDto {
  @IsOptional() @IsString() code_base?: string;
  @IsOptional() @IsString() nom?: string;
  @IsOptional() @IsString() region?: string;
}