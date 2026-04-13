import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';

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
  NotificationLog,
  AIUsageLog,
  ActivityLog,
  OAuthClient,
  OAuthAuthorizationCode,
  OAuthToken,
} from './entities';

// Feature modules
import { NotificationsModule } from './notifications/notifications.module';
import { AgentsModule } from './agents/agents.module';
import { DemoModule } from './demo/demo.module';
import { FilesModule } from './files/files.module';
import { VersionModule } from './version/version.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USER || 'cqa',
      password: process.env.DB_PASSWORD || 'cqa_test_pass',
      database: process.env.DB_NAME || 'cqa',
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
        NotificationLog,
        AIUsageLog,
        ActivityLog,
        OAuthClient,
        OAuthAuthorizationCode,
        OAuthToken,
      ],
      synchronize: process.env.NODE_ENV !== 'production',
      logging: process.env.DB_LOGGING === 'true',
    }),
    NotificationsModule,
    AgentsModule,
    DemoModule,
    FilesModule,
    VersionModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
