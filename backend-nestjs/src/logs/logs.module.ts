import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LogsController } from './logs.controller';
import { ActivityLogService } from './activity-log.service';
import { AuthModule } from '../auth/auth.module';
import { ActivityLog, AIUsageLog, AppSetting, NotificationLog } from '../entities';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ActivityLog,
      AIUsageLog,
      NotificationLog,
      AppSetting,
    ]),
    AuthModule,
  ],
  controllers: [LogsController],
  providers: [ActivityLogService],
  exports: [ActivityLogService],
})
export class LogsModule {}
