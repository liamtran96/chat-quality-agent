import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
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

  const port = process.env.SERVER_PORT || 3000;
  const host = process.env.SERVER_HOST || '127.0.0.1';
  await app.listen(port, host);

  console.log(`Server running on http://${host}:${port}`);
}

bootstrap();
