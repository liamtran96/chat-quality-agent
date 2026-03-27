import { Controller, Get } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Controller()
export class AppController {
  private readonly version: string;

  constructor() {
    try {
      const versionPath = path.resolve(__dirname, '..', '..', 'VERSION');
      this.version = fs.readFileSync(versionPath, 'utf-8').trim();
    } catch {
      this.version = '1.0.0';
    }
  }

  @Get('health')
  health(): { status: string; version: string } {
    return { status: 'ok', version: this.version };
  }
}
