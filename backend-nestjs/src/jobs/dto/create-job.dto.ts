import {
  IsString,
  IsNotEmpty,
  IsIn,
  IsArray,
  ArrayMinSize,
  IsOptional,
  MinLength,
  MaxLength,
  IsDateString,
} from 'class-validator';

export class CreateJobDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsIn(['qc_analysis', 'classification'])
  job_type: string;

  @IsArray()
  @ArrayMinSize(1)
  input_channel_ids: string[];

  @IsString()
  @IsOptional()
  rules_content?: string;

  @IsOptional()
  rules_config?: any;

  @IsString()
  @IsOptional()
  skip_conditions?: string;

  @IsString()
  @IsOptional()
  @IsIn(['claude', 'gemini'])
  ai_provider?: string;

  @IsString()
  @IsOptional()
  ai_model?: string;

  @IsNotEmpty()
  outputs: any;

  @IsString()
  @IsIn(['instant', 'scheduled', 'cron', 'none'])
  output_schedule: string;

  @IsString()
  @IsOptional()
  output_cron?: string;

  @IsOptional()
  @IsDateString()
  output_at?: string;

  @IsString()
  @IsIn(['cron', 'after_sync', 'manual'])
  schedule_type: string;

  @IsString()
  @IsOptional()
  schedule_cron?: string;
}
