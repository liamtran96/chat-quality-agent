import { IsString, MinLength, MaxLength } from 'class-validator';

export class UpdateTenantDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name!: string;
}
