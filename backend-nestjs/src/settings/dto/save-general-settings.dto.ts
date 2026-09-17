import { IsNumber, IsOptional, IsString } from 'class-validator';

export class SaveGeneralSettingsDto {
  @IsString()
  @IsOptional()
  company_name?: string;

  @IsString()
  @IsOptional()
  timezone?: string;

  @IsString()
  @IsOptional()
  language?: string;

  @IsNumber()
  @IsOptional()
  exchange_rate_vnd?: number;

  @IsString()
  @IsOptional()
  app_url?: string;
}
