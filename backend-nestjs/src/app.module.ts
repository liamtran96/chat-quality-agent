import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from './common/config/configuration';
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
import { NotificationLog } from './entities/notification-log.entity';
import { AIUsageLog } from './entities/ai-usage-log.entity';
import { ActivityLog } from './entities/activity-log.entity';
import { OAuthClient } from './entities/oauth-client.entity';
import { OAuthAuthorizationCode } from './entities/oauth-authorization-code.entity';
import { OAuthToken } from './entities/oauth-token.entity';
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
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('database.host'),
        port: config.get<number>('database.port'),
        username: config.get<string>('database.username'),
        password: config.get<string>('database.password'),
        database: config.get<string>('database.database'),
        entities,
        synchronize: config.get<string>('env') !== 'production',
      }),
    }),
    McpModule,
  ],
})
export class AppModule {}
