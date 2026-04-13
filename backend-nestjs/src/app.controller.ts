import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('health')
  health() {
    return { status: 'ok', version: process.env.APP_VERSION || 'dev' };
  }
}
