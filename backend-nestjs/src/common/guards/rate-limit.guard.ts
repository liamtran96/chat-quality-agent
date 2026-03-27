import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';

interface Visitor {
  count: number;
  lastSeen: number;
}

@Injectable()
export class RateLimitGuard implements CanActivate, OnModuleDestroy {
  private readonly logger = new Logger(RateLimitGuard.name);
  private readonly visitors = new Map<string, Visitor>();
  private readonly windowMs = 60_000; // 1 minute
  private readonly cleanupInterval: ReturnType<typeof setInterval>;
  private readonly limitPerIP: number;
  private readonly limitPerUser: number;

  constructor(private readonly configService: ConfigService) {
    this.limitPerIP = this.configService.get<number>('RATE_LIMIT_PER_IP', 500);
    this.limitPerUser = this.configService.get<number>('RATE_LIMIT_PER_USER', 1000);

    // Cleanup old entries every 60 seconds
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60_000);
  }

  onModuleDestroy() {
    clearInterval(this.cleanupInterval);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Determine key and limit based on authentication status
    const userId = (request as any).user?.user_id || (request as any).user?.userId;
    let key: string;
    let limit: number;

    if (userId) {
      key = `user:${userId}`;
      limit = this.limitPerUser;
    } else {
      key = request.ip || request.socket.remoteAddress || 'unknown';
      limit = this.limitPerIP;
    }

    const { allowed, remaining } = this.allow(key, limit);

    // Set rate limit headers on every response
    response.setHeader('X-RateLimit-Limit', String(limit));
    response.setHeader('X-RateLimit-Remaining', String(remaining));

    if (!allowed) {
      this.logger.warn(
        `rate limit exceeded: key=${key} ip=${request.ip} path=${request.url}`,
      );
      response.setHeader('Retry-After', '60');
      throw new HttpException(
        { error: 'rate_limit_exceeded' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private allow(key: string, limit: number): { allowed: boolean; remaining: number } {
    const now = Date.now();
    const visitor = this.visitors.get(key);

    if (!visitor || now - visitor.lastSeen > this.windowMs) {
      // New visitor or window expired -- reset counter
      this.visitors.set(key, { count: 1, lastSeen: now });
      return { allowed: true, remaining: limit - 1 };
    }

    visitor.count++;
    let remaining = limit - visitor.count;
    if (remaining < 0) {
      remaining = 0;
    }
    return { allowed: visitor.count <= limit, remaining };
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, visitor] of this.visitors.entries()) {
      if (now - visitor.lastSeen > this.windowMs) {
        this.visitors.delete(key);
      }
    }
  }

  /** Expose for testing */
  getVisitorCount(): number {
    return this.visitors.size;
  }
}
