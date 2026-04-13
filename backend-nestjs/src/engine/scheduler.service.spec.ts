import { Test, TestingModule } from '@nestjs/testing';
import { SchedulerRegistry } from '@nestjs/schedule';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SchedulerService } from './scheduler.service';
import { Channel } from '../entities/channel.entity';
import { Job } from '../entities/job.entity';
import { JobRun } from '../entities/job-run.entity';
import {
  ANALYZER_SERVICE,
  SYNC_SERVICE,
  AnalyzerServiceInterface,
  SyncServiceInterface,
} from './interfaces';

describe('SchedulerService', () => {
  let service: SchedulerService;
  let channelRepo: jest.Mocked<Repository<Channel>>;
  let jobRepo: jest.Mocked<Repository<Job>>;
  let jobRunRepo: jest.Mocked<Repository<JobRun>>;
  let analyzerService: jest.Mocked<AnalyzerServiceInterface>;
  let syncService: jest.Mocked<SyncServiceInterface>;
  let schedulerRegistry: SchedulerRegistry;

  beforeEach(async () => {
    analyzerService = {
      runJob: jest.fn().mockResolvedValue(undefined),
    };

    syncService = {
      syncChannel: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulerService,
        SchedulerRegistry,
        {
          provide: getRepositoryToken(Channel),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
            update: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: getRepositoryToken(Job),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: getRepositoryToken(JobRun),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
            update: jest.fn().mockResolvedValue(undefined),
          },
        },
        { provide: ANALYZER_SERVICE, useValue: analyzerService },
        { provide: SYNC_SERVICE, useValue: syncService },
      ],
    }).compile();

    service = module.get<SchedulerService>(SchedulerService);
    channelRepo = module.get(getRepositoryToken(Channel));
    jobRepo = module.get(getRepositoryToken(Job));
    jobRunRepo = module.get(getRepositoryToken(JobRun));
    schedulerRegistry = module.get(SchedulerRegistry);
  });

  afterEach(() => {
    // Clean up any registered intervals/cron jobs
    try {
      const intervals = schedulerRegistry.getIntervals();
      for (const name of intervals) {
        schedulerRegistry.deleteInterval(name);
      }
    } catch {
      // ignore
    }
    try {
      const cronJobs = schedulerRegistry.getCronJobs();
      for (const [name] of cronJobs) {
        schedulerRegistry.deleteCronJob(name);
      }
    } catch {
      // ignore
    }
  });

  describe('cleanupStuckRuns', () => {
    it('should mark running job runs as failed on startup', async () => {
      const stuckRuns = [
        {
          id: 'run-1',
          status: 'running',
          started_at: new Date('2024-01-01'),
        },
        {
          id: 'run-2',
          status: 'running',
          started_at: new Date('2024-01-02'),
        },
      ] as JobRun[];

      jobRunRepo.find.mockResolvedValue(stuckRuns);

      await service.cleanupStuckRuns();

      expect(jobRunRepo.find).toHaveBeenCalledWith({
        where: { status: 'running' },
      });
      expect(jobRunRepo.update).toHaveBeenCalledTimes(2);
      expect(jobRunRepo.update).toHaveBeenCalledWith('run-1', {
        status: 'failed',
        finished_at: expect.any(Date),
        error_message:
          'Hệ thống khởi động lại trong khi job đang chạy',
      });
      expect(jobRunRepo.update).toHaveBeenCalledWith('run-2', {
        status: 'failed',
        finished_at: expect.any(Date),
        error_message:
          'Hệ thống khởi động lại trong khi job đang chạy',
      });
    });

    it('should handle no stuck runs gracefully', async () => {
      jobRunRepo.find.mockResolvedValue([]);

      await service.cleanupStuckRuns();

      expect(jobRunRepo.find).toHaveBeenCalledWith({
        where: { status: 'running' },
      });
      expect(jobRunRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('loadCronJobs', () => {
    it('should load active cron jobs from the database', async () => {
      const jobs = [
        {
          id: 'job-1',
          name: 'QC Analysis Daily',
          schedule_type: 'cron',
          schedule_cron: '0 9 * * *',
          is_active: true,
        } as Job,
      ];

      jobRepo.find.mockResolvedValue(jobs);

      await service.loadCronJobs();

      expect(jobRepo.find).toHaveBeenCalledWith({
        where: {
          is_active: true,
          schedule_type: 'cron',
        },
      });

      // Verify the cron job was registered
      const cronJobs = schedulerRegistry.getCronJobs();
      expect(cronJobs.has('job-job-1')).toBe(true);
    });

    it('should skip jobs with empty schedule_cron', async () => {
      const jobs = [
        {
          id: 'job-empty',
          name: 'Empty Cron',
          schedule_type: 'cron',
          schedule_cron: '',
          is_active: true,
        } as Job,
      ];

      jobRepo.find.mockResolvedValue(jobs);

      await service.loadCronJobs();

      const cronJobs = schedulerRegistry.getCronJobs();
      expect(cronJobs.has('job-job-empty')).toBe(false);
    });
  });

  describe('reloadJobs', () => {
    it('should remove existing dynamic cron jobs and reload', async () => {
      // First load some cron jobs
      const initialJobs = [
        {
          id: 'old-job',
          name: 'Old Job',
          schedule_type: 'cron',
          schedule_cron: '0 9 * * *',
          is_active: true,
        } as Job,
      ];
      jobRepo.find.mockResolvedValueOnce(initialJobs);
      await service.loadCronJobs();

      expect(schedulerRegistry.getCronJobs().has('job-old-job')).toBe(true);

      // Now reload with different jobs
      const newJobs = [
        {
          id: 'new-job',
          name: 'New Job',
          schedule_type: 'cron',
          schedule_cron: '0 18 * * *',
          is_active: true,
        } as Job,
      ];
      jobRepo.find.mockResolvedValueOnce(newJobs);

      await service.reloadJobs();

      const cronJobs = schedulerRegistry.getCronJobs();
      expect(cronJobs.has('job-old-job')).toBe(false);
      expect(cronJobs.has('job-new-job')).toBe(true);
    });
  });

  describe('triggerAfterSyncJobs / findAndRunAfterSyncJobs', () => {
    it('should run jobs that include the synced channel ID', async () => {
      const jobs = [
        {
          id: 'job-sync-1',
          name: 'After Sync Job',
          tenant_id: 'tenant-1',
          schedule_type: 'after_sync',
          is_active: true,
          input_channel_ids: JSON.stringify(['channel-A', 'channel-B']),
        } as Job,
        {
          id: 'job-sync-2',
          name: 'Another Sync Job',
          tenant_id: 'tenant-1',
          schedule_type: 'after_sync',
          is_active: true,
          input_channel_ids: JSON.stringify(['channel-C']),
        } as Job,
      ];

      jobRepo.find.mockResolvedValue(jobs);

      await service.findAndRunAfterSyncJobs('tenant-1', 'channel-A');

      // Only the first job should have been called (contains channel-A)
      expect(analyzerService.runJob).toHaveBeenCalledTimes(1);
      expect(analyzerService.runJob).toHaveBeenCalledWith(
        jobs[0],
        30 * 60 * 1000,
      );
    });

    it('should not run jobs if channel ID is not in input_channel_ids', async () => {
      const jobs = [
        {
          id: 'job-no-match',
          name: 'No Match Job',
          tenant_id: 'tenant-1',
          schedule_type: 'after_sync',
          is_active: true,
          input_channel_ids: JSON.stringify(['channel-X', 'channel-Y']),
        } as Job,
      ];

      jobRepo.find.mockResolvedValue(jobs);

      await service.findAndRunAfterSyncJobs('tenant-1', 'channel-Z');

      expect(analyzerService.runJob).not.toHaveBeenCalled();
    });

    it('should handle invalid JSON in input_channel_ids', async () => {
      const jobs = [
        {
          id: 'job-bad-json',
          name: 'Bad JSON Job',
          tenant_id: 'tenant-1',
          schedule_type: 'after_sync',
          is_active: true,
          input_channel_ids: 'not-valid-json',
        } as Job,
      ];

      jobRepo.find.mockResolvedValue(jobs);

      // Should not throw
      await service.findAndRunAfterSyncJobs('tenant-1', 'channel-A');

      expect(analyzerService.runJob).not.toHaveBeenCalled();
    });
  });

  describe('syncAllChannelsTask', () => {
    it('should sync channels that are due', async () => {
      const channels = [
        {
          id: 'ch-1',
          name: 'Channel 1',
          tenant_id: 'tenant-1',
          is_active: true,
          last_sync_at: new Date(Date.now() - 20 * 60 * 1000), // 20 min ago
          last_sync_status: 'success',
          metadata: JSON.stringify({ sync_interval: 15 }),
        } as unknown as Channel,
      ];

      channelRepo.find.mockResolvedValue(channels);
      jobRepo.find.mockResolvedValue([]); // no after_sync jobs

      await service.syncAllChannelsTask();

      expect(syncService.syncChannel).toHaveBeenCalledWith(channels[0]);
    });

    it('should skip channels synced too recently', async () => {
      const channels = [
        {
          id: 'ch-2',
          name: 'Channel 2',
          tenant_id: 'tenant-1',
          is_active: true,
          last_sync_at: new Date(Date.now() - 5 * 60 * 1000), // 5 min ago
          last_sync_status: 'success',
          metadata: JSON.stringify({ sync_interval: 15 }),
        } as unknown as Channel,
      ];

      channelRepo.find.mockResolvedValue(channels);

      await service.syncAllChannelsTask();

      expect(syncService.syncChannel).not.toHaveBeenCalled();
    });

    it('should skip channels with syncing status', async () => {
      const channels = [
        {
          id: 'ch-3',
          name: 'Channel 3',
          tenant_id: 'tenant-1',
          is_active: true,
          last_sync_at: new Date(Date.now() - 20 * 60 * 1000),
          last_sync_status: 'syncing',
          metadata: null,
        } as unknown as Channel,
      ];

      channelRepo.find.mockResolvedValue(channels);

      await service.syncAllChannelsTask();

      expect(syncService.syncChannel).not.toHaveBeenCalled();
    });

    it('should use default 15-minute interval when no metadata', async () => {
      const channels = [
        {
          id: 'ch-4',
          name: 'Channel 4',
          tenant_id: 'tenant-1',
          is_active: true,
          last_sync_at: new Date(Date.now() - 10 * 60 * 1000), // 10 min ago
          last_sync_status: 'success',
          metadata: null,
        } as unknown as Channel,
      ];

      channelRepo.find.mockResolvedValue(channels);

      await service.syncAllChannelsTask();

      // Default interval is 15 min, last sync 10 min ago -> should skip
      expect(syncService.syncChannel).not.toHaveBeenCalled();
    });

    it('should sync channels with no previous sync', async () => {
      const channels = [
        {
          id: 'ch-5',
          name: 'Channel 5',
          tenant_id: 'tenant-1',
          is_active: true,
          last_sync_at: null,
          last_sync_status: null,
          metadata: null,
        } as unknown as Channel,
      ];

      channelRepo.find.mockResolvedValue(channels);
      jobRepo.find.mockResolvedValue([]);

      await service.syncAllChannelsTask();

      expect(syncService.syncChannel).toHaveBeenCalledWith(channels[0]);
    });
  });
});
