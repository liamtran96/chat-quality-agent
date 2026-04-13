import {
  Injectable,
  Logger,
  OnModuleInit,
  Inject,
  Optional,
} from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CronJob } from 'cron';
import { Channel } from '../entities/channel.entity';
import { Job } from '../entities/job.entity';
import { JobRun } from '../entities/job-run.entity';
import {
  ANALYZER_SERVICE,
  SYNC_SERVICE,
  AnalyzerServiceInterface,
  SyncServiceInterface,
} from './interfaces';

const JOB_TIMEOUT_MS = 30 * 60 * 1000;

@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    @InjectRepository(Channel)
    private readonly channelRepo: Repository<Channel>,
    @InjectRepository(Job)
    private readonly jobRepo: Repository<Job>,
    @InjectRepository(JobRun)
    private readonly jobRunRepo: Repository<JobRun>,
    @Inject(ANALYZER_SERVICE)
    @Optional()
    private readonly analyzerService: AnalyzerServiceInterface | null,
    @Inject(SYNC_SERVICE)
    @Optional()
    private readonly syncService: SyncServiceInterface | null,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('Initializing scheduler...');
    await this.cleanupStuckRuns();
    await this.loadCronJobs();
    this.startSyncLoop();
    this.logger.log('Scheduler started');
  }

  /** On startup, any "running" job_run is stuck because its process died with the previous instance. */
  async cleanupStuckRuns(): Promise<void> {
    const stuckRuns = await this.jobRunRepo.find({
      where: { status: 'running' },
    });

    for (const run of stuckRuns) {
      await this.jobRunRepo.update(run.id, {
        status: 'failed',
        finished_at: new Date(),
        error_message:
          'Hệ thống khởi động lại trong khi job đang chạy',
      });
      this.logger.log(
        `Marked stuck run ${run.id} as failed (started: ${run.started_at})`,
      );
    }

    if (stuckRuns.length > 0) {
      this.logger.log(`Cleaned up ${stuckRuns.length} stuck job runs`);
    }
  }

  private startSyncLoop(): void {
    const intervalMs = 5 * 60 * 1000;
    const handle = setInterval(() => {
      this.syncAllChannelsTask().catch((err) => {
        this.logger.error(`Sync loop error: ${err.message}`);
      });
    }, intervalMs);

    this.schedulerRegistry.addInterval('sync-all-channels', handle);
  }

  async syncAllChannelsTask(): Promise<void> {
    if (!this.syncService) {
      this.logger.warn('SyncService not available, skipping channel sync');
      return;
    }

    const channels = await this.channelRepo.find({
      where: { is_active: true },
    });

    const now = new Date();
    let synced = 0;

    for (const ch of channels) {
      let interval = 15; // minutes
      if (ch.metadata) {
        try {
          const meta =
            typeof ch.metadata === 'string'
              ? JSON.parse(ch.metadata)
              : ch.metadata;
          if (meta.sync_interval && Number(meta.sync_interval) > 0) {
            interval = Number(meta.sync_interval);
          }
        } catch {
          // ignore parse errors
        }
      }

      if (ch.last_sync_at) {
        const elapsed = now.getTime() - new Date(ch.last_sync_at).getTime();
        if (elapsed < interval * 60 * 1000) {
          continue;
        }
      }

      if (ch.last_sync_status === 'syncing') {
        continue;
      }

      try {
        await this.syncService.syncChannel(ch);
        synced++;
        this.triggerAfterSyncJobs(ch.tenant_id, ch.id);
      } catch (err) {
        this.logger.error(
          `Sync channel ${ch.name} failed: ${err.message}`,
        );
      }
    }

    if (synced > 0) {
      this.logger.log(`Synced ${synced}/${channels.length} channels`);
    }
  }

  async loadCronJobs(): Promise<void> {
    const jobs = await this.jobRepo.find({
      where: {
        is_active: true,
        schedule_type: 'cron',
      },
    });

    const cronJobs = jobs.filter((j) => j.schedule_cron?.trim());

    for (const job of cronJobs) {
      this.registerCronJob(job);
    }

    this.logger.log(`Loaded ${cronJobs.length} cron jobs`);
  }

  private registerCronJob(job: Job): void {
    const name = `job-${job.id}`;

    try {
      const cronJob = new CronJob(job.schedule_cron, () => {
        this.logger.log(`Running analysis job ${job.name} (${job.id})`);
        this.runAnalysisJob(job).catch((err) => {
          this.logger.error(`Job ${job.name} failed: ${err.message}`);
        });
      });

      this.schedulerRegistry.addCronJob(name, cronJob);
      cronJob.start();
    } catch (err) {
      this.logger.error(
        `Failed to schedule job ${job.name}: ${err.message}`,
      );
    }
  }

  private async runAnalysisJob(job: Job): Promise<void> {
    if (!this.analyzerService) {
      this.logger.warn('AnalyzerService not available, skipping job run');
      return;
    }
    await this.analyzerService.runJob(job, JOB_TIMEOUT_MS);
  }

  /** Called after job CRUD operations to re-sync the cron schedule with DB state. */
  async reloadJobs(): Promise<void> {
    const namesToDelete = Array.from(this.schedulerRegistry.getCronJobs().keys())
      .filter((name) => name.startsWith('job-'));
    for (const name of namesToDelete) {
      this.schedulerRegistry.deleteCronJob(name);
    }

    await this.loadCronJobs();
    this.logger.log('Cron jobs reloaded');
  }

  triggerAfterSyncJobs(tenantId: string, channelId: string): void {
    this.findAndRunAfterSyncJobs(tenantId, channelId).catch((err) => {
      this.logger.error(`Error triggering after_sync jobs: ${err.message}`);
    });
  }

  async findAndRunAfterSyncJobs(
    tenantId: string,
    channelId: string,
  ): Promise<void> {
    const jobs = await this.jobRepo.find({
      where: {
        tenant_id: tenantId,
        is_active: true,
        schedule_type: 'after_sync',
      },
    });

    for (const job of jobs) {
      try {
        const channelIds: string[] =
          typeof job.input_channel_ids === 'string'
            ? JSON.parse(job.input_channel_ids)
            : job.input_channel_ids;

        if (!Array.isArray(channelIds) || !channelIds.includes(channelId)) {
          continue;
        }

        this.logger.log(
          `After-sync trigger: job=${job.name} tenant=${tenantId} channel=${channelId}`,
        );

        this.runAnalysisJob(job).catch((err) => {
          this.logger.error(
            `After-sync job ${job.name} failed: ${err.message}`,
          );
        });
      } catch (err) {
        this.logger.error(
          `Error processing after_sync job ${job.id}: ${err.message}`,
        );
      }
    }
  }
}
