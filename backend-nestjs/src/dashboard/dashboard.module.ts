import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { AuthModule } from '../auth/auth.module';
import {
  Channel,
  Conversation,
  Job,
  JobRun,
  JobResult,
  AIUsageLog,
  AppSetting,
  Message,
} from '../entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Channel,
      Conversation,
      Job,
      JobRun,
      JobResult,
      AIUsageLog,
      AppSetting,
      Message,
    ]),
    AuthModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
