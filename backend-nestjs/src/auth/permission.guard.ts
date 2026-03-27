import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const PERMISSION_KEY = 'permission';

export interface PermissionMeta {
  resource: string;
  action: string;
}

/**
 * PermissionGuard checks role-based permissions.
 * Owner and admin always have full access.
 * Members must have the specific resource:action permission.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  private readonly logger = new Logger(PermissionGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const permission = this.reflector.getAllAndOverride<PermissionMeta>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!permission) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const role = request.tenant_role;

    // Owner and admin always have full access
    if (role === 'owner' || role === 'admin') {
      return true;
    }

    // Member: check permissions JSON
    const permsStr = request.tenant_permissions;
    if (!permsStr) {
      throw new ForbiddenException('no_permissions');
    }

    try {
      const permMap = JSON.parse(permsStr);
      const resourcePerms: string = permMap[permission.resource] || '';
      if (!resourcePerms.includes(permission.action)) {
        this.logger.warn(
          `permission denied: user=${request.user?.user_id} resource=${permission.resource} action=${permission.action}`,
        );
        throw new ForbiddenException('permission_denied');
      }
    } catch (e) {
      if (e instanceof ForbiddenException) throw e;
      throw new ForbiddenException('invalid_permissions');
    }

    return true;
  }
}
