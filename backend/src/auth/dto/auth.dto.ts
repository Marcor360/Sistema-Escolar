import { Transform } from 'class-transformer';
import { IsOptional } from 'class-validator';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail() email!: string;
  @IsString() @IsNotEmpty() password!: string;
}

export class ForgotPasswordDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail() email!: string;
}

export class ResetPasswordDto {
  @IsString() @IsNotEmpty() token!: string;
  @IsString() @MinLength(8) password!: string;
}

export class CambiarPasswordDto {
  @IsString() @IsNotEmpty() actual!: string;
  @IsString() @MinLength(8) nueva!: string;
}

export class RefreshDto {
  @IsOptional() @IsString() refreshToken?: string;
}
