import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DashboardService } from './dashboard.service';
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

function createMockQueryBuilder(overrides: Record<string, any> = {}) {
  const qb: any = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(0),
    getMany: jest.fn().mockResolvedValue([]),
    getRawMany: jest.fn().mockResolvedValue([]),
    getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
    ...overrides,
  };
  return qb;
}

function createMockRepository() {
  return {
    count: jest.fn().mockResolvedValue(0),
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    createQueryBuilder: jest.fn().mockReturnValue(createMockQueryBuilder()),
    create: jest.fn().mockImplementation((data) => data),
    save: jest.fn().mockImplementation((data) => data),
  };
}

describe('DashboardService', () => {
  let service: DashboardService;
  let channelRepo: ReturnType<typeof createMockRepository>;
  let conversationRepo: ReturnType<typeof createMockRepository>;
  let jobRepo: ReturnType<typeof createMockRepository>;
  let jobRunRepo: ReturnType<typeof createMockRepository>;
  let jobResultRepo: ReturnType<typeof createMockRepository>;
  let aiUsageLogRepo: ReturnType<typeof createMockRepository>;
  let appSettingRepo: ReturnType<typeof createMockRepository>;
  let messageRepo: ReturnType<typeof createMockRepository>;

  beforeEach(async () => {
    channelRepo = createMockRepository();
    conversationRepo = createMockRepository();
    jobRepo = createMockRepository();
    jobRunRepo = createMockRepository();
    jobResultRepo = createMockRepository();
    aiUsageLogRepo = createMockRepository();
    appSettingRepo = createMockRepository();
    messageRepo = createMockRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: getRepositoryToken(Channel), useValue: channelRepo },
        { provide: getRepositoryToken(Conversation), useValue: conversationRepo },
        { provide: getRepositoryToken(Job), useValue: jobRepo },
        { provide: getRepositoryToken(JobRun), useValue: jobRunRepo },
        { provide: getRepositoryToken(JobResult), useValue: jobResultRepo },
        { provide: getRepositoryToken(AIUsageLog), useValue: aiUsageLogRepo },
        { provide: getRepositoryToken(AppSetting), useValue: appSettingRepo },
        { provide: getRepositoryToken(Message), useValue: messageRepo },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getDashboard', () => {
    const tenantId = 'test-tenant-id';

    it('should return all expected dashboard keys', async () => {
      channelRepo.count.mockResolvedValue(3);
      jobRepo.count.mockResolvedValue(2);
      appSettingRepo.findOne.mockResolvedValue({ value_plain: '25500' });

      const result = await service.getDashboard(tenantId);

      expect(result).toHaveProperty('total_conversations');
      expect(result).toHaveProperty('active_channels', 3);
      expect(result).toHaveProperty('active_jobs', 2);
      expect(result).toHaveProperty('issues_today');
      expect(result).toHaveProperty('conversations_by_channel');
      expect(result).toHaveProperty('qc_alerts');
      expect(result).toHaveProperty('classification_recent');
      expect(result).toHaveProperty('cost_today');
      expect(result).toHaveProperty('cost_this_month');
      expect(result).toHaveProperty('cost_by_day');
      expect(result).toHaveProperty('messages_by_day');
      expect(result).toHaveProperty('exchange_rate', 25500);
    });

    it('should use default exchange rate when no setting exists', async () => {
      appSettingRepo.findOne.mockResolvedValue(null);

      const result = await service.getDashboard(tenantId);

      expect(result.exchange_rate).toBe(26000);
    });

    it('should accept date filter params without error', async () => {
      appSettingRepo.findOne.mockResolvedValue(null);

      const result = await service.getDashboard(tenantId, '2026-03-01', '2026-03-27');

      expect(result).toHaveProperty('total_conversations');
      expect(conversationRepo.createQueryBuilder).toHaveBeenCalled();
    });

    it('should return numeric cost values', async () => {
      const costQb = createMockQueryBuilder({
        getRawOne: jest.fn().mockResolvedValue({ total: '5.123456' }),
      });
      aiUsageLogRepo.createQueryBuilder.mockReturnValue(costQb);
      appSettingRepo.findOne.mockResolvedValue(null);

      const result = await service.getDashboard(tenantId);

      expect(typeof result.cost_today).toBe('number');
      expect(typeof result.cost_this_month).toBe('number');
    });
  });

  describe('getOnboardingStatus', () => {
    const tenantId = 'test-tenant-id';

    it('should return all steps as not done when empty', async () => {
      channelRepo.count.mockResolvedValue(0);
      conversationRepo.count.mockResolvedValue(0);
      jobRepo.count.mockResolvedValue(0);
      jobRunRepo.count.mockResolvedValue(0);
      appSettingRepo.findOne.mockResolvedValue(null);

      const result = await service.getOnboardingStatus(tenantId);

      expect(result.dismissed).toBe(false);
      expect(result.steps).toHaveLength(5);
      expect(result.steps[0]).toEqual(
        expect.objectContaining({ key: 'channel', done: false }),
      );
      expect(result.steps[1]).toEqual(
        expect.objectContaining({ key: 'sync', done: false }),
      );
      expect(result.steps[2]).toEqual(
        expect.objectContaining({ key: 'ai', done: false }),
      );
      expect(result.steps[3]).toEqual(
        expect.objectContaining({ key: 'job', done: false }),
      );
      expect(result.steps[4]).toEqual(
        expect.objectContaining({ key: 'run', done: false }),
      );
    });

    it('should return steps as done when data exists', async () => {
      channelRepo.count.mockResolvedValue(1);
      conversationRepo.count.mockResolvedValue(10);
      jobRepo.count.mockResolvedValue(2);
      jobRunRepo.count.mockResolvedValue(5);

      appSettingRepo.findOne
        .mockResolvedValueOnce({ value_plain: 'claude' })
        .mockResolvedValueOnce({ value_plain: 'true' });

      const result = await service.getOnboardingStatus(tenantId);

      expect(result.dismissed).toBe(true);
      expect(result.steps.every((s) => s.done)).toBe(true);
    });

    it('should mark AI step as not done when no provider', async () => {
      channelRepo.count.mockResolvedValue(1);
      conversationRepo.count.mockResolvedValue(1);
      jobRepo.count.mockResolvedValue(1);
      jobRunRepo.count.mockResolvedValue(1);

      appSettingRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const result = await service.getOnboardingStatus(tenantId);

      expect(result.steps[2].done).toBe(false);
      expect(result.dismissed).toBe(false);
    });
  });
});
