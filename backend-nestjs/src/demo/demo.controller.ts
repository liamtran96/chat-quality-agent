import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { DemoService } from './demo.service';

@Controller('api/v1/tenants/:tenantId/demo')
export class DemoController {
  constructor(private readonly demoService: DemoService) {}

  @Get('status')
  async getDemoStatus(@Param('tenantId') tenantId: string) {
    return this.demoService.getDemoStatus(tenantId);
  }

  @Post('import')
  @HttpCode(HttpStatus.OK)
  async importDemoData(@Param('tenantId') tenantId: string) {
    const result = await this.demoService.importDemoData(tenantId);
    if (result.error) {
      if (result.error === 'tenant_has_data') {
        throw new BadRequestException({ error: 'tenant_has_data' });
      }
      throw new InternalServerErrorException({ error: result.error });
    }
    return result;
  }

  @Delete('reset')
  async resetDemoData(@Param('tenantId') tenantId: string) {
    const result = await this.demoService.resetDemoData(tenantId);
    if (result.error) {
      if (result.error === 'tenant_not_found') {
        throw new NotFoundException({ error: 'tenant_not_found' });
      }
      if (result.error === 'not_demo_data') {
        throw new BadRequestException({ error: 'not_demo_data' });
      }
      throw new InternalServerErrorException({ error: result.error });
    }
    return result;
  }
}
