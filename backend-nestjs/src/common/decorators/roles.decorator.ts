import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/** Decorator to specify which tenant roles are allowed to access a route. */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
