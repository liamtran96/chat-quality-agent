import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConversationsService } from './conversations.service';
import { Conversation } from '../entities/conversation.entity';
import { Message } from '../entities/message.entity';
import { Channel } from '../entities/channel.entity';
import { JobResult } from '../entities/job-result.entity';
import { JobRun } from '../entities/job-run.entity';
import { NotFoundException, BadRequestException } from '@nestjs/common';

// Helper to create a mock query builder with chainable methods
function createMockQueryBuilder(returnData: {
  getMany?: any[];
  getCount?: number;
  getRawMany?: any[];
}) {
  const qb: any = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(returnData.getMany || []),
    getCount: jest.fn().mockResolvedValue(returnData.getCount || 0),
    getRawMany: jest.fn().mockResolvedValue(returnData.getRawMany || []),
  };
  return qb;
}

describe('ConversationsService', () => {
  let service: ConversationsService;
  let conversationRepo: any;
  let messageRepo: any;
  let channelRepo: any;
  let jobResultRepo: any;
  let jobRunRepo: any;

  beforeEach(async () => {
    conversationRepo = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
    };
    messageRepo = {
      createQueryBuilder: jest.fn(),
      find: jest.fn(),
    };
    channelRepo = {
      createQueryBuilder: jest.fn(),
      find: jest.fn(),
    };
    jobResultRepo = {
      createQueryBuilder: jest.fn(),
      find: jest.fn(),
      query: jest.fn(),
    };
    jobRunRepo = {
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationsService,
        { provide: getRepositoryToken(Conversation), useValue: conversationRepo },
        { provide: getRepositoryToken(Message), useValue: messageRepo },
        { provide: getRepositoryToken(Channel), useValue: channelRepo },
        { provide: getRepositoryToken(JobResult), useValue: jobResultRepo },
        { provide: getRepositoryToken(JobRun), useValue: jobRunRepo },
      ],
    }).compile();

    service = module.get<ConversationsService>(ConversationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('listConversations', () => {
    const tenantId = 'tenant-1';

    it('should return paginated conversations with defaults', async () => {
      const convQb = createMockQueryBuilder({
        getMany: [
          {
            id: 'conv-1',
            channel_id: 'ch-1',
            customer_name: 'Alice',
            last_message_at: new Date('2024-01-15T10:00:00Z'),
            message_count: 5,
            created_at: new Date('2024-01-10T08:00:00Z'),
          },
        ],
        getCount: 1,
      });
      conversationRepo.createQueryBuilder.mockReturnValue(convQb);

      const chQb = createMockQueryBuilder({
        getMany: [
          { id: 'ch-1', name: 'Test Channel', channel_type: 'zalo_oa' },
        ],
      });
      channelRepo.createQueryBuilder.mockReturnValue(chQb);

      const result = await service.listConversations(tenantId, {});

      expect(result.page).toBe(1);
      expect(result.per_page).toBe(50);
      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('conv-1');
      expect(result.data[0].channel_name).toBe('Test Channel');
      expect(result.data[0].channel_type).toBe('zalo_oa');
    });

    it('should apply channel_id filter', async () => {
      const convQb = createMockQueryBuilder({ getMany: [], getCount: 0 });
      conversationRepo.createQueryBuilder.mockReturnValue(convQb);

      await service.listConversations(tenantId, { channel_id: 'ch-1' });

      // The second andWhere call should contain channel_id filter
      expect(convQb.andWhere).toHaveBeenCalledWith(
        'conversations.channel_id = :channelId',
        { channelId: 'ch-1' },
      );
    });

    it('should apply channel_type filter with JOIN', async () => {
      const convQb = createMockQueryBuilder({ getMany: [], getCount: 0 });
      conversationRepo.createQueryBuilder.mockReturnValue(convQb);

      await service.listConversations(tenantId, { channel_type: 'facebook' });

      expect(convQb.innerJoin).toHaveBeenCalledWith(
        'channels',
        'ch_filter',
        'ch_filter.id = conversations.channel_id',
      );
      expect(convQb.andWhere).toHaveBeenCalledWith(
        'ch_filter.channel_type = :channelType',
        { channelType: 'facebook' },
      );
    });

    it('should apply ILIKE search filter', async () => {
      const convQb = createMockQueryBuilder({ getMany: [], getCount: 0 });
      conversationRepo.createQueryBuilder.mockReturnValue(convQb);

      await service.listConversations(tenantId, { search: 'Alice' });

      expect(convQb.andWhere).toHaveBeenCalledWith(
        'conversations.customer_name ILIKE :search',
        { search: '%Alice%' },
      );
    });

    it('should apply evaluation=evaluated filter', async () => {
      const convQb = createMockQueryBuilder({ getMany: [], getCount: 0 });
      conversationRepo.createQueryBuilder.mockReturnValue(convQb);

      await service.listConversations(tenantId, { evaluation: 'evaluated' });

      expect(convQb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining(
          'conversations.id IN (SELECT DISTINCT conversation_id FROM job_results',
        ),
        expect.objectContaining({ evalTenantId: tenantId }),
      );
    });

    it('should apply evaluation=not_evaluated filter', async () => {
      const convQb = createMockQueryBuilder({ getMany: [], getCount: 0 });
      conversationRepo.createQueryBuilder.mockReturnValue(convQb);

      await service.listConversations(tenantId, {
        evaluation: 'not_evaluated',
      });

      expect(convQb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('conversations.id NOT IN'),
        expect.objectContaining({ evalTenantId: tenantId }),
      );
    });

    it('should apply evaluation=PASS filter with MAX subquery', async () => {
      const convQb = createMockQueryBuilder({ getMany: [], getCount: 0 });
      conversationRepo.createQueryBuilder.mockReturnValue(convQb);

      await service.listConversations(tenantId, { evaluation: 'PASS' });

      expect(convQb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('jr.severity = :evalSeverity'),
        expect.objectContaining({ evalTenantId: tenantId, evalSeverity: 'PASS' }),
      );
    });

    it('should apply evaluation=FAIL filter with MAX subquery', async () => {
      const convQb = createMockQueryBuilder({ getMany: [], getCount: 0 });
      conversationRepo.createQueryBuilder.mockReturnValue(convQb);

      await service.listConversations(tenantId, { evaluation: 'FAIL' });

      expect(convQb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('jr.severity = :evalSeverity'),
        expect.objectContaining({ evalTenantId: tenantId, evalSeverity: 'FAIL' }),
      );
    });

    it('should clamp page and per_page to valid ranges', async () => {
      const convQb = createMockQueryBuilder({ getMany: [], getCount: 0 });
      conversationRepo.createQueryBuilder.mockReturnValue(convQb);

      const result = await service.listConversations(tenantId, {
        page: -1,
        per_page: 200,
      });

      expect(result.page).toBe(1);
      expect(result.per_page).toBe(50);
    });
  });

  describe('getConversationMessages', () => {
    it('should throw NotFoundException if conversation not found', async () => {
      conversationRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getConversationMessages('tenant-1', 'bad-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return conversation info and messages', async () => {
      conversationRepo.findOne.mockResolvedValue({
        id: 'conv-1',
        customer_name: 'Alice',
        message_count: 2,
      });

      messageRepo.find.mockResolvedValue([
        {
          id: 'msg-1',
          sender_type: 'customer',
          sender_name: 'Alice',
          content: 'Hello',
          content_type: 'text',
          attachments: null,
          sent_at: new Date('2024-01-15T10:00:00Z'),
        },
        {
          id: 'msg-2',
          sender_type: 'agent',
          sender_name: 'OA',
          content: 'Hi there',
          content_type: 'text',
          attachments: null,
          sent_at: new Date('2024-01-15T10:01:00Z'),
        },
      ]);

      const result = await service.getConversationMessages('tenant-1', 'conv-1');

      expect(result.conversation.id).toBe('conv-1');
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].sent_at).toContain('+07:00');
    });
  });

  describe('listEvaluatedConversations', () => {
    it('should return a map of conversation_id -> severity', async () => {
      jobResultRepo.query.mockResolvedValue([
        { conversation_id: 'conv-1', severity: 'PASS' },
        { conversation_id: 'conv-2', severity: 'FAIL' },
      ]);

      const result = await service.listEvaluatedConversations('tenant-1');

      expect(result).toEqual({
        'conv-1': 'PASS',
        'conv-2': 'FAIL',
      });
    });

    it('should return empty map if no evaluations', async () => {
      jobResultRepo.query.mockResolvedValue([]);

      const result = await service.listEvaluatedConversations('tenant-1');

      expect(result).toEqual({});
    });
  });

  describe('getConversationEvaluations', () => {
    it('should throw NotFoundException if conversation not found', async () => {
      conversationRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getConversationEvaluations('tenant-1', 'bad-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return has_evaluation=false when no results', async () => {
      conversationRepo.findOne.mockResolvedValue({ id: 'conv-1' });
      jobResultRepo.find.mockResolvedValue([]);

      const result = await service.getConversationEvaluations(
        'tenant-1',
        'conv-1',
      );

      expect(result.has_evaluation).toBe(false);
      expect(result.groups).toEqual([]);
    });

    it('should group results by job_run_id', async () => {
      conversationRepo.findOne.mockResolvedValue({ id: 'conv-1' });
      jobResultRepo.find.mockResolvedValue([
        {
          id: 'r1',
          job_run_id: 'run-1',
          created_at: new Date('2024-01-15T10:00:00Z'),
        },
        {
          id: 'r2',
          job_run_id: 'run-1',
          created_at: new Date('2024-01-15T10:01:00Z'),
        },
        {
          id: 'r3',
          job_run_id: 'run-2',
          created_at: new Date('2024-01-15T09:00:00Z'),
        },
      ]);

      const runQb = createMockQueryBuilder({
        getRawMany: [
          {
            run_id: 'run-1',
            job_name: 'QC Job',
            job_type: 'qc_analysis',
            evaluated_at: new Date('2024-01-15T10:00:00Z'),
          },
          {
            run_id: 'run-2',
            job_name: 'Class Job',
            job_type: 'classification',
            evaluated_at: new Date('2024-01-15T09:00:00Z'),
          },
        ],
      });
      jobRunRepo.createQueryBuilder.mockReturnValue(runQb);

      const result = await service.getConversationEvaluations(
        'tenant-1',
        'conv-1',
      );

      expect(result.has_evaluation).toBe(true);
      expect(result.groups).toHaveLength(2);
      expect(result.groups[0].job_run_id).toBe('run-1');
      expect(result.groups[0].results).toHaveLength(2);
      expect(result.groups[1].job_run_id).toBe('run-2');
      expect(result.groups[1].results).toHaveLength(1);
    });
  });

  describe('getConversationPage', () => {
    it('should throw NotFoundException if conversation not found', async () => {
      conversationRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getConversationPage('tenant-1', 'bad-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should compute correct page number', async () => {
      conversationRepo.findOne.mockResolvedValue({
        id: 'conv-1',
        last_message_at: new Date('2024-01-15T10:00:00Z'),
      });

      const posQb = createMockQueryBuilder({ getCount: 18 });
      conversationRepo.createQueryBuilder.mockReturnValue(posQb);

      // With default perPage=9: position=18, page = 18/9 + 1 = 3
      const result = await service.getConversationPage('tenant-1', 'conv-1');

      expect(result.page).toBe(3);
    });

    it('should use custom per_page', async () => {
      conversationRepo.findOne.mockResolvedValue({
        id: 'conv-1',
        last_message_at: new Date('2024-01-15T10:00:00Z'),
      });

      const posQb = createMockQueryBuilder({ getCount: 10 });
      conversationRepo.createQueryBuilder.mockReturnValue(posQb);

      // perPage=5: position=10, page = 10/5 + 1 = 3
      const result = await service.getConversationPage(
        'tenant-1',
        'conv-1',
        5,
      );

      expect(result.page).toBe(3);
    });
  });

  describe('exportMessages', () => {
    it('should throw BadRequestException if from or to is missing', async () => {
      await expect(
        service.exportMessages('tenant-1', { from: '2024-01-01' }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.exportMessages('tenant-1', { to: '2024-01-31' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid dates', async () => {
      await expect(
        service.exportMessages('tenant-1', {
          from: 'invalid',
          to: '2024-01-31',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return JSON error when no conversations found', async () => {
      const convQb = createMockQueryBuilder({ getMany: [] });
      conversationRepo.createQueryBuilder.mockReturnValue(convQb);

      const result = await service.exportMessages('tenant-1', {
        from: '2024-01-01',
        to: '2024-01-31',
      });

      expect(result.type).toBe('json');
      expect((result as any).body.error).toContain('Không có cuộc chat');
    });

    it('should export TXT format', async () => {
      const convQb = createMockQueryBuilder({
        getMany: [
          {
            id: 'conv-1',
            customer_name: 'Alice',
            channel_id: 'ch-1',
          },
        ],
      });
      conversationRepo.createQueryBuilder.mockReturnValue(convQb);

      const msgQb = createMockQueryBuilder({
        getMany: [
          {
            id: 'msg-1',
            conversation_id: 'conv-1',
            sender_type: 'customer',
            sender_name: 'Alice',
            content: 'Hello',
            content_type: 'text',
            sent_at: new Date('2024-01-15T10:00:00Z'),
          },
        ],
      });
      messageRepo.createQueryBuilder.mockReturnValue(msgQb);

      const result = await service.exportMessages('tenant-1', {
        from: '2024-01-01',
        to: '2024-01-31',
        format: 'txt',
      });

      expect(result.type).toBe('txt');
      expect((result as any).content).toContain('EXPORT TIN NHẮN');
      expect((result as any).content).toContain('Alice');
      expect((result as any).filename).toBe('messages_2024-01-01_2024-01-31.txt');
    });

    it('should export CSV format with BOM', async () => {
      const convQb = createMockQueryBuilder({
        getMany: [
          {
            id: 'conv-1',
            customer_name: 'Alice',
            channel_id: 'ch-1',
          },
        ],
      });
      conversationRepo.createQueryBuilder.mockReturnValue(convQb);

      const msgQb = createMockQueryBuilder({
        getMany: [
          {
            id: 'msg-1',
            conversation_id: 'conv-1',
            sender_type: 'customer',
            sender_name: 'Alice',
            content: 'Hello',
            content_type: 'text',
            sent_at: new Date('2024-01-15T10:00:00Z'),
          },
        ],
      });
      messageRepo.createQueryBuilder.mockReturnValue(msgQb);

      const result = await service.exportMessages('tenant-1', {
        from: '2024-01-01',
        to: '2024-01-31',
        format: 'csv',
      });

      expect(result.type).toBe('csv');
      expect((result as any).content).toContain('\xEF\xBB\xBF');
      expect((result as any).content).toContain('Khách hàng');
      expect((result as any).filename).toBe('messages_2024-01-01_2024-01-31.csv');
    });
  });
});
