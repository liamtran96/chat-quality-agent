import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'permission';

export interface PermissionMeta {
  resource: string;
  action: string;
}

/** Decorator to require a specific resource permission (e.g. @RequirePermission('channels', 'r')). */
export const RequirePermission = (resource: string, action: string) =>
  SetMetadata(PERMISSION_KEY, { resource, action } as PermissionMeta);
