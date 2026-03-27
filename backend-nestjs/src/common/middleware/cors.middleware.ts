import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class CorsMiddleware implements NestMiddleware {
  private readonly isProduction: boolean;

  constructor(private readonly configService: ConfigService) {
    this.isProduction = this.configService.get<string>('app.env') === 'production';
  }

  use(req: Request, res: Response, next: NextFunction): void {
    const requestOrigin = req.headers.origin ?? '';
    let allowedOrigin = requestOrigin;

    if (this.isProduction && requestOrigin) {
      const host = req.headers.host ?? '';
      if (!requestOrigin.includes(host)) {
        allowedOrigin = '';
      }
    }

    if (allowedOrigin) {
      res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    next();
  }
}
