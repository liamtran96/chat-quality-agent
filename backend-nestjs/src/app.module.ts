import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AIModule } from './ai/ai.module';
import { Tenant } from './entities/tenant.entity';
import { User } from './entities/user.entity';
import { UserTenant } from './entities/user-tenant.entity';
import { Channel } from './entities/channel.entity';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { Job } from './entities/job.entity';
import { JobRun } from './entities/job-run.entity';
import { JobResult } from './entities/job-result.entity';
import { AppSetting } from './entities/app-setting.entity';
import { ActivityLog } from './entities/activity-log.entity';
import { NotificationLog } from './entities/notification-log.entity';
import { AIUsageLog } from './entities/ai-usage-log.entity';
import { OAuthClient } from './entities/oauth-client.entity';
import { OAuthAuthorizationCode } from './entities/oauth-authorization-code.entity';
import { OAuthToken } from './entities/oauth-token.entity';

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
      envFilePath: ['.env', '.env.test'],
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
        entities,
        synchronize: configService.get<string>('APP_ENV', 'development') !== 'production',
        logging: configService.get<string>('APP_ENV', 'development') === 'development',
      }),
    }),
    AIModule,
  ],
})
export class AppModule {}
