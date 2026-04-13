import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY, PermissionMeta } from '../decorators/permissions.decorator';

/**
 * PermissionsGuard checks resource-level permissions for tenant members.
 * Owner and admin roles always pass. Members are checked against their
 * permissions JSON: {"channels":"rw","messages":"r","jobs":"rw","settings":"r"}
 *
 * Ported from Go: backend/api/middleware/tenant.go RequirePermission()
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const permission = this.reflector.getAllAndOverride<PermissionMeta>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!permission) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const role: string = request.tenant_role;

    // Owner and admin always have full access
    if (role === 'owner' || role === 'admin') {
      return true;
    }

    // Member: check permissions JSON
    const perms: string = request.tenant_permissions;
    if (!perms) {
      throw new ForbiddenException({ error: 'no_permissions' });
    }

    let permMap: Record<string, string>;
    try {
      permMap = JSON.parse(perms);
    } catch {
      throw new ForbiddenException({ error: 'invalid_permissions' });
    }

    const resourcePerms = permMap[permission.resource];
    if (!resourcePerms || !resourcePerms.includes(permission.action)) {
      this.logger.warn(
        `[security] permission denied: user=${request.user?.id} resource=${permission.resource} action=${permission.action} path=${request.url}`,
      );
      throw new ForbiddenException({ error: 'permission_denied' });
    }

    return true;
  }
}
