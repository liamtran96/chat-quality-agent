import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** Param decorator to extract the tenant_id from the request (set by TenantGuard). */
export const TenantId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.tenant_id;
  },
);
