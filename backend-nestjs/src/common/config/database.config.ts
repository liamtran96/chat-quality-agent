import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

export function getDatabaseConfig(configService: ConfigService): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    host: configService.get<string>('DB_HOST', 'localhost'),
    port: configService.get<number>('DB_PORT', 5433),
    username: configService.get<string>('DB_USER', 'cqa_test'),
    password: configService.get<string>('DB_PASSWORD', 'cqa_test_pass'),
    database: configService.get<string>('DB_NAME', 'cqa_test'),
    synchronize: configService.get<boolean>('DB_SYNC', true),
    logging: configService.get<string>('DB_LOGGING', 'false') === 'true',
  };
}
