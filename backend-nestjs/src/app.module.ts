import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfig } from './common/config';
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
import { ConversationsModule } from './conversations/conversations.module';

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
      load: [databaseConfig],
      envFilePath: ['.env', '.env.test'],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        username: configService.get<string>('database.username'),
        password: configService.get<string>('database.password'),
        database: configService.get<string>('database.database'),
        entities,
        synchronize: true,
      }),
    }),
    ConversationsModule,
  ],
})
export class AppModule {}
