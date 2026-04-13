import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from './common/config/configuration';
import { CryptoModule } from './common/crypto/crypto.module';
import { AuthModule } from './auth/auth.module';

// Entities
import {
  User,
  UserTenant,
  Tenant,
  Channel,
  Conversation,
  Message,
  Job,
  JobRun,
  JobResult,
  AppSetting,
  NotificationLog,
  AIUsageLog,
  ActivityLog,
  OAuthClient,
  OAuthAuthorizationCode,
  OAuthToken,
} from './entities';

const entities = [
  User,
  UserTenant,
  Tenant,
  Channel,
  Conversation,
  Message,
  Job,
  JobRun,
  JobResult,
  AppSetting,
  NotificationLog,
  AIUsageLog,
  ActivityLog,
  OAuthClient,
  OAuthAuthorizationCode,
  OAuthToken,
];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('database.url'),
        entities,
        synchronize: true, // Auto-sync schema (dev/test only)
        logging: configService.get<string>('app.env') === 'development',
      }),
      inject: [ConfigService],
    }),
    CryptoModule,
    AuthModule,
  ],
})
export class AppModule {}
