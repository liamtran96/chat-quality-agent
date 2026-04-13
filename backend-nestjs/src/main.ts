import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  app.enableCors();

  const configService = app.get(ConfigService);
  const port = configService.get<number>('server.port', 3000);
  const host = configService.get<string>('server.host', '127.0.0.1');

  await app.listen(port, host);
  console.log(`CQA NestJS server starting on ${host}:${port}`);
}
bootstrap();
