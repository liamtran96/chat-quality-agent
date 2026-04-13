import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Channel } from '../entities/channel.entity';
import { Job } from '../entities/job.entity';
import { JobRun } from '../entities/job-run.entity';
import { SchedulerService } from './scheduler.service';
import { ANALYZER_SERVICE, SYNC_SERVICE } from './interfaces';

// Placeholder implementations -- real services injected when full module is assembled
const noopAnalyzerService = { async runJob() {} };
const noopSyncService = { async syncChannel() {} };

@Module({
  imports: [TypeOrmModule.forFeature([Channel, Job, JobRun])],
  providers: [
    SchedulerService,
    { provide: ANALYZER_SERVICE, useValue: noopAnalyzerService },
    { provide: SYNC_SERVICE, useValue: noopSyncService },
  ],
  exports: [SchedulerService],
})
export class EngineModule {}
