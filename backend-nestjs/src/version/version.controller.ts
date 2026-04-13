import { Controller, Get } from '@nestjs/common';
import { VersionService } from './version.service';

@Controller('api/v1/version')
export class VersionController {
  constructor(private readonly versionService: VersionService) {}

  @Get('check')
  async checkVersion() {
    return this.versionService.checkVersion();
  }
}
