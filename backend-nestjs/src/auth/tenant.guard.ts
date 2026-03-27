import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserTenant } from '../entities';

/**
 * TenantGuard verifies that the authenticated user belongs to the tenant
 * specified in the :tenantId URL param. Sets tenant_role and tenant_permissions
 * on the request for downstream use.
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
    const user = request.user;

    if (!tenantId) {
      throw new ForbiddenException('tenant_id_required');
    }
    if (!user?.user_id) {
      throw new ForbiddenException('authorization_required');
    }

    const ut = await this.userTenantRepo.findOne({
      where: { user_id: user.user_id, tenant_id: tenantId },
    });

    if (!ut) {
      this.logger.warn(
        `tenant access denied: user=${user.user_id} tenant=${tenantId}`,
      );
      throw new ForbiddenException('tenant_access_denied');
    }

    // Attach tenant info to request
    request.tenant_id = tenantId;
    request.tenant_role = ut.role;
    request.tenant_permissions = ut.permissions;

    return true;
  }
}
