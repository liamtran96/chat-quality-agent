import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SaveAISettingsDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['claude', 'gemini'])
  provider: string;

  @IsString()
  @IsNotEmpty()
  api_key: string;

  @IsString()
  @IsOptional()
  model?: string;

  @IsString()
  @IsOptional()
  base_url?: string;

  @IsString()
  @IsOptional()
  batch_mode?: string;

  @IsString()
  @IsOptional()
  batch_size?: string;
}
