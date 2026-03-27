import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Global exception filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // CORS
  const appEnv = process.env.APP_ENV || 'development';
  if (appEnv !== 'production') {
    app.enableCors();
  } else {
    app.enableCors({
      origin: true,
      methods: 'GET,POST,PUT,DELETE,OPTIONS',
      allowedHeaders: 'Authorization,Content-Type',
      credentials: true,
      maxAge: 86400,
    });
  }

  const port = parseInt(process.env.SERVER_PORT || '8080', 10);
  const host = process.env.SERVER_HOST || '0.0.0.0';

  await app.listen(port, host);
  logger.log(`CQA NestJS server running on ${host}:${port} (env: ${appEnv})`);
}
bootstrap();
