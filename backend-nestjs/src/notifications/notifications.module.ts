import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobResult } from '../entities/job-result.entity';
import { AppSetting } from '../entities/app-setting.entity';
import { NotificationLog } from '../entities/notification-log.entity';
import { DispatcherService } from './dispatcher.service';

@Module({
  imports: [TypeOrmModule.forFeature([JobResult, AppSetting, NotificationLog])],
  providers: [DispatcherService],
  exports: [DispatcherService],
})
export class NotificationsModule {}
