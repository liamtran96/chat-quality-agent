import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { Tenant } from '../entities/tenant.entity';
import { UserTenant } from '../entities/user-tenant.entity';
import { Channel } from '../entities/channel.entity';
import { Job } from '../entities/job.entity';
import { Conversation } from '../entities/conversation.entity';
import { Message } from '../entities/message.entity';
import { JobRun } from '../entities/job-run.entity';
import { JobResult } from '../entities/job-result.entity';
import { NotificationLog } from '../entities/notification-log.entity';
import { AIUsageLog } from '../entities/ai-usage-log.entity';
import { ActivityLog } from '../entities/activity-log.entity';
import { AppSetting } from '../entities/app-setting.entity';

// Track delete call order for cascade test
const deleteCallOrder: string[] = [];

function createMockRepo(entityName: string) {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn().mockImplementation((data) => data),
    save: jest.fn().mockImplementation((data) => Promise.resolve(data)),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    delete: jest.fn().mockImplementation(() => {
      deleteCallOrder.push(entityName);
      return Promise.resolve({ affected: 1 });
    }),
  };
}

describe('TenantsService', () => {
  let service: TenantsService;
  let tenantRepo: ReturnType<typeof createMockRepo>;
  let userTenantRepo: ReturnType<typeof createMockRepo>;
  let channelRepo: ReturnType<typeof createMockRepo>;
  let jobRepo: ReturnType<typeof createMockRepo>;
  let conversationRepo: ReturnType<typeof createMockRepo>;
  let messageRepo: ReturnType<typeof createMockRepo>;
  let jobRunRepo: ReturnType<typeof createMockRepo>;
  let jobResultRepo: ReturnType<typeof createMockRepo>;
  let notificationLogRepo: ReturnType<typeof createMockRepo>;
  let aiUsageLogRepo: ReturnType<typeof createMockRepo>;
  let activityLogRepo: ReturnType<typeof createMockRepo>;
  let appSettingRepo: ReturnType<typeof createMockRepo>;

  beforeEach(async () => {
    deleteCallOrder.length = 0;

    tenantRepo = createMockRepo('Tenant');
    userTenantRepo = createMockRepo('UserTenant');
    channelRepo = createMockRepo('Channel');
    jobRepo = createMockRepo('Job');
    conversationRepo = createMockRepo('Conversation');
    messageRepo = createMockRepo('Message');
    jobRunRepo = createMockRepo('JobRun');
    jobResultRepo = createMockRepo('JobResult');
    notificationLogRepo = createMockRepo('NotificationLog');
    aiUsageLogRepo = createMockRepo('AIUsageLog');
    activityLogRepo = createMockRepo('ActivityLog');
    appSettingRepo = createMockRepo('AppSetting');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantsService,
        { provide: getRepositoryToken(Tenant), useValue: tenantRepo },
        { provide: getRepositoryToken(UserTenant), useValue: userTenantRepo },
        { provide: getRepositoryToken(Channel), useValue: channelRepo },
        { provide: getRepositoryToken(Job), useValue: jobRepo },
        { provide: getRepositoryToken(Conversation), useValue: conversationRepo },
        { provide: getRepositoryToken(Message), useValue: messageRepo },
        { provide: getRepositoryToken(JobRun), useValue: jobRunRepo },
        { provide: getRepositoryToken(JobResult), useValue: jobResultRepo },
        { provide: getRepositoryToken(NotificationLog), useValue: notificationLogRepo },
        { provide: getRepositoryToken(AIUsageLog), useValue: aiUsageLogRepo },
        { provide: getRepositoryToken(ActivityLog), useValue: activityLogRepo },
        { provide: getRepositoryToken(AppSetting), useValue: appSettingRepo },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('/tmp/cqa-test-files'),
          },
        },
      ],
    }).compile();

    service = module.get<TenantsService>(TenantsService);
  });

  describe('slug validation', () => {
    it('should reject slugs that do not match the regex', async () => {
      await expect(
        service.createTenant('user-1', { name: 'Test', slug: 'AB' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject slugs starting with a hyphen', async () => {
      await expect(
        service.createTenant('user-1', { name: 'Test', slug: '-abc' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject slugs ending with a hyphen', async () => {
      await expect(
        service.createTenant('user-1', { name: 'Test', slug: 'abc-' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject slugs with uppercase letters', async () => {
      await expect(
        service.createTenant('user-1', { name: 'Test', slug: 'My-Tenant' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject slugs shorter than 3 characters', async () => {
      await expect(
        service.createTenant('user-1', { name: 'Test', slug: 'ab' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should accept valid slugs', async () => {
      const result = await service.createTenant('user-1', {
        name: 'Test Tenant',
        slug: 'my-tenant-1',
      });
      expect(result.slug).toBe('my-tenant-1');
      expect(result.name).toBe('Test Tenant');
    });

    it('should reject duplicate slugs', async () => {
      tenantRepo.count.mockResolvedValueOnce(1);
      await expect(
        service.createTenant('user-1', { name: 'Test', slug: 'existing-slug' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('createTenant', () => {
    it('should create tenant and assign creator as owner', async () => {
      const result = await service.createTenant('user-1', {
        name: 'My Team',
        slug: 'my-team',
      });

      expect(result.id).toBeDefined();
      expect(result.name).toBe('My Team');
      expect(result.slug).toBe('my-team');

      expect(userTenantRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          role: 'owner',
        }),
      );
      expect(userTenantRepo.save).toHaveBeenCalled();
    });
  });

  describe('listTenants', () => {
    it('should return empty array when user has no tenants', async () => {
      const result = await service.listTenants('user-1');
      expect(result).toEqual([]);
    });

    it('should return tenants with counts', async () => {
      userTenantRepo.find.mockResolvedValueOnce([
        { user_id: 'user-1', tenant_id: 'tenant-1' },
      ]);
      tenantRepo.find.mockResolvedValueOnce([
        { id: 'tenant-1', name: 'T1', slug: 't1' },
      ]);
      channelRepo.count.mockResolvedValueOnce(3);
      jobRepo.count.mockResolvedValueOnce(5);

      const result = await service.listTenants('user-1');
      expect(result).toEqual([
        {
          id: 'tenant-1',
          name: 'T1',
          slug: 't1',
          channels_count: 3,
          jobs_count: 5,
        },
      ]);
    });
  });

  describe('getTenant', () => {
    it('should throw NotFoundException when tenant does not exist', async () => {
      await expect(service.getTenant('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return tenant with counts', async () => {
      tenantRepo.findOne.mockResolvedValueOnce({
        id: 'tenant-1',
        name: 'T1',
        slug: 't1',
      });
      channelRepo.count.mockResolvedValueOnce(2);
      jobRepo.count.mockResolvedValueOnce(4);

      const result = await service.getTenant('tenant-1');
      expect(result).toEqual({
        id: 'tenant-1',
        name: 'T1',
        slug: 't1',
        channels_count: 2,
        jobs_count: 4,
      });
    });
  });

  describe('deleteTenant - cascade order', () => {
    it('should delete children before parents and all expected entities', async () => {
      conversationRepo.find.mockResolvedValueOnce([
        { id: 'conv-1' },
        { id: 'conv-2' },
      ]);
      jobRunRepo.find.mockResolvedValueOnce([
        { id: 'run-1' },
      ]);

      await service.deleteTenant('tenant-1');

      // Phase 1 children (Message, JobResult) must appear before Phase 2 entities
      const phase2Entities = [
        'Conversation', 'JobRun', 'AIUsageLog', 'NotificationLog',
        'ActivityLog', 'Job', 'AppSetting', 'Channel', 'UserTenant',
      ];
      const messageIdx = deleteCallOrder.indexOf('Message');
      const jobResultIdx = deleteCallOrder.indexOf('JobResult');

      for (const entity of phase2Entities) {
        const idx = deleteCallOrder.indexOf(entity);
        expect(idx).toBeGreaterThan(messageIdx);
        expect(idx).toBeGreaterThan(jobResultIdx);
      }

      // Tenant must be deleted last
      const tenantIdx = deleteCallOrder.indexOf('Tenant');
      expect(tenantIdx).toBe(deleteCallOrder.length - 1);

      // All entities should be present
      expect(deleteCallOrder).toContain('Message');
      expect(deleteCallOrder).toContain('JobResult');
      for (const entity of phase2Entities) {
        expect(deleteCallOrder).toContain(entity);
      }
      expect(deleteCallOrder).toContain('Tenant');
    });

    it('should skip message deletion when no conversations exist', async () => {
      await service.deleteTenant('tenant-1');

      expect(deleteCallOrder).not.toContain('Message');
      expect(deleteCallOrder).toContain('Conversation');
    });

    it('should skip job result deletion when no job runs exist', async () => {
      await service.deleteTenant('tenant-1');

      expect(deleteCallOrder).not.toContain('JobResult');
      expect(deleteCallOrder).toContain('JobRun');
    });
  });

  describe('updateTenant', () => {
    it('should update tenant name', async () => {
      const result = await service.updateTenant('tenant-1', { name: 'New Name' });
      expect(result).toEqual({ message: 'updated' });
      expect(tenantRepo.update).toHaveBeenCalledWith(
        'tenant-1',
        expect.objectContaining({ name: 'New Name' }),
      );
    });
  });
});
