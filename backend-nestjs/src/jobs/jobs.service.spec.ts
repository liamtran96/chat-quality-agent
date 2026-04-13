import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { Job } from '../entities/job.entity';
import { JobRun } from '../entities/job-run.entity';
import { JobResult } from '../entities/job-result.entity';
import { AIUsageLog } from '../entities/ai-usage-log.entity';
import { NotificationLog } from '../entities/notification-log.entity';
import { Message } from '../entities/message.entity';

// Helper to create mock repositories
function createMockRepo() {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
}

// Helper to create chainable query builder mock
function createMockQueryBuilder(returnValue?: any) {
  const qb: any = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue(returnValue ?? { affected: 1 }),
    getRawMany: jest.fn().mockResolvedValue(returnValue ?? []),
  };
  return qb;
}

describe('JobsService', () => {
  let service: JobsService;
  let jobRepo: Record<string, jest.Mock>;
  let jobRunRepo: Record<string, jest.Mock>;
  let jobResultRepo: Record<string, jest.Mock>;
  let aiUsageLogRepo: Record<string, jest.Mock>;
  let notificationLogRepo: Record<string, jest.Mock>;
  let messageRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    jobRepo = createMockRepo();
    jobRunRepo = createMockRepo();
    jobResultRepo = createMockRepo();
    aiUsageLogRepo = createMockRepo();
    notificationLogRepo = createMockRepo();
    messageRepo = createMockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobsService,
        { provide: getRepositoryToken(Job), useValue: jobRepo },
        { provide: getRepositoryToken(JobRun), useValue: jobRunRepo },
        { provide: getRepositoryToken(JobResult), useValue: jobResultRepo },
        { provide: getRepositoryToken(AIUsageLog), useValue: aiUsageLogRepo },
        { provide: getRepositoryToken(NotificationLog), useValue: notificationLogRepo },
        { provide: getRepositoryToken(Message), useValue: messageRepo },
      ],
    }).compile();

    service = module.get<JobsService>(JobsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── Whitelist update logic ───────────────────────────────────────────
  describe('updateJob', () => {
    it('should only update whitelisted fields', async () => {
      const qb = createMockQueryBuilder({ affected: 1 });
      jobRepo.createQueryBuilder.mockReturnValue(qb);

      await service.updateJob('tenant-1', 'job-1', {
        name: 'New Name',
        id: 'hacked-id',
        tenant_id: 'hacked-tenant',
        description: 'Updated desc',
      });

      // The set() call should receive only allowed fields
      const setArg = qb.set.mock.calls[0][0];
      expect(setArg).toHaveProperty('name', 'New Name');
      expect(setArg).toHaveProperty('description', 'Updated desc');
      expect(setArg).not.toHaveProperty('id');
      expect(setArg).not.toHaveProperty('tenant_id');
      expect(setArg).toHaveProperty('updated_at');
    });

    it('should throw NotFoundException when job not found', async () => {
      const qb = createMockQueryBuilder({ affected: 0 });
      jobRepo.createQueryBuilder.mockReturnValue(qb);

      await expect(
        service.updateJob('tenant-1', 'nonexistent', { name: 'test' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should accept schedule fields', async () => {
      const qb = createMockQueryBuilder({ affected: 1 });
      jobRepo.createQueryBuilder.mockReturnValue(qb);

      await service.updateJob('tenant-1', 'job-1', {
        schedule_type: 'cron',
        schedule_cron: '0 * * * *',
        ai_provider: 'gemini',
      });

      const setArg = qb.set.mock.calls[0][0];
      expect(setArg).toHaveProperty('schedule_type', 'cron');
      expect(setArg).toHaveProperty('schedule_cron', '0 * * * *');
      expect(setArg).toHaveProperty('ai_provider', 'gemini');
    });

    it('should preserve JSON fields as-is for TypeORM', async () => {
      const qb = createMockQueryBuilder({ affected: 1 });
      jobRepo.createQueryBuilder.mockReturnValue(qb);

      const outputsValue = [{ type: 'telegram' }];
      await service.updateJob('tenant-1', 'job-1', {
        outputs: outputsValue,
        input_channel_ids: ['ch1', 'ch2'],
      });

      const setArg = qb.set.mock.calls[0][0];
      expect(setArg.outputs).toEqual(outputsValue);
      expect(setArg.input_channel_ids).toEqual(['ch1', 'ch2']);
    });
  });

  // ─── Cascade delete ───────────────────────────────────────────────────
  describe('deleteJob', () => {
    it('should cascade delete results, runs, usage logs, notification logs, then job', async () => {
      const job = {
        id: 'job-1',
        tenant_id: 'tenant-1',
        schedule_type: 'manual',
        name: 'Test Job',
      };
      jobRepo.findOne.mockResolvedValue(job);
      jobRunRepo.find.mockResolvedValue([
        { id: 'run-1' },
        { id: 'run-2' },
      ]);
      jobResultRepo.delete.mockResolvedValue({ affected: 5 });
      jobRunRepo.delete.mockResolvedValue({ affected: 2 });
      aiUsageLogRepo.delete.mockResolvedValue({ affected: 3 });
      notificationLogRepo.delete.mockResolvedValue({ affected: 1 });
      jobRepo.delete.mockResolvedValue({ affected: 1 });

      const result = await service.deleteJob('tenant-1', 'job-1');

      expect(result).toEqual({ message: 'deleted' });

      // Verify cascade order: results first (using run IDs)
      expect(jobResultRepo.delete).toHaveBeenCalled();
      const resultDeleteArgs = jobResultRepo.delete.mock.calls[0][0];
      expect(resultDeleteArgs.tenant_id).toBe('tenant-1');

      // Then runs
      expect(jobRunRepo.delete).toHaveBeenCalledWith({
        job_id: 'job-1',
        tenant_id: 'tenant-1',
      });

      // Then AI usage logs
      expect(aiUsageLogRepo.delete).toHaveBeenCalledWith({
        job_id: 'job-1',
        tenant_id: 'tenant-1',
      });

      // Then notification logs
      expect(notificationLogRepo.delete).toHaveBeenCalledWith({
        job_id: 'job-1',
        tenant_id: 'tenant-1',
      });

      // Finally the job itself
      expect(jobRepo.delete).toHaveBeenCalledWith({
        id: 'job-1',
        tenant_id: 'tenant-1',
      });
    });

    it('should throw NotFoundException when job not found', async () => {
      jobRepo.findOne.mockResolvedValue(null);

      await expect(service.deleteJob('tenant-1', 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle delete when no runs exist', async () => {
      const job = {
        id: 'job-1',
        tenant_id: 'tenant-1',
        schedule_type: 'manual',
        name: 'Test Job',
      };
      jobRepo.findOne.mockResolvedValue(job);
      jobRunRepo.find.mockResolvedValue([]);
      jobRunRepo.delete.mockResolvedValue({ affected: 0 });
      aiUsageLogRepo.delete.mockResolvedValue({ affected: 0 });
      notificationLogRepo.delete.mockResolvedValue({ affected: 0 });
      jobRepo.delete.mockResolvedValue({ affected: 1 });

      const result = await service.deleteJob('tenant-1', 'job-1');
      expect(result).toEqual({ message: 'deleted' });

      // Results delete should NOT be called (no runs)
      expect(jobResultRepo.delete).not.toHaveBeenCalled();
    });
  });

  // ─── Create Job ───────────────────────────────────────────────────────
  describe('createJob', () => {
    it('should create a job with correct fields', async () => {
      const dto = {
        name: 'My Job',
        description: 'A test job',
        job_type: 'qc_analysis' as const,
        input_channel_ids: ['ch-1'],
        rules_content: 'rule 1',
        outputs: [{ type: 'telegram' }],
        output_schedule: 'instant' as const,
        schedule_type: 'manual' as const,
      };

      jobRepo.create.mockImplementation((data) => data);
      jobRepo.save.mockImplementation(async (data) => data);

      const result = await service.createJob('tenant-1', dto);

      expect(result.tenant_id).toBe('tenant-1');
      expect(result.name).toBe('My Job');
      expect(result.job_type).toBe('qc_analysis');
      expect(result.is_active).toBe(true);
      expect(result.id).toBeDefined();
    });
  });

  // ─── Get Job ──────────────────────────────────────────────────────────
  describe('getJob', () => {
    it('should return the job when found', async () => {
      const job = { id: 'job-1', tenant_id: 'tenant-1', name: 'Job' };
      jobRepo.findOne.mockResolvedValue(job);

      const result = await service.getJob('tenant-1', 'job-1');
      expect(result).toEqual(job);
    });

    it('should throw NotFoundException when not found', async () => {
      jobRepo.findOne.mockResolvedValue(null);

      await expect(service.getJob('tenant-1', 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── Cancel Job ───────────────────────────────────────────────────────
  describe('cancelJob', () => {
    it('should mark running runs as cancelled', async () => {
      const job = { id: 'job-1', tenant_id: 'tenant-1' };
      jobRepo.findOne.mockResolvedValue(job);

      const qb = createMockQueryBuilder({ affected: 1 });
      jobRunRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.cancelJob('tenant-1', 'job-1');
      expect(result).toEqual({ message: 'job_cancelled' });

      // Should update status to cancelled
      const setArg = qb.set.mock.calls[0][0];
      expect(setArg.status).toBe('cancelled');
      expect(setArg.error_message).toBe('Cancelled by user');
    });
  });

  // ─── Clear Results ────────────────────────────────────────────────────
  describe('clearResults', () => {
    it('should delete results but keep runs', async () => {
      const job = { id: 'job-1', tenant_id: 'tenant-1' };
      jobRepo.findOne.mockResolvedValue(job);
      jobRunRepo.find.mockResolvedValue([{ id: 'run-1' }]);
      jobResultRepo.delete.mockResolvedValue({ affected: 5 });
      aiUsageLogRepo.delete.mockResolvedValue({ affected: 0 });
      notificationLogRepo.delete.mockResolvedValue({ affected: 0 });

      const result = await service.clearResults('tenant-1', 'job-1');
      expect(result).toEqual({ message: 'cleared' });
      expect(jobResultRepo.delete).toHaveBeenCalled();
      // Runs should NOT be deleted
      expect(jobRunRepo.delete).not.toHaveBeenCalled();
    });
  });

  // ─── Clear Runs ───────────────────────────────────────────────────────
  describe('clearRuns', () => {
    it('should delete results, runs, and reset last_run_at', async () => {
      const job = { id: 'job-1', tenant_id: 'tenant-1' };
      jobRepo.findOne.mockResolvedValue(job);
      jobRunRepo.find.mockResolvedValue([{ id: 'run-1' }]);
      jobResultRepo.delete.mockResolvedValue({ affected: 5 });
      jobRunRepo.delete.mockResolvedValue({ affected: 1 });
      aiUsageLogRepo.delete.mockResolvedValue({ affected: 0 });
      notificationLogRepo.delete.mockResolvedValue({ affected: 0 });

      const qb = createMockQueryBuilder({ affected: 1 });
      jobRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.clearRuns('tenant-1', 'job-1');
      expect(result).toEqual({ message: 'cleared' });

      // Should reset last_run_at
      const setArg = qb.set.mock.calls[0][0];
      expect(setArg.last_run_at).toBeNull();
      expect(setArg.last_run_status).toBe('');
    });
  });

  // ─── List Jobs ────────────────────────────────────────────────────────
  describe('listJobs', () => {
    it('should return jobs ordered by created_at DESC', async () => {
      const jobs = [
        { id: 'job-2', created_at: new Date('2024-02-01') },
        { id: 'job-1', created_at: new Date('2024-01-01') },
      ];
      jobRepo.find.mockResolvedValue(jobs);

      const result = await service.listJobs('tenant-1');
      expect(result).toEqual(jobs);
      expect(jobRepo.find).toHaveBeenCalledWith({
        where: { tenant_id: 'tenant-1' },
        order: { created_at: 'DESC' },
      });
    });
  });

  // ─── Trigger Job ──────────────────────────────────────────────────────
  describe('triggerJob', () => {
    it('should return job_triggered message', async () => {
      const job = { id: 'job-1', tenant_id: 'tenant-1', name: 'Job' };
      jobRepo.findOne.mockResolvedValue(job);

      const result = await service.triggerJob('tenant-1', 'job-1', 'since_last', {});
      expect(result).toEqual({ message: 'job_triggered' });
    });
  });

  // ─── Test Run Job ─────────────────────────────────────────────────────
  describe('testRunJob', () => {
    it('should return test_run_started message', async () => {
      const job = { id: 'job-1', tenant_id: 'tenant-1', name: 'Job' };
      jobRepo.findOne.mockResolvedValue(job);

      const result = await service.testRunJob('tenant-1', 'job-1');
      expect(result).toEqual({ message: 'test_run_started' });
    });
  });
});
