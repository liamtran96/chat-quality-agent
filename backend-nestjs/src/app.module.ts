import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from './common/config/configuration';
import { TenantsModule } from './tenants/tenants.module';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres' as const,
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        username: configService.get<string>('database.username'),
        password: configService.get<string>('database.password'),
        database: configService.get<string>('database.database'),
        entities: [
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
        ],
        synchronize: configService.get<string>('NODE_ENV') !== 'production',
        logging: configService.get<string>('NODE_ENV') === 'development',
      }),
    }),
    TenantsModule,
  ],
})
export class AppModule {}
