import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SaveAnalysisSettingsDto {
  @IsString()
  @IsNotEmpty()
  batch_mode: string;

  @IsString()
  @IsOptional()
  batch_size?: string;
}
