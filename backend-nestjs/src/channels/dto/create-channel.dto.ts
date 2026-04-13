import { IsString, IsIn, MinLength, MaxLength, IsOptional, IsObject } from 'class-validator';

export class CreateChannelDto {
  @IsString()
  @IsIn(['zalo_oa', 'facebook'])
  channel_type: string;

  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @IsObject()
  credentials: Record<string, any>;

  @IsOptional()
  @IsString()
  metadata?: string;
}
