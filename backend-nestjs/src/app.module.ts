import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import appConfig from './common/config/app.config';
import { CryptoModule } from './common/crypto/crypto.module';
import { AuthModule } from './auth/auth.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SettingsModule } from './settings/settings.module';
import { UsersModule } from './users/users.module';
import { LogsModule } from './logs/logs.module';

import {
  Tenant,
  User,
  UserTenant,
  Channel,
  Conversation,
  Message,
  Job,
  JobRun,
  JobResult,
  AppSetting,
  ActivityLog,
  NotificationLog,
  AIUsageLog,
  OAuthClient,
  OAuthAuthorizationCode,
  OAuthToken,
} from './entities';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get<string>('DB_USER', 'cqa'),
        password: configService.get<string>('DB_PASSWORD', ''),
        database: configService.get<string>('DB_NAME', 'cqa'),
        entities: [
          Tenant,
          User,
          UserTenant,
          Channel,
          Conversation,
          Message,
          Job,
          JobRun,
          JobResult,
          AppSetting,
          ActivityLog,
          NotificationLog,
          AIUsageLog,
          OAuthClient,
          OAuthAuthorizationCode,
          OAuthToken,
        ],
        synchronize: configService.get<string>('APP_ENV', 'development') !== 'production',
        logging: configService.get<string>('APP_ENV', 'development') === 'development',
      }),
    }),
    CryptoModule,
    AuthModule,
    DashboardModule,
    SettingsModule,
    UsersModule,
    LogsModule,
  ],
})
export class AppModule {}
