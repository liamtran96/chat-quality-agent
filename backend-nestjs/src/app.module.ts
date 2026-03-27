import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';

import configuration from './common/config/configuration';
import { RateLimitGuard } from './common/guards/rate-limit.guard';

// Entities
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

// Feature modules
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { TenantsModule } from './tenants/tenants.module';
import { UsersModule } from './users/users.module';
import { ChannelsModule } from './channels/channels.module';
import { ConversationsModule } from './conversations/conversations.module';
import { JobsModule } from './jobs/jobs.module';
import { AIModule } from './ai/ai.module';
import { EngineModule } from './engine/engine.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SettingsModule } from './settings/settings.module';
import { LogsModule } from './logs/logs.module';
import { AgentsModule } from './agents/agents.module';
import { DemoModule } from './demo/demo.module';
import { FilesModule } from './files/files.module';
import { McpModule } from './mcp/mcp.module';

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
  AppSetting,
  ActivityLog,
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
      load: [configuration],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.get<string>('DATABASE_URL') || undefined,
        host: config.get<string>('DATABASE_URL') ? undefined : config.get<string>('DB_HOST'),
        port: config.get<string>('DATABASE_URL') ? undefined : config.get<number>('DB_PORT'),
        username: config.get<string>('DATABASE_URL') ? undefined : config.get<string>('DB_USER'),
        password: config.get<string>('DATABASE_URL') ? undefined : config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DATABASE_URL') ? undefined : config.get<string>('DB_NAME'),
        entities,
        synchronize: config.get<string>('APP_ENV') !== 'production',
        logging:
          config.get<string>('APP_ENV') !== 'production'
            ? 'all' as const
            : (['warn', 'error'] as const),
        extra: {
          max: 100,
          min: 10,
        },
      }),
      inject: [ConfigService],
    }),
    ScheduleModule.forRoot(),
    // Feature modules
    HealthModule,
    AuthModule,
    TenantsModule,
    UsersModule,
    ChannelsModule,
    ConversationsModule,
    JobsModule,
    AIModule,
    EngineModule,
    NotificationsModule,
    DashboardModule,
    SettingsModule,
    LogsModule,
    AgentsModule,
    DemoModule,
    FilesModule,
    McpModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
  ],
})
export class AppModule {}
