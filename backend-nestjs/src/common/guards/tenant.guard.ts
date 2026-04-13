import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserTenant } from '../../entities/user-tenant.entity';

/**
 * TenantGuard extracts :tenantId from route params and verifies
 * the current user has access to the tenant via user_tenants.
 *
 * On success, sets request.tenant_id, request.tenant_role, and request.tenant_permissions.
 * On failure, returns 403 and logs a security event.
 *
 * Ported from Go: backend/api/middleware/tenant.go TenantContext()
 */
@Injectable()
export class TenantGuard implements CanActivate {
  private readonly logger = new Logger(TenantGuard.name);

  constructor(
    @InjectRepository(UserTenant)
    private readonly userTenantRepo: Repository<UserTenant>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const tenantId = request.params.tenantId;

    if (!tenantId) {
      throw new ForbiddenException({ error: 'tenant_id_required' });
    }

    const userId: string | undefined = request.user?.id;
    if (!userId) {
      throw new ForbiddenException({ error: 'authorization_required' });
    }

    const ut = await this.userTenantRepo.findOne({
      where: { user_id: userId, tenant_id: tenantId },
    });

    if (!ut) {
      this.logger.warn(
        `[security] tenant access denied: user=${userId} tenant=${tenantId} ip=${request.ip}`,
      );
      throw new ForbiddenException({ error: 'tenant_access_denied' });
    }

    request.tenant_id = tenantId;
    request.tenant_role = ut.role;
    request.tenant_permissions = ut.permissions;

    return true;
  }
}
