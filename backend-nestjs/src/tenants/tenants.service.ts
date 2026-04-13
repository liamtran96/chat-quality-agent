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

    return Promise.all(tenants.map((t) => this.buildTenantResponse(t)));
  }

  async createTenant(
    userId: string,
    dto: CreateTenantDto,
  ): Promise<TenantResponse> {
    if (dto.slug.length < 3 || !SLUG_REGEX.test(dto.slug)) {
      throw new ConflictException({
        error: 'invalid_slug',
        details: 'slug must be lowercase alphanumeric with hyphens',
      });
    }

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

  async getTenant(tenantId: string): Promise<TenantResponse> {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException({ error: 'tenant_not_found' });
    }

    return this.buildTenantResponse(tenant);
  }

  private async buildTenantResponse(tenant: Tenant): Promise<TenantResponse> {
    const [channelsCount, jobsCount] = await Promise.all([
      this.channelRepo.count({ where: { tenant_id: tenant.id } }),
      this.jobRepo.count({ where: { tenant_id: tenant.id } }),
    ]);

    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      channels_count: channelsCount,
      jobs_count: jobsCount,
    };
  }

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
   * Delete a tenant and all related data.
   * Order matters: children with FK constraints must be deleted before parents.
   * Independent sibling deletes are parallelized where safe.
   */
  async deleteTenant(tenantId: string): Promise<{ message: string }> {
    const filesPath = this.configService.get<string>('filesPath') || '/var/lib/cqa/files';
    const tenantFilesDir = path.join(filesPath, tenantId);
    fs.rmSync(tenantFilesDir, { recursive: true, force: true });

    // Phase 1: Delete children that depend on conversation/job_run IDs
    const [conversations, jobRuns] = await Promise.all([
      this.conversationRepo.find({ where: { tenant_id: tenantId }, select: ['id'] }),
      this.jobRunRepo.find({ where: { tenant_id: tenantId }, select: ['id'] }),
    ]);

    const convIds = conversations.map((c) => c.id);
    const runIds = jobRuns.map((r) => r.id);

    await Promise.all([
      convIds.length > 0 ? this.messageRepo.delete({ conversation_id: In(convIds) }) : Promise.resolve(),
      runIds.length > 0 ? this.jobResultRepo.delete({ job_run_id: In(runIds) }) : Promise.resolve(),
    ]);

    // Phase 2: Delete all tenant-scoped tables (no inter-dependencies)
    await Promise.all([
      this.conversationRepo.delete({ tenant_id: tenantId }),
      this.jobRunRepo.delete({ tenant_id: tenantId }),
      this.aiUsageLogRepo.delete({ tenant_id: tenantId }),
      this.notificationLogRepo.delete({ tenant_id: tenantId }),
      this.activityLogRepo.delete({ tenant_id: tenantId }),
      this.jobRepo.delete({ tenant_id: tenantId }),
      this.appSettingRepo.delete({ tenant_id: tenantId }),
      this.channelRepo.delete({ tenant_id: tenantId }),
      this.userTenantRepo.delete({ tenant_id: tenantId }),
    ]);

    // Phase 3: Delete the tenant itself
    await this.tenantRepo.delete({ id: tenantId });

    return { message: 'deleted' };
  }
}
