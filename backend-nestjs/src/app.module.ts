import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from './common/config/configuration';
import { ALL_ENTITIES } from './entities';
import { AppController } from './app.controller';
import { CorsMiddleware } from './common/middleware/cors.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const env = configService.get<string>('app.env', 'development');
        const isProduction = env === 'production';

        return {
          type: 'postgres',
          host: configService.get<string>('app.database.host'),
          port: configService.get<number>('app.database.port'),
          username: configService.get<string>('app.database.username'),
          password: configService.get<string>('app.database.password'),
          database: configService.get<string>('app.database.name'),
          entities: ALL_ENTITIES,
          synchronize: !isProduction,
          logging: isProduction ? ['warn', 'error'] : true,
          extra: {
            max: 100,
            min: 10,
          },
        };
      },
    }),
  ],
  controllers: [AppController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorsMiddleware).forRoutes('*');
  }
}
