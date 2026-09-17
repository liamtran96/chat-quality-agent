import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const ROLES_KEY = 'roles';

/**
 * RolesGuard checks that the user's tenant_role is in the allowed list.
 * Must be used after TenantGuard.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const role = request.tenant_role;

    if (!requiredRoles.includes(role)) {
      this.logger.warn(
        `RBAC denied: user=${request.user?.user_id} role=${role} required=${requiredRoles.join(',')}`,
      );
      throw new ForbiddenException('insufficient_role');
    }
    return true;
  }
}
