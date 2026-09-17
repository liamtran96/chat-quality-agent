import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantGuard } from '../auth/tenant.guard';
import { TenantId } from '../auth/decorators';
import { DashboardService } from './dashboard.service';

@Controller('api/v1/tenants/:tenantId')
@UseGuards(JwtAuthGuard, TenantGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('dashboard')
  getDashboard(
    @TenantId() tenantId: string,
    @Query('from') dateFrom?: string,
    @Query('to') dateTo?: string,
  ) {
    return this.dashboardService.getDashboard(tenantId, dateFrom, dateTo);
  }

  @Get('onboarding-status')
  getOnboardingStatus(@TenantId() tenantId: string) {
    return this.dashboardService.getOnboardingStatus(tenantId);
  }
}
