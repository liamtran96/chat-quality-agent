import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  const port = config.get<number>('port') ?? 3000;
  const host = config.get<string>('host') ?? '127.0.0.1';

  await app.listen(port, host);
  console.log(`Application running on http://${host}:${port}`);
}
bootstrap();
