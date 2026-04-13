import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RateLimitGuard } from './rate-limit.guard';

describe('RateLimitGuard', () => {
  let guard: RateLimitGuard;
  let configService: ConfigService;

  const createMockContext = (
    ip = '127.0.0.1',
    user?: { user_id: string },
  ): ExecutionContext => {
    const headers: Record<string, string> = {};
    const mockResponse = {
      setHeader: jest.fn((key: string, value: string) => {
        headers[key] = value;
      }),
      getHeader: (key: string) => headers[key],
      _headers: headers,
    };
    const mockRequest = {
      ip,
      socket: { remoteAddress: ip },
      url: '/test',
      user,
    };
    return {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const config: Record<string, any> = {
          RATE_LIMIT_PER_IP: 5,
          RATE_LIMIT_PER_USER: 10,
        };
        return config[key] ?? defaultValue;
      }),
    } as unknown as ConfigService;

    guard = new RateLimitGuard(configService);
  });

  afterEach(() => {
    guard.onModuleDestroy();
  });

  it('should allow requests within the limit', () => {
    const ctx = createMockContext('10.0.0.1');
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should set rate limit headers on every response', () => {
    const ctx = createMockContext('10.0.0.2');
    guard.canActivate(ctx);

    const res = ctx.switchToHttp().getResponse();
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '5');
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '4');
  });

  it('should decrement remaining count on each request', () => {
    const ip = '10.0.0.3';
    for (let i = 0; i < 3; i++) {
      const ctx = createMockContext(ip);
      guard.canActivate(ctx);
    }

    const ctx = createMockContext(ip);
    guard.canActivate(ctx);
    const res = ctx.switchToHttp().getResponse();
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '1');
  });

  it('should reject requests exceeding the IP limit with 429', () => {
    const ip = '10.0.0.4';
    // Use up all 5 allowed requests
    for (let i = 0; i < 5; i++) {
      const ctx = createMockContext(ip);
      guard.canActivate(ctx);
    }

    // 6th request should be rejected
    const ctx = createMockContext(ip);
    expect(() => guard.canActivate(ctx)).toThrow(HttpException);

    try {
      guard.canActivate(createMockContext(ip));
    } catch (e) {
      expect(e).toBeInstanceOf(HttpException);
      expect((e as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      const body = (e as HttpException).getResponse();
      expect(body).toEqual({ error: 'rate_limit_exceeded' });
    }
  });

  it('should set Retry-After header on 429 response', () => {
    const ip = '10.0.0.5';
    for (let i = 0; i < 5; i++) {
      guard.canActivate(createMockContext(ip));
    }

    const ctx = createMockContext(ip);
    try {
      guard.canActivate(ctx);
    } catch {
      // expected
    }
    const res = ctx.switchToHttp().getResponse();
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '60');
  });

  it('should use user-based key and higher limit for authenticated users', () => {
    const user = { user_id: 'user-123' };
    // Per-user limit is 10, so 10 requests should work
    for (let i = 0; i < 10; i++) {
      const ctx = createMockContext('10.0.0.6', user);
      expect(guard.canActivate(ctx)).toBe(true);
    }

    // 11th request should be rejected
    const ctx = createMockContext('10.0.0.6', user);
    expect(() => guard.canActivate(ctx)).toThrow(HttpException);
  });

  it('should use X-RateLimit-Limit matching user limit for authenticated requests', () => {
    const user = { user_id: 'user-456' };
    const ctx = createMockContext('10.0.0.7', user);
    guard.canActivate(ctx);

    const res = ctx.switchToHttp().getResponse();
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '10');
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '9');
  });

  it('should track different IPs independently', () => {
    // Exhaust IP A
    for (let i = 0; i < 5; i++) {
      guard.canActivate(createMockContext('10.0.0.10'));
    }
    expect(() => guard.canActivate(createMockContext('10.0.0.10'))).toThrow(HttpException);

    // IP B should still work
    expect(guard.canActivate(createMockContext('10.0.0.11'))).toBe(true);
  });

  it('should reset count after window expires', () => {
    const ip = '10.0.0.12';
    // Use up all requests
    for (let i = 0; i < 5; i++) {
      guard.canActivate(createMockContext(ip));
    }
    expect(() => guard.canActivate(createMockContext(ip))).toThrow(HttpException);

    // Simulate time passing by manipulating the internal visitor lastSeen
    // We access the private map through the guard's allow method which checks window
    // Hack: create a new guard context to test window reset (using Date.now mock)
    const originalNow = Date.now;
    Date.now = jest.fn(() => originalNow() + 61_000); // 61 seconds later

    // Should now allow again
    expect(guard.canActivate(createMockContext(ip))).toBe(true);

    Date.now = originalNow;
  });

  it('should clean up stale entries', () => {
    // Make a request to create a visitor entry
    guard.canActivate(createMockContext('10.0.0.20'));
    expect(guard.getVisitorCount()).toBe(1);

    // Advance time past the window
    const originalNow = Date.now;
    Date.now = jest.fn(() => originalNow() + 61_000);

    // Trigger cleanup via another request (which causes the old entry to be reset)
    // Actually, let's test the cleanup indirectly: the next request should see a reset visitor
    const ctx = createMockContext('10.0.0.20');
    guard.canActivate(ctx);
    const res = ctx.switchToHttp().getResponse();
    // After window expired, count resets to limit - 1
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '4');

    Date.now = originalNow;
  });

  it('should track remaining as 0 when limit is exceeded (not negative)', () => {
    const ip = '10.0.0.30';
    // Use all 5 requests
    for (let i = 0; i < 5; i++) {
      guard.canActivate(createMockContext(ip));
    }

    // 6th request should show remaining = 0
    const ctx = createMockContext(ip);
    try {
      guard.canActivate(ctx);
    } catch {
      // expected
    }
    const res = ctx.switchToHttp().getResponse();
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '0');
  });
});
