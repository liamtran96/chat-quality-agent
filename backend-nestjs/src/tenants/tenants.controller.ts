import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { TenantsService, TenantResponse } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('api/v1/tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  /**
   * GET /api/v1/tenants
   * List all tenants the current user belongs to.
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  async listTenants(@Req() req: any): Promise<TenantResponse[]> {
    return this.tenantsService.listTenants(req.user.id);
  }

  /**
   * POST /api/v1/tenants
   * Create a new tenant. The creator becomes the owner.
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createTenant(
    @Req() req: any,
    @Body() dto: CreateTenantDto,
  ): Promise<TenantResponse> {
    return this.tenantsService.createTenant(req.user.id, dto);
  }

  /**
   * GET /api/v1/tenants/:tenantId
   * Get a single tenant (requires membership).
   */
  @Get(':tenantId')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async getTenant(@TenantId() tenantId: string): Promise<TenantResponse> {
    return this.tenantsService.getTenant(tenantId);
  }

  /**
   * GET /api/v1/tenants/:tenantId/me
   * Get current user's role and permissions within this tenant.
   * Reads from request context set by TenantGuard (no extra DB query).
   */
  @Get(':tenantId/me')
  @UseGuards(JwtAuthGuard, TenantGuard)
  getTenantMe(
    @Req() req: any,
  ): { role: string; permissions: string } {
    return {
      role: req.tenant_role ?? '',
      permissions: req.tenant_permissions ?? '',
    };
  }

  /**
   * PUT /api/v1/tenants/:tenantId
   * Update tenant name. Requires owner or admin role.
   */
  @Put(':tenantId')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('owner', 'admin')
  async updateTenant(
    @TenantId() tenantId: string,
    @Body() dto: UpdateTenantDto,
  ): Promise<{ message: string }> {
    return this.tenantsService.updateTenant(tenantId, dto);
  }

  /**
   * DELETE /api/v1/tenants/:tenantId
   * Delete a tenant and all related data. Requires owner role.
   */
  @Delete(':tenantId')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('owner')
  async deleteTenant(
    @TenantId() tenantId: string,
  ): Promise<{ message: string }> {
    return this.tenantsService.deleteTenant(tenantId);
  }
}
