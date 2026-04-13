import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { appConfig, databaseConfig } from './common/config';
import { EngineModule } from './engine/engine.module';
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
  ActivityLog,
  AppSetting,
  NotificationLog,
  AIUsageLog,
  OAuthClient,
  OAuthAuthorizationCode,
  OAuthToken,
} from './entities';

const entities = [
  Tenant,
  User,
  UserTenant,
  Channel,
  Conversation,
  Message,
  Job,
  JobRun,
  JobResult,
  ActivityLog,
  AppSetting,
  NotificationLog,
  AIUsageLog,
  OAuthClient,
  OAuthAuthorizationCode,
  OAuthToken,
];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('database.host'),
        port: config.get('database.port'),
        username: config.get('database.username'),
        password: config.get('database.password'),
        database: config.get('database.database'),
        entities,
        synchronize: config.get('app.env') !== 'production',
      }),
    }),
    ScheduleModule.forRoot(),
    EngineModule,
  ],
})
export class AppModule {}
