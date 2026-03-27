import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateRoleDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['owner', 'admin', 'member'])
  role: string;

  @IsString()
  @IsOptional()
  permissions?: string;
}
