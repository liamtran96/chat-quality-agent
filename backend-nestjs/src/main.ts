import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.get<number>('SERVER_PORT', 3000);
  const host = configService.get<string>('SERVER_HOST', '127.0.0.1');

  app.enableCors();

  await app.listen(port, host);
  console.log(`Server running on http://${host}:${port}`);
}
bootstrap();
