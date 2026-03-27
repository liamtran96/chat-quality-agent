import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { GlobalHttpExceptionFilter } from './common/filters/http-exception.filter';
import { SecurityHeadersInterceptor } from './common/interceptors/security-headers.interceptor';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new GlobalHttpExceptionFilter());
  app.useGlobalInterceptors(new SecurityHeadersInterceptor());

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.server.port', 8080);

  await app.listen(port);
  logger.log(`Application listening on port ${port}`);
}

bootstrap();
