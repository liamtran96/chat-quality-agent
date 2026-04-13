import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { AnalyzerService } from './analyzer.service';
import { CryptoService } from '../common/crypto/crypto.service';
import {
  Job,
  JobRun,
  JobResult,
  Conversation,
  Message,
  AppSetting,
  AIUsageLog,
  ActivityLog,
} from '../entities';
import {
  AIProvider,
  AIResponse,
  BatchItem,
  calculateCostUSD,
} from './ai-provider.interface';

// ---------------------------------------------------------------------------
// Mock AI Provider
// ---------------------------------------------------------------------------

class MockAIProvider implements AIProvider {
  constructor(
    public response: AIResponse,
    public error?: Error,
  ) {}

  async analyzeChat(
    _signal: AbortSignal | undefined,
    _systemPrompt: string,
    _chatTranscript: string,
  ): Promise<AIResponse> {
    if (this.error) throw this.error;
    return this.response;
  }

  async analyzeChatBatch(
    _signal: AbortSignal | undefined,
    _systemPrompt: string,
    items: BatchItem[],
  ): Promise<AIResponse> {
    if (this.error) throw this.error;
    // For batch: wrap response content in an array (one per item)
    const single = JSON.parse(this.response.content);
    const batchContent = items.map((item) => ({
      ...single,
      conversation_id: item.conversationId,
    }));
    return {
      ...this.response,
      content: JSON.stringify(batchContent),
    };
  }
}

// ---------------------------------------------------------------------------
// Repository mock factory
// ---------------------------------------------------------------------------

function createMockRepository() {
  return {
    create: jest.fn((entity) => entity),
    save: jest.fn((entity) => Promise.resolve(entity)),
    update: jest.fn(() => Promise.resolve({ affected: 1 })),
    findOne: jest.fn(() => Promise.resolve(null)),
    find: jest.fn(() => Promise.resolve([])),
    count: jest.fn(() => Promise.resolve(0)),
    createQueryBuilder: jest.fn(() => mockQueryBuilder()),
  };
}

function mockQueryBuilder() {
  const qb: any = {
    select: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    setParameters: jest.fn().mockReturnThis(),
    getMany: jest.fn(() => Promise.resolve([])),
    getRawOne: jest.fn(() => Promise.resolve(null)),
    getQuery: jest.fn(() => 'SELECT 1'),
    getParameters: jest.fn(() => ({})),
  };
  return qb;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AnalyzerService', () => {
  let service: AnalyzerService;
  let jobRunRepo: any;
  let jobResultRepo: any;
  let conversationRepo: any;
  let messageRepo: any;
  let jobRepo: any;
  let aiUsageLogRepo: any;
  let activityLogRepo: any;
  let appSettingRepo: any;

  beforeEach(async () => {
    jobRepo = createMockRepository();
    jobRunRepo = createMockRepository();
    jobResultRepo = createMockRepository();
    conversationRepo = createMockRepository();
    messageRepo = createMockRepository();
    appSettingRepo = createMockRepository();
    aiUsageLogRepo = createMockRepository();
    activityLogRepo = createMockRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyzerService,
        {
          provide: getRepositoryToken(Job),
          useValue: jobRepo,
        },
        {
          provide: getRepositoryToken(JobRun),
          useValue: jobRunRepo,
        },
        {
          provide: getRepositoryToken(JobResult),
          useValue: jobResultRepo,
        },
        {
          provide: getRepositoryToken(Conversation),
          useValue: conversationRepo,
        },
        {
          provide: getRepositoryToken(Message),
          useValue: messageRepo,
        },
        {
          provide: getRepositoryToken(AppSetting),
          useValue: appSettingRepo,
        },
        {
          provide: getRepositoryToken(AIUsageLog),
          useValue: aiUsageLogRepo,
        },
        {
          provide: getRepositoryToken(ActivityLog),
          useValue: activityLogRepo,
        },
        {
          provide: CryptoService,
          useValue: {
            encrypt: jest.fn(),
            decrypt: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'ENCRYPTION_KEY')
                return '12345678901234567890123456789012';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AnalyzerService>(AnalyzerService);
  });

  // -----------------------------------------------------------------------
  // MockAIProvider unit tests (matching Go's analyzer_test.go)
  // -----------------------------------------------------------------------

  describe('MockAIProvider - QC PASS', () => {
    it('should return PASS verdict with correct tokens', async () => {
      const passResponse = {
        verdict: 'PASS',
        score: 90,
        review:
          'Cu\u1ed9c chat t\u1ed1t, nh\u00e2n vi\u00ean l\u1ecbch s\u1ef1 v\u00e0 gi\u1ea3i \u0111\u00e1p \u0111\u1ea7y \u0111\u1ee7.',
        violations: [],
        summary:
          'Kh\u00e1ch h\u00e0ng h\u1ecfi v\u1ec1 s\u1ea3n ph\u1ea9m, nh\u00e2n vi\u00ean tr\u1ea3 l\u1eddi chi ti\u1ebft.',
      };
      const respJSON = JSON.stringify(passResponse);

      const mock = new MockAIProvider({
        content: respJSON,
        inputTokens: 150,
        outputTokens: 80,
        model: 'claude-sonnet-4-6',
        provider: 'claude',
      });

      const resp = await mock.analyzeChat(
        undefined,
        'test prompt',
        'test transcript',
      );
      expect(resp.inputTokens).toBe(150);
      expect(resp.outputTokens).toBe(80);
      expect(resp.provider).toBe('claude');

      const qcResult = JSON.parse(resp.content);
      expect(qcResult.verdict).toBe('PASS');
      expect(qcResult.score).toBe(90);
    });
  });

  describe('MockAIProvider - QC FAIL', () => {
    it('should return FAIL verdict with violations', async () => {
      const failResponse = {
        verdict: 'FAIL',
        score: 30,
        review:
          'Nh\u00e2n vi\u00ean kh\u00f4ng ch\u00e0o h\u1ecfi, tr\u1ea3 l\u1eddi c\u1ed9c l\u1ed1c.',
        violations: [
          {
            severity: 'NGHIEM_TRONG',
            rule: 'Ch\u00e0o h\u1ecfi l\u1ecbch s\u1ef1',
            evidence: 'Kh\u00e1ch: Xin ch\u00e0o. NV: G\u00ec?',
            explanation:
              'Nh\u00e2n vi\u00ean kh\u00f4ng ch\u00e0o h\u1ecfi l\u1ea1i, tr\u1ea3 l\u1eddi th\u00f4 l\u1ed7.',
            suggestion:
              'N\u00ean b\u1eaft \u0111\u1ea7u b\u1eb1ng l\u1eddi ch\u00e0o th\u00e2n thi\u1ec7n.',
          },
        ],
        summary: 'Cu\u1ed9c chat c\u1ea7n c\u1ea3i thi\u1ec7n.',
      };
      const respJSON = JSON.stringify(failResponse);

      const mock = new MockAIProvider({
        content: respJSON,
        inputTokens: 200,
        outputTokens: 120,
        model: 'gemini-2.0-flash',
        provider: 'gemini',
      });

      const resp = await mock.analyzeChat(
        undefined,
        'test prompt',
        'test transcript',
      );
      const qcResult = JSON.parse(resp.content);
      expect(qcResult.verdict).toBe('FAIL');
      expect(qcResult.violations).toHaveLength(1);
      expect(qcResult.violations[0].severity).toBe('NGHIEM_TRONG');
    });
  });

  describe('calculateCostUSD', () => {
    const tests = [
      {
        name: 'claude sonnet small',
        provider: 'claude',
        model: 'claude-sonnet-4-6',
        input: 1000,
        output: 500,
        minCost: 0.01,
        maxCost: 0.02,
      },
      {
        name: 'claude haiku cheap',
        provider: 'claude',
        model: 'claude-haiku-4-5',
        input: 1000,
        output: 500,
        minCost: 0.001,
        maxCost: 0.005,
      },
      {
        name: 'gemini flash very cheap',
        provider: 'gemini',
        model: 'gemini-2.0-flash',
        input: 1000,
        output: 500,
        minCost: 0.0001,
        maxCost: 0.001,
      },
      {
        name: 'zero tokens',
        provider: 'claude',
        model: 'claude-sonnet-4-6',
        input: 0,
        output: 0,
        minCost: 0,
        maxCost: 0,
      },
    ];

    for (const tt of tests) {
      it(`should calculate cost for ${tt.name}`, () => {
        const cost = calculateCostUSD(
          tt.provider,
          tt.model,
          tt.input,
          tt.output,
        );
        expect(cost).toBeGreaterThanOrEqual(tt.minCost);
        expect(cost).toBeLessThanOrEqual(tt.maxCost);
      });
    }
  });

  // -----------------------------------------------------------------------
  // saveResults unit tests
  // -----------------------------------------------------------------------

  describe('saveResults', () => {
    it('should save QC PASS results correctly', async () => {
      const aiResponse = JSON.stringify({
        verdict: 'PASS',
        score: 90,
        review: 'Good chat',
        violations: [],
        summary: 'All good',
      });

      const { count, passed } = await service.saveResults(
        'run-1',
        'tenant-1',
        'conv-1',
        'qc_analysis',
        aiResponse,
      );

      expect(passed).toBe(true);
      expect(count).toBe(0);
      // Should have saved 1 conversation_evaluation record
      expect(jobResultRepo.save).toHaveBeenCalledTimes(1);
      const savedResult = jobResultRepo.save.mock.calls[0][0];
      expect(savedResult.result_type).toBe('conversation_evaluation');
      expect(savedResult.severity).toBe('PASS');
    });

    it('should save QC FAIL results with violations', async () => {
      const aiResponse = JSON.stringify({
        verdict: 'FAIL',
        score: 30,
        review: 'Bad chat',
        violations: [
          {
            severity: 'NGHIEM_TRONG',
            rule: 'Rule 1',
            evidence: 'evidence',
            explanation: 'explanation',
            suggestion: 'suggestion',
          },
          {
            severity: 'CAN_CAI_THIEN',
            rule: 'Rule 2',
            evidence: 'ev2',
            explanation: 'exp2',
            suggestion: 'sug2',
          },
        ],
        summary: 'Needs improvement',
      });

      const { count, passed } = await service.saveResults(
        'run-1',
        'tenant-1',
        'conv-1',
        'qc_analysis',
        aiResponse,
      );

      expect(passed).toBe(false);
      expect(count).toBe(2);
      // 1 conversation_evaluation + 2 qc_violation = 3 saves
      expect(jobResultRepo.save).toHaveBeenCalledTimes(3);
    });

    it('should save QC SKIP results without violations', async () => {
      const aiResponse = JSON.stringify({
        verdict: 'SKIP',
        score: 0,
        review: 'Skipped',
        violations: [],
        summary: 'Not applicable',
      });

      const { count, passed } = await service.saveResults(
        'run-1',
        'tenant-1',
        'conv-1',
        'qc_analysis',
        aiResponse,
      );

      expect(passed).toBe(false);
      expect(count).toBe(0);
      // 1 conversation_evaluation only
      expect(jobResultRepo.save).toHaveBeenCalledTimes(1);
      const saved = jobResultRepo.save.mock.calls[0][0];
      expect(saved.severity).toBe('SKIP');
    });

    it('should save classification results with tags', async () => {
      const aiResponse = JSON.stringify({
        tags: [
          {
            rule_name: 'Support Request',
            confidence: 0.95,
            evidence: 'Customer asked for help',
            explanation: 'Clear support request',
          },
        ],
        summary: 'Customer support chat',
      });

      const { count, passed } = await service.saveResults(
        'run-1',
        'tenant-1',
        'conv-1',
        'classification',
        aiResponse,
      );

      expect(count).toBe(1);
      // 1 classification_tag + 1 conversation_evaluation = 2
      expect(jobResultRepo.save).toHaveBeenCalledTimes(2);
    });

    it('should save classification SKIP when no tags', async () => {
      const aiResponse = JSON.stringify({
        tags: [],
        summary: 'No matching tags',
      });

      const { count } = await service.saveResults(
        'run-1',
        'tenant-1',
        'conv-1',
        'classification',
        aiResponse,
      );

      expect(count).toBe(0);
      // 1 conversation_evaluation with SKIP
      expect(jobResultRepo.save).toHaveBeenCalledTimes(1);
      const saved = jobResultRepo.save.mock.calls[0][0];
      expect(saved.severity).toBe('SKIP');
    });

    it('should strip markdown code fences from response', async () => {
      const innerJSON = JSON.stringify({
        verdict: 'PASS',
        score: 85,
        review: 'Good',
        violations: [],
        summary: 'Fine',
      });
      const wrappedResponse = '```json\n' + innerJSON + '\n```';

      const { passed } = await service.saveResults(
        'run-1',
        'tenant-1',
        'conv-1',
        'qc_analysis',
        wrappedResponse,
      );

      expect(passed).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // runJobWithProvider test
  // -----------------------------------------------------------------------

  describe('runJobWithProvider', () => {
    it('should run job with mock provider and save results', async () => {
      const convId = 'conv-test-1';
      const mockConversations = [
        {
          id: convId,
          tenant_id: 'tenant-1',
          channel_id: 'ch-1',
          external_conversation_id: 'ext-1',
          customer_name: 'Test Customer',
          last_message_at: new Date(),
          message_count: 2,
        },
      ];

      const mockMessages = [
        {
          id: 'msg-1',
          conversation_id: convId,
          sender_type: 'customer',
          sender_name: 'Khach',
          content: 'Xin chao',
          sent_at: new Date(Date.now() - 5 * 60 * 1000),
        },
        {
          id: 'msg-2',
          conversation_id: convId,
          sender_type: 'agent',
          sender_name: 'NV',
          content: 'Chao ban! Em rat vui duoc ho tro.',
          sent_at: new Date(Date.now() - 3 * 60 * 1000),
        },
      ];

      // Setup conversation query builder to return our mock conversations
      const convQb = mockQueryBuilder();
      convQb.getMany.mockResolvedValue(mockConversations);
      conversationRepo.createQueryBuilder.mockReturnValue(convQb);

      // Setup message query builder to return mock messages
      const msgQb = mockQueryBuilder();
      msgQb.getMany.mockResolvedValue(mockMessages);
      messageRepo.createQueryBuilder.mockReturnValue(msgQb);

      // Batch mode disabled
      appSettingRepo.find.mockResolvedValue([
        { setting_key: 'ai_batch_mode', value_plain: 'false' },
      ]);

      const passResponse = JSON.stringify({
        verdict: 'PASS',
        score: 90,
        review: 'Good chat',
        violations: [],
        summary: 'All good',
      });
      const mockProvider = new MockAIProvider({
        content: passResponse,
        inputTokens: 200,
        outputTokens: 100,
        model: 'mock-model',
        provider: 'mock',
      });

      const job: Job = {
        id: 'job-1',
        tenant_id: 'tenant-1',
        name: 'Test QC Job',
        description: '',
        job_type: 'qc_analysis',
        input_channel_ids: '["ch-1"]',
        rules_content: 'Be polite',
        rules_config: '[]',
        skip_conditions: '',
        ai_provider: 'claude',
        ai_model: 'claude-sonnet-4-6',
        outputs: '[]',
        output_schedule: 'none',
        output_cron: '',
        output_at: null,
        schedule_type: 'manual',
        schedule_cron: '',
        is_active: true,
        last_run_at: null,
        last_run_status: '',
        created_at: new Date(),
        updated_at: new Date(),
      };

      const run = await service.runJobWithProvider(job, 10, mockProvider);

      expect(run.status).toBe('success');

      // Parse summary
      const summary = JSON.parse(run.summary);
      expect(summary.conversations_found).toBe(1);
      expect(summary.conversations_analyzed).toBe(1);
      expect(summary.conversations_passed).toBe(1);
      expect(summary.issues_found).toBe(0);

      // AI usage log should have been saved
      expect(aiUsageLogRepo.save).toHaveBeenCalled();
    });

    it('should handle AI errors gracefully', async () => {
      const mockConversations = [
        {
          id: 'conv-1',
          tenant_id: 'tenant-1',
          channel_id: 'ch-1',
          last_message_at: new Date(),
        },
      ];
      const mockMessages = [
        {
          id: 'msg-1',
          conversation_id: 'conv-1',
          sender_type: 'customer',
          sender_name: 'Test',
          content: 'Hello',
          sent_at: new Date(),
        },
      ];

      const convQb = mockQueryBuilder();
      convQb.getMany.mockResolvedValue(mockConversations);
      conversationRepo.createQueryBuilder.mockReturnValue(convQb);

      const msgQb = mockQueryBuilder();
      msgQb.getMany.mockResolvedValue(mockMessages);
      messageRepo.createQueryBuilder.mockReturnValue(msgQb);

      appSettingRepo.find.mockResolvedValue([
        { setting_key: 'ai_batch_mode', value_plain: 'false' },
      ]);

      const errorProvider = new MockAIProvider(
        {} as AIResponse,
        new Error('API rate limit exceeded'),
      );

      const job: Job = {
        id: 'job-1',
        tenant_id: 'tenant-1',
        name: 'Error Test Job',
        description: '',
        job_type: 'qc_analysis',
        input_channel_ids: '["ch-1"]',
        rules_content: 'Be polite',
        rules_config: '[]',
        skip_conditions: '',
        ai_provider: 'claude',
        ai_model: 'claude-sonnet-4-6',
        outputs: '[]',
        output_schedule: 'none',
        output_cron: '',
        output_at: null,
        schedule_type: 'manual',
        schedule_cron: '',
        is_active: true,
        last_run_at: null,
        last_run_status: '',
        created_at: new Date(),
        updated_at: new Date(),
      };

      const run = await service.runJobWithProvider(job, 10, errorProvider);

      // Should be error status since all conversations failed
      expect(run.status).toBe('error');
      const summary = JSON.parse(run.summary);
      expect(summary.conversations_errors).toBe(1);
      expect(summary.conversations_analyzed).toBe(0);
    });

    it('should handle batch mode correctly', async () => {
      const mockConversations = [
        {
          id: 'conv-1',
          tenant_id: 'tenant-1',
          channel_id: 'ch-1',
          last_message_at: new Date(),
        },
        {
          id: 'conv-2',
          tenant_id: 'tenant-1',
          channel_id: 'ch-1',
          last_message_at: new Date(),
        },
      ];

      const convQb = mockQueryBuilder();
      convQb.getMany.mockResolvedValue(mockConversations);
      conversationRepo.createQueryBuilder.mockReturnValue(convQb);

      // Each conversation has messages
      const msgQb = mockQueryBuilder();
      msgQb.getMany.mockResolvedValue([
        {
          id: 'msg-1',
          conversation_id: 'conv-x',
          sender_type: 'customer',
          sender_name: 'Test',
          content: 'Hello',
          sent_at: new Date(),
        },
      ]);
      messageRepo.createQueryBuilder.mockReturnValue(msgQb);

      // Batch mode enabled (default -- find returns [] so defaults apply)

      const passResponse = JSON.stringify({
        verdict: 'PASS',
        score: 90,
        review: 'Good',
        violations: [],
        summary: 'Fine',
      });
      const mockProvider = new MockAIProvider({
        content: passResponse,
        inputTokens: 300,
        outputTokens: 200,
        model: 'mock-model',
        provider: 'mock',
      });

      const job: Job = {
        id: 'job-1',
        tenant_id: 'tenant-1',
        name: 'Batch Test Job',
        description: '',
        job_type: 'qc_analysis',
        input_channel_ids: '["ch-1"]',
        rules_content: 'Be polite',
        rules_config: '[]',
        skip_conditions: '',
        ai_provider: 'claude',
        ai_model: 'claude-sonnet-4-6',
        outputs: '[]',
        output_schedule: 'none',
        output_cron: '',
        output_at: null,
        schedule_type: 'manual',
        schedule_cron: '',
        is_active: true,
        last_run_at: null,
        last_run_status: '',
        created_at: new Date(),
        updated_at: new Date(),
      };

      const run = await service.runJobWithProvider(job, 10, mockProvider);

      expect(run.status).toBe('success');
      const summary = JSON.parse(run.summary);
      expect(summary.conversations_found).toBe(2);
      expect(summary.conversations_analyzed).toBe(2);
    });
  });
});
