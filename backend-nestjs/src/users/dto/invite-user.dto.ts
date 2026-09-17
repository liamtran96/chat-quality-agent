import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class InviteUserDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsIn(['admin', 'member'])
  role: string;

  @IsString()
  @IsOptional()
  permissions?: string;
}
