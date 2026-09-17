import { IsNotEmpty, IsString } from 'class-validator';

export class SaveSettingDto {
  @IsString()
  @IsNotEmpty()
  key: string;

  @IsString()
  @IsNotEmpty()
  value: string;
}
