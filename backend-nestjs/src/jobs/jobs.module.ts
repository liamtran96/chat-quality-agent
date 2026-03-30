import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Job } from '../entities/job.entity';
import { JobRun } from '../entities/job-run.entity';
import { JobResult } from '../entities/job-result.entity';
import { AIUsageLog } from '../entities/ai-usage-log.entity';
import { NotificationLog } from '../entities/notification-log.entity';
import { Message } from '../entities/message.entity';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Job,
      JobRun,
      JobResult,
      AIUsageLog,
      NotificationLog,
      Message,
    ]),
  ],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
