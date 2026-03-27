import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ROLES_KEY } from './roles.guard';
import { PERMISSION_KEY, PermissionMeta } from './permission.guard';

/**
 * Decorator to specify allowed roles for a route handler.
 * Usage: @Roles('owner', 'admin')
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Decorator to specify required permission for a route handler.
 * Usage: @RequirePermission('settings', 'r')
 */
export const RequirePermission = (resource: string, action: string) =>
  SetMetadata(PERMISSION_KEY, { resource, action } as PermissionMeta);

/**
 * Extracts tenant_id from the request (set by TenantGuard).
 */
export const TenantId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.tenant_id || request.params.tenantId;
  },
);

/**
 * Extracts the current user from the request (set by JwtAuthGuard).
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

/**
 * Extracts tenant_role from the request (set by TenantGuard).
 */
export const TenantRole = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.tenant_role;
  },
);
