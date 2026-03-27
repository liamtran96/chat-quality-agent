import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as http from 'http';
import { AppModule } from '../src/app.module';

// Simple HTTP request helper to avoid adding supertest dependency
function request(
  app: INestApplication,
  method: string,
  path: string,
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: any }> {
  return new Promise((resolve, reject) => {
    const server = app.getHttpServer();
    const req = http.request(
      {
        hostname: 'localhost',
        port: (server.address() as any).port,
        path,
        method,
        headers: { 'Content-Type': 'application/json' },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let body: any;
          try {
            body = JSON.parse(data);
          } catch {
            body = data;
          }
          resolve({ status: res.statusCode!, headers: res.headers, body });
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

describe('App (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    await app.listen(0); // random port
  }, 30000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('GET /health', () => {
    it('should return 200 with status ok', async () => {
      const res = await request(app, 'GET', '/health');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'ok');
      expect(res.body).toHaveProperty('version');
    });
  });

  describe('Rate Limiting', () => {
    it('should include rate limit headers on every response', async () => {
      const res = await request(app, 'GET', '/health');
      expect(res.headers['x-ratelimit-limit']).toBeDefined();
      expect(res.headers['x-ratelimit-remaining']).toBeDefined();
    });

    it('should decrement remaining count', async () => {
      // Make two sequential requests to verify decrementing
      const res1 = await request(app, 'GET', '/health');
      const remaining1 = parseInt(res1.headers['x-ratelimit-remaining'] as string, 10);

      const res2 = await request(app, 'GET', '/health');
      const remaining2 = parseInt(res2.headers['x-ratelimit-remaining'] as string, 10);

      expect(remaining2).toBeLessThan(remaining1);
    });
  });

  describe('App bootstrap', () => {
    it('should start without errors', () => {
      expect(app).toBeDefined();
      const server = app.getHttpServer();
      expect(server).toBeDefined();
      expect((server.address() as any).port).toBeGreaterThan(0);
    });
  });
});
