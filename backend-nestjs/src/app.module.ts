import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from './common/config/configuration';
import { CryptoModule } from './common/crypto/crypto.module';
import { ChannelsModule } from './channels/channels.module';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env', '.env.test'],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        username: configService.get<string>('database.username'),
        password: configService.get<string>('database.password'),
        database: configService.get<string>('database.database'),
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
          ActivityLog,
          AppSetting,
          NotificationLog,
          AIUsageLog,
          OAuthClient,
          OAuthAuthorizationCode,
          OAuthToken,
        ],
        synchronize: true,
        logging: configService.get<string>('env') === 'development',
      }),
    }),
    CryptoModule,
    ChannelsModule,
  ],
})
export class AppModule {}
