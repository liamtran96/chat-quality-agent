import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

/**
 * Placeholder JWT auth guard.
 * In a full implementation this would verify the JWT token and set request.user.
 * For now it checks that request.user is set (e.g. by middleware or a real JWT strategy).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    if (!request.user || !request.user.id) {
      throw new UnauthorizedException({ error: 'authorization_required' });
    }
    return true;
  }
}
