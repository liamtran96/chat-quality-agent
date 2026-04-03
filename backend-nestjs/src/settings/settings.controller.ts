import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantGuard } from '../auth/tenant.guard';
import { PermissionGuard } from '../auth/permission.guard';
import {
  CurrentUser,
  RequirePermission,
  TenantId,
} from '../auth/decorators';
import { SettingsService } from './settings.service';
import { SaveSettingDto } from './dto/save-setting.dto';
import { SaveAISettingsDto } from './dto/save-ai-settings.dto';
import { SaveAnalysisSettingsDto } from './dto/save-analysis-settings.dto';
import { SaveGeneralSettingsDto } from './dto/save-general-settings.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Controller('api/v1/tenants/:tenantId/settings')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @RequirePermission('settings', 'r')
  getSettings(@TenantId() tenantId: string) {
    return this.settingsService.getSettings(tenantId);
  }

  @Put()
  @RequirePermission('settings', 'w')
  saveSetting(@TenantId() tenantId: string, @Body() dto: SaveSettingDto) {
    return this.settingsService.saveSetting(tenantId, dto.key, dto.value);
  }

  @Put('ai')
  @RequirePermission('settings', 'w')
  saveAISettings(
    @TenantId() tenantId: string,
    @Body() dto: SaveAISettingsDto,
  ) {
    return this.settingsService.saveAISettings(tenantId, dto);
  }

  @Put('analysis')
  @RequirePermission('settings', 'w')
  saveAnalysisSettings(
    @TenantId() tenantId: string,
    @Body() dto: SaveAnalysisSettingsDto,
  ) {
    return this.settingsService.saveAnalysisSettings(tenantId, dto);
  }

  @Post('ai/test')
  @RequirePermission('settings', 'w')
  testAIKey(@TenantId() tenantId: string) {
    return this.settingsService.testAIKey(tenantId);
  }

  @Put('general')
  @RequirePermission('settings', 'w')
  saveGeneralSettings(
    @TenantId() tenantId: string,
    @Body() dto: SaveGeneralSettingsDto,
  ) {
    return this.settingsService.saveGeneralSettings(tenantId, dto);
  }

  @Put('password')
  changePassword(
    @CurrentUser() user: { user_id: string },
    @Body() dto: ChangePasswordDto,
  ) {
    return this.settingsService.changePassword(user.user_id, dto);
  }
}
