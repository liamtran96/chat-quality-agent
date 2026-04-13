import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * RolesGuard checks that the user's tenant_role is one of the allowed roles.
 * Uses the @Roles() decorator metadata.
 *
 * Ported from Go: backend/api/middleware/tenant.go RequireRole()
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
    const role: string = request.tenant_role;

    if (!role || !requiredRoles.includes(role)) {
      this.logger.warn(
        `[security] RBAC denied: user=${request.user?.id} role=${role} required=${JSON.stringify(requiredRoles)} path=${request.url}`,
      );
      throw new ForbiddenException({ error: 'insufficient_role' });
    }

    return true;
  }
}
