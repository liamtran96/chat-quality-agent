import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Tenant } from '../entities/tenant.entity';
import { Channel } from '../entities/channel.entity';
import { Conversation } from '../entities/conversation.entity';
import { Message } from '../entities/message.entity';
import { Job } from '../entities/job.entity';
import { JobRun } from '../entities/job-run.entity';
import { JobResult } from '../entities/job-result.entity';
import { AIUsageLog } from '../entities/ai-usage-log.entity';
import { NotificationLog } from '../entities/notification-log.entity';
import { ActivityLog } from '../entities/activity-log.entity';
import { AppSetting } from '../entities/app-setting.entity';
import { newUUID } from '../common/helpers';

@Injectable()
export class DemoService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(Channel)
    private readonly channelRepo: Repository<Channel>,
    private readonly dataSource: DataSource,
  ) {}

  async getDemoStatus(tenantId: string) {
    const channelCount = await this.channelRepo.count({
      where: { tenant_id: tenantId },
    });

    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    const isDemo = this.isDemoTenant(tenant);

    return { has_data: channelCount > 0, is_demo: isDemo };
  }

  async importDemoData(
    tenantId: string,
  ): Promise<Record<string, unknown>> {
    const channelCount = await this.channelRepo.count({
      where: { tenant_id: tenantId },
    });
    if (channelCount > 0) {
      return { error: 'tenant_has_data' };
    }

    const now = new Date();
    const zaloChannelID = newUUID();
    const fbChannelID = newUUID();
    const qcJobID = newUUID();
    const qcRunID = newUUID();
    const classJobID = newUUID();
    const classRunID = newUUID();

    const dummyCreds = Buffer.from('{"demo":true}');
    const inputChannelIDs = JSON.stringify([zaloChannelID, fbChannelID]);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Channels
      await queryRunner.manager.save(Channel, [
        {
          id: zaloChannelID, tenant_id: tenantId, channel_type: 'zalo_oa',
          name: 'SePay Coffee Zalo OA', external_id: 'demo-zalo-oa',
          credentials_encrypted: dummyCreds, is_active: true, metadata: '{}',
          created_at: new Date(now.getTime() - 14 * 86400000), updated_at: now,
        },
        {
          id: fbChannelID, tenant_id: tenantId, channel_type: 'facebook',
          name: 'SePay Coffee Facebook', external_id: 'demo-fb-page',
          credentials_encrypted: dummyCreds, is_active: true, metadata: '{}',
          created_at: new Date(now.getTime() - 14 * 86400000), updated_at: now,
        },
      ]);

      // Jobs
      await queryRunner.manager.save(Job, [
        {
          id: qcJobID, tenant_id: tenantId, name: 'Demo QC Job',
          description: 'Demo quality check job', job_type: 'qc_analysis',
          input_channel_ids: inputChannelIDs, outputs: '[]',
          output_schedule: 'none', schedule_type: 'manual', is_active: true,
          last_run_at: now, last_run_status: 'success',
          created_at: new Date(now.getTime() - 13 * 86400000), updated_at: now,
        },
        {
          id: classJobID, tenant_id: tenantId, name: 'Demo Classification Job',
          description: 'Demo classification job', job_type: 'classification',
          input_channel_ids: inputChannelIDs, outputs: '[]',
          output_schedule: 'none', schedule_type: 'manual', is_active: true,
          last_run_at: now, last_run_status: 'success',
          created_at: new Date(now.getTime() - 13 * 86400000), updated_at: now,
        },
      ]);

      // Job Runs
      const runFinished = new Date(now.getTime() - 30 * 60000);
      const qcSummary = JSON.stringify({
        conversations_found: 5, conversations_analyzed: 5,
        conversations_passed: 3, conversations_failed: 2, conversations_skipped: 0,
      });
      const classSummary = JSON.stringify({
        conversations_found: 5, conversations_analyzed: 5,
        conversations_passed: 5, conversations_skipped: 0,
      });

      await queryRunner.manager.save(JobRun, [
        {
          id: qcRunID, job_id: qcJobID, tenant_id: tenantId,
          started_at: new Date(now.getTime() - 2 * 3600000),
          finished_at: runFinished, status: 'success',
          summary: qcSummary, created_at: new Date(now.getTime() - 2 * 3600000),
        },
        {
          id: classRunID, job_id: classJobID, tenant_id: tenantId,
          started_at: new Date(now.getTime() - 1 * 3600000),
          finished_at: runFinished, status: 'success',
          summary: classSummary, created_at: new Date(now.getTime() - 1 * 3600000),
        },
      ]);

      // Set demo flag
      await queryRunner.manager.update(Tenant, tenantId, {
        settings: JSON.stringify({ is_demo_data: true }),
      });

      await queryRunner.commitTransaction();

      return {
        message: 'Demo data imported successfully',
        channels: 2,
        conversations: 0,
        messages: 0,
        jobs: 2,
        results: 0,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      return { error: err instanceof Error ? err.message : String(err) };
    } finally {
      await queryRunner.release();
    }
  }

  async resetDemoData(tenantId: string): Promise<Record<string, unknown>> {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) {
      return { error: 'tenant_not_found' };
    }

    if (!this.isDemoTenant(tenant)) {
      return { error: 'not_demo_data' };
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Delete in dependency order
      await queryRunner.manager.delete(Message, { tenant_id: tenantId });
      await queryRunner.manager.delete(JobResult, { tenant_id: tenantId });
      await queryRunner.manager.delete(AIUsageLog, { tenant_id: tenantId });
      await queryRunner.manager.delete(NotificationLog, { tenant_id: tenantId });
      await queryRunner.manager.delete(ActivityLog, { tenant_id: tenantId });
      await queryRunner.manager.delete(JobRun, { tenant_id: tenantId });
      await queryRunner.manager.delete(Job, { tenant_id: tenantId });
      await queryRunner.manager.delete(Conversation, { tenant_id: tenantId });
      await queryRunner.manager.delete(AppSetting, { tenant_id: tenantId });
      await queryRunner.manager.delete(Channel, { tenant_id: tenantId });

      // Clear demo flag
      await queryRunner.manager.update(Tenant, tenantId, { settings: '{}' });

      await queryRunner.commitTransaction();
      return { message: 'All demo data deleted' };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      return { error: err instanceof Error ? err.message : String(err) };
    } finally {
      await queryRunner.release();
    }
  }

  private isDemoTenant(tenant: Tenant | null): boolean {
    if (!tenant?.settings) return false;
    try {
      const s = JSON.parse(tenant.settings);
      return s.is_demo_data === true;
    } catch {
      return false;
    }
  }
}
