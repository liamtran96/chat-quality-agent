import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: true,
    credentials: true,
    methods: 'GET,POST,PUT,DELETE,OPTIONS',
    allowedHeaders: 'Authorization,Content-Type',
  });

  const port = process.env.SERVER_PORT || 3000;
  await app.listen(port);
  console.log(`CQA NestJS backend listening on port ${port}`);
}
bootstrap();
