import { IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class CreateTenantDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(100)
  @Matches(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, {
    message: 'slug must be lowercase alphanumeric with hyphens, min 3 chars',
  })
  slug!: string;
}
