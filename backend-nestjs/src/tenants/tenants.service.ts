import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
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
import { newUUID } from '../common/helpers';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

export interface TenantResponse {
  id: string;
  name: string;
  slug: string;
  channels_count: number;
  jobs_count: number;
}

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(UserTenant)
    private readonly userTenantRepo: Repository<UserTenant>,
    @InjectRepository(Channel)
    private readonly channelRepo: Repository<Channel>,
    @InjectRepository(Job)
    private readonly jobRepo: Repository<Job>,
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    @InjectRepository(JobRun)
    private readonly jobRunRepo: Repository<JobRun>,
    @InjectRepository(JobResult)
    private readonly jobResultRepo: Repository<JobResult>,
    @InjectRepository(NotificationLog)
    private readonly notificationLogRepo: Repository<NotificationLog>,
    @InjectRepository(AIUsageLog)
    private readonly aiUsageLogRepo: Repository<AIUsageLog>,
    @InjectRepository(ActivityLog)
    private readonly activityLogRepo: Repository<ActivityLog>,
    @InjectRepository(AppSetting)
    private readonly appSettingRepo: Repository<AppSetting>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * List all tenants the user belongs to, with channel and job counts.
   * Ported from Go: handlers/tenants.go ListTenants()
   */
  async listTenants(userId: string): Promise<TenantResponse[]> {
    const userTenants = await this.userTenantRepo.find({
      where: { user_id: userId },
    });

    const tenantIds = userTenants.map((ut) => ut.tenant_id);
    if (tenantIds.length === 0) {
      return [];
    }

    const tenants = await this.tenantRepo.find({
      where: { id: In(tenantIds) },
    });

    const results: TenantResponse[] = [];
    for (const t of tenants) {
      const channelsCount = await this.channelRepo.count({
        where: { tenant_id: t.id },
      });
      const jobsCount = await this.jobRepo.count({
        where: { tenant_id: t.id },
      });
      results.push({
        id: t.id,
        name: t.name,
        slug: t.slug,
        channels_count: channelsCount,
        jobs_count: jobsCount,
      });
    }

    return results;
  }

  /**
   * Create a new tenant and assign the creator as owner.
   * Ported from Go: handlers/tenants.go CreateTenant()
   */
  async createTenant(
    userId: string,
    dto: CreateTenantDto,
  ): Promise<TenantResponse> {
    // Validate slug format
    if (dto.slug.length < 3 || !SLUG_REGEX.test(dto.slug)) {
      throw new ConflictException({
        error: 'invalid_slug',
        details: 'slug must be lowercase alphanumeric with hyphens',
      });
    }

    // Check slug uniqueness
    const existing = await this.tenantRepo.count({
      where: { slug: dto.slug },
    });
    if (existing > 0) {
      throw new ConflictException({ error: 'slug_already_exists' });
    }

    const now = new Date();
    const tenant = this.tenantRepo.create({
      id: newUUID(),
      name: dto.name,
      slug: dto.slug,
      settings: '{}',
      created_at: now,
      updated_at: now,
    });

    try {
      await this.tenantRepo.save(tenant);
    } catch {
      throw new InternalServerErrorException({ error: 'create_tenant_failed' });
    }

    // Add creator as owner
    const ut = this.userTenantRepo.create({
      user_id: userId,
      tenant_id: tenant.id,
      role: 'owner',
    });
    await this.userTenantRepo.save(ut);

    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      channels_count: 0,
      jobs_count: 0,
    };
  }

  /**
   * Get a single tenant with counts.
   * Ported from Go: handlers/tenants.go GetTenant()
   */
  async getTenant(tenantId: string): Promise<TenantResponse> {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException({ error: 'tenant_not_found' });
    }

    const channelsCount = await this.channelRepo.count({
      where: { tenant_id: tenantId },
    });
    const jobsCount = await this.jobRepo.count({
      where: { tenant_id: tenantId },
    });

    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      channels_count: channelsCount,
      jobs_count: jobsCount,
    };
  }

  /**
   * Get the current user's membership (role + permissions) for a tenant.
   * Ported from Go: handlers/auth.go GetTenantMe()
   */
  async getTenantMembership(
    tenantId: string,
    userId: string,
  ): Promise<{ role: string; permissions: string }> {
    const ut = await this.userTenantRepo.findOne({
      where: { user_id: userId, tenant_id: tenantId },
    });

    return {
      role: ut?.role ?? '',
      permissions: ut?.permissions ?? '',
    };
  }

  /**
   * Update a tenant's name.
   * Ported from Go: handlers/tenants.go UpdateTenant()
   */
  async updateTenant(
    tenantId: string,
    dto: UpdateTenantDto,
  ): Promise<{ message: string }> {
    const result = await this.tenantRepo.update(tenantId, {
      name: dto.name,
      updated_at: new Date(),
    });

    if (result.affected === 0) {
      throw new InternalServerErrorException({ error: 'update_tenant_failed' });
    }

    return { message: 'updated' };
  }

  /**
   * Delete a tenant and all related data in cascade order.
   * Ported from Go: handlers/tenants.go DeleteTenant()
   *
   * Cascade order (child -> parent):
   *  0. Files on disk
   *  1. Messages (via conversations)
   *  2. Conversations
   *  3. JobResults (via job_runs)
   *  4. JobRuns
   *  5. AIUsageLogs
   *  6. NotificationLogs
   *  7. ActivityLogs
   *  8. Jobs
   *  9. AppSettings
   * 10. Channels
   * 11. UserTenants
   * 12. Tenant
   */
  async deleteTenant(tenantId: string): Promise<{ message: string }> {
    // 0. Delete all local attachment files for this tenant
    const filesPath = this.configService.get<string>('filesPath') || '/var/lib/cqa/files';
    const tenantFilesDir = path.join(filesPath, tenantId);
    fs.rmSync(tenantFilesDir, { recursive: true, force: true });

    // 1. Messages (via conversations)
    const conversations = await this.conversationRepo.find({
      where: { tenant_id: tenantId },
      select: ['id'],
    });
    const convIds = conversations.map((c) => c.id);
    if (convIds.length > 0) {
      await this.messageRepo.delete({ conversation_id: In(convIds) });
    }

    // 2. Conversations
    await this.conversationRepo.delete({ tenant_id: tenantId });

    // 3. JobResults (via job_runs)
    const jobRuns = await this.jobRunRepo.find({
      where: { tenant_id: tenantId },
      select: ['id'],
    });
    const runIds = jobRuns.map((r) => r.id);
    if (runIds.length > 0) {
      await this.jobResultRepo.delete({ job_run_id: In(runIds) });
    }

    // 4. JobRuns
    await this.jobRunRepo.delete({ tenant_id: tenantId });

    // 5. AIUsageLogs
    await this.aiUsageLogRepo.delete({ tenant_id: tenantId });

    // 6. NotificationLogs
    await this.notificationLogRepo.delete({ tenant_id: tenantId });

    // 7. ActivityLogs
    await this.activityLogRepo.delete({ tenant_id: tenantId });

    // 8. Jobs
    await this.jobRepo.delete({ tenant_id: tenantId });

    // 9. AppSettings
    await this.appSettingRepo.delete({ tenant_id: tenantId });

    // 10. Channels
    await this.channelRepo.delete({ tenant_id: tenantId });

    // 11. UserTenants
    await this.userTenantRepo.delete({ tenant_id: tenantId });

    // 12. Tenant
    await this.tenantRepo.delete({ id: tenantId });

    return { message: 'deleted' };
  }
}
