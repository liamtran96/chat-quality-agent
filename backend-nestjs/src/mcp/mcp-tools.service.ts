import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../entities/tenant.entity';
import { UserTenant } from '../entities/user-tenant.entity';
import { Channel } from '../entities/channel.entity';
import { Conversation } from '../entities/conversation.entity';
import { Message } from '../entities/message.entity';
import { Job } from '../entities/job.entity';
import { JobResult } from '../entities/job-result.entity';
import { NotificationLog } from '../entities/notification-log.entity';

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties?: Record<string, { type: string; description: string }>;
    required?: string[];
  };
}

export interface ToolContent {
  type: string;
  text: string;
}

export interface ToolResult {
  content: ToolContent[];
  isError?: boolean;
}

@Injectable()
export class McpToolsService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(UserTenant)
    private readonly userTenantRepo: Repository<UserTenant>,
    @InjectRepository(Channel)
    private readonly channelRepo: Repository<Channel>,
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    @InjectRepository(Job)
    private readonly jobRepo: Repository<Job>,
    @InjectRepository(JobResult)
    private readonly jobResultRepo: Repository<JobResult>,
    @InjectRepository(NotificationLog)
    private readonly notificationLogRepo: Repository<NotificationLog>,
  ) {}

  getAllTools(): ToolDefinition[] {
    return [
      {
        name: 'cqa_list_tenants',
        description:
          'List all companies the user has access to, with summary stats (channels, jobs, conversations).',
        inputSchema: { type: 'object' },
      },
      {
        name: 'cqa_get_tenant',
        description: 'Get details of a specific company including settings and stats overview.',
        inputSchema: {
          type: 'object',
          properties: {
            tenant_id: { type: 'string', description: 'Tenant UUID' },
          },
          required: ['tenant_id'],
        },
      },
      {
        name: 'cqa_list_channels',
        description:
          'List chat channels for a company with status, last sync time, and message count.',
        inputSchema: {
          type: 'object',
          properties: {
            tenant_id: { type: 'string', description: 'Tenant UUID' },
          },
          required: ['tenant_id'],
        },
      },
      {
        name: 'cqa_list_conversations',
        description:
          'List conversations, optionally filtered by channel, date range, or customer name.',
        inputSchema: {
          type: 'object',
          properties: {
            tenant_id: { type: 'string', description: 'Tenant UUID' },
            channel_id: { type: 'string', description: 'Optional channel filter' },
            since: {
              type: 'string',
              description: 'ISO8601 date, filter conversations updated after this',
            },
            limit: { type: 'string', description: 'Max results (default 20)' },
          },
          required: ['tenant_id'],
        },
      },
      {
        name: 'cqa_get_messages',
        description: 'Get messages for a specific conversation with pagination.',
        inputSchema: {
          type: 'object',
          properties: {
            tenant_id: { type: 'string', description: 'Tenant UUID' },
            conversation_id: { type: 'string', description: 'Conversation UUID' },
            limit: { type: 'string', description: 'Max results (default 50)' },
          },
          required: ['tenant_id', 'conversation_id'],
        },
      },
      {
        name: 'cqa_search_messages',
        description: 'Search messages by keyword across all conversations.',
        inputSchema: {
          type: 'object',
          properties: {
            tenant_id: { type: 'string', description: 'Tenant UUID' },
            query: { type: 'string', description: 'Search keyword' },
            limit: { type: 'string', description: 'Max results (default 20)' },
          },
          required: ['tenant_id', 'query'],
        },
      },
      {
        name: 'cqa_list_jobs',
        description: 'List analysis jobs for a company with status and last run info.',
        inputSchema: {
          type: 'object',
          properties: {
            tenant_id: { type: 'string', description: 'Tenant UUID' },
          },
          required: ['tenant_id'],
        },
      },
      {
        name: 'cqa_get_job_results',
        description: 'Get analysis results for a specific job run.',
        inputSchema: {
          type: 'object',
          properties: {
            tenant_id: { type: 'string', description: 'Tenant UUID' },
            job_run_id: { type: 'string', description: 'Job run UUID' },
          },
          required: ['tenant_id', 'job_run_id'],
        },
      },
      {
        name: 'cqa_search_violations',
        description: 'Search QC violations by severity, date, channel, or keyword.',
        inputSchema: {
          type: 'object',
          properties: {
            tenant_id: { type: 'string', description: 'Tenant UUID' },
            severity: { type: 'string', description: 'NGHIEM_TRONG or CAN_CAI_THIEN' },
            since: { type: 'string', description: 'ISO8601 date filter' },
            limit: { type: 'string', description: 'Max results (default 20)' },
          },
          required: ['tenant_id'],
        },
      },
      {
        name: 'cqa_get_stats',
        description: 'Get overall statistics: conversations, issues, tags by time period.',
        inputSchema: {
          type: 'object',
          properties: {
            tenant_id: { type: 'string', description: 'Tenant UUID' },
            period: { type: 'string', description: 'today, week, month (default: today)' },
          },
          required: ['tenant_id'],
        },
      },
      {
        name: 'cqa_get_notification_logs',
        description: 'Get notification history filtered by date, channel type, or status.',
        inputSchema: {
          type: 'object',
          properties: {
            tenant_id: { type: 'string', description: 'Tenant UUID' },
            status: { type: 'string', description: 'sent or failed' },
            limit: { type: 'string', description: 'Max results (default 20)' },
          },
          required: ['tenant_id'],
        },
      },
      {
        name: 'cqa_trigger_job',
        description: 'Manually trigger an analysis job to run immediately.',
        inputSchema: {
          type: 'object',
          properties: {
            tenant_id: { type: 'string', description: 'Tenant UUID' },
            job_id: { type: 'string', description: 'Job UUID to trigger' },
          },
          required: ['tenant_id', 'job_id'],
        },
      },
    ];
  }

  async verifyTenantAccess(userId: string, tenantId: string): Promise<boolean> {
    const count = await this.userTenantRepo.count({
      where: { user_id: userId, tenant_id: tenantId },
    });
    return count > 0;
  }

  async callTool(
    toolName: string,
    args: Record<string, unknown>,
    userId: string,
  ): Promise<{ result?: ToolResult; rpcError?: { code: number; message: string } }> {
    const tenantId = (args.tenant_id as string) || '';

    // Verify tenant access for all tools except cqa_list_tenants
    if (toolName !== 'cqa_list_tenants') {
      if (!tenantId) {
        return { result: this.errResult('tenant_id is required') };
      }
      const hasAccess = await this.verifyTenantAccess(userId, tenantId);
      if (!hasAccess) {
        return { result: this.errResult("access denied: you don't have access to this tenant") };
      }
    }

    switch (toolName) {
      case 'cqa_list_tenants':
        return { result: await this.toolListTenants(userId) };
      case 'cqa_get_tenant':
        return { result: await this.toolGetTenant(tenantId) };
      case 'cqa_list_channels':
        return { result: await this.toolListChannels(tenantId) };
      case 'cqa_list_conversations':
        return { result: await this.toolListConversations(tenantId, args) };
      case 'cqa_get_messages':
        return {
          result: await this.toolGetMessages(
            tenantId,
            (args.conversation_id as string) || '',
            args,
          ),
        };
      case 'cqa_search_messages':
        return {
          result: await this.toolSearchMessages(tenantId, (args.query as string) || '', args),
        };
      case 'cqa_list_jobs':
        return { result: await this.toolListJobs(tenantId) };
      case 'cqa_get_job_results':
        return {
          result: await this.toolGetJobResults(tenantId, (args.job_run_id as string) || ''),
        };
      case 'cqa_search_violations':
        return { result: await this.toolSearchViolations(tenantId, args) };
      case 'cqa_get_stats':
        return { result: await this.toolGetStats(tenantId, (args.period as string) || '') };
      case 'cqa_get_notification_logs':
        return { result: await this.toolGetNotificationLogs(tenantId, args) };
      case 'cqa_trigger_job':
        return {
          result: await this.toolTriggerJob(tenantId, (args.job_id as string) || ''),
        };
      default:
        return { rpcError: { code: -32602, message: 'Unknown tool: ' + toolName } };
    }
  }

  private jsonResult(data: unknown): ToolResult {
    return {
      content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    };
  }

  private errResult(msg: string): ToolResult {
    return {
      content: [{ type: 'text', text: msg }],
      isError: true,
    };
  }

  private getLimit(args: Record<string, unknown>, defaultVal: number): number {
    const l = args.limit;
    if (typeof l === 'string') {
      const n = parseInt(l, 10);
      if (!isNaN(n) && n > 0) {
        return n > 200 ? 200 : n;
      }
    }
    return defaultVal;
  }

  private async toolListTenants(userId: string): Promise<ToolResult> {
    const tenants = await this.tenantRepo
      .createQueryBuilder('t')
      .where('t.id IN (SELECT tenant_id FROM user_tenants WHERE user_id = :userId)', { userId })
      .getMany();

    const results = [];
    for (const t of tenants) {
      const channelsCount = await this.channelRepo.count({ where: { tenant_id: t.id } });
      const jobsCount = await this.jobRepo.count({ where: { tenant_id: t.id } });
      const conversationsCount = await this.conversationRepo.count({
        where: { tenant_id: t.id },
      });
      results.push({
        id: t.id,
        name: t.name,
        slug: t.slug,
        channels_count: channelsCount,
        jobs_count: jobsCount,
        conversations_count: conversationsCount,
      });
    }
    return this.jsonResult(results);
  }

  private async toolGetTenant(tenantId: string): Promise<ToolResult> {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) {
      return this.errResult('Tenant not found');
    }
    return this.jsonResult(tenant);
  }

  private async toolListChannels(tenantId: string): Promise<ToolResult> {
    const channels = await this.channelRepo.find({ where: { tenant_id: tenantId } });
    return this.jsonResult(channels);
  }

  private async toolListConversations(
    tenantId: string,
    args: Record<string, unknown>,
  ): Promise<ToolResult> {
    const limit = this.getLimit(args, 20);
    const qb = this.conversationRepo
      .createQueryBuilder('c')
      .where('c.tenant_id = :tenantId', { tenantId });

    const channelId = args.channel_id as string | undefined;
    if (channelId) {
      qb.andWhere('c.channel_id = :channelId', { channelId });
    }

    const since = args.since as string | undefined;
    if (since) {
      const sinceDate = new Date(since);
      if (!isNaN(sinceDate.getTime())) {
        qb.andWhere('c.last_message_at > :since', { since: sinceDate });
      }
    }

    const convs = await qb.orderBy('c.last_message_at', 'DESC').take(limit).getMany();
    return this.jsonResult(convs);
  }

  private async toolGetMessages(
    tenantId: string,
    convId: string,
    args: Record<string, unknown>,
  ): Promise<ToolResult> {
    const limit = this.getLimit(args, 50);
    const messages = await this.messageRepo.find({
      where: { tenant_id: tenantId, conversation_id: convId },
      order: { sent_at: 'ASC' },
      take: limit,
    });
    return this.jsonResult(messages);
  }

  private async toolSearchMessages(
    tenantId: string,
    query: string,
    args: Record<string, unknown>,
  ): Promise<ToolResult> {
    const limit = this.getLimit(args, 20);
    const messages = await this.messageRepo
      .createQueryBuilder('m')
      .where('m.tenant_id = :tenantId', { tenantId })
      .andWhere('m.content ILIKE :query', { query: `%${query}%` })
      .orderBy('m.sent_at', 'DESC')
      .take(limit)
      .getMany();
    return this.jsonResult(messages);
  }

  private async toolListJobs(tenantId: string): Promise<ToolResult> {
    const jobs = await this.jobRepo.find({
      where: { tenant_id: tenantId },
      order: { created_at: 'DESC' },
    });
    return this.jsonResult(jobs);
  }

  private async toolGetJobResults(tenantId: string, runId: string): Promise<ToolResult> {
    const results = await this.jobResultRepo.find({
      where: { tenant_id: tenantId, job_run_id: runId },
      order: { created_at: 'DESC' },
    });
    return this.jsonResult(results);
  }

  private async toolSearchViolations(
    tenantId: string,
    args: Record<string, unknown>,
  ): Promise<ToolResult> {
    const limit = this.getLimit(args, 20);
    const qb = this.jobResultRepo
      .createQueryBuilder('r')
      .where('r.tenant_id = :tenantId', { tenantId })
      .andWhere("r.result_type = 'qc_violation'");

    const severity = args.severity as string | undefined;
    if (severity) {
      qb.andWhere('r.severity = :severity', { severity });
    }

    const since = args.since as string | undefined;
    if (since) {
      const sinceDate = new Date(since);
      if (!isNaN(sinceDate.getTime())) {
        qb.andWhere('r.created_at > :since', { since: sinceDate });
      }
    }

    const results = await qb.orderBy('r.created_at', 'DESC').take(limit).getMany();
    return this.jsonResult(results);
  }

  private async toolGetStats(tenantId: string, period: string): Promise<ToolResult> {
    let since: Date;
    switch (period) {
      case 'week':
        since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        since = new Date();
        since.setMonth(since.getMonth() - 1);
        break;
      default:
        // today
        since = new Date();
        since.setHours(0, 0, 0, 0);
        break;
    }

    const [conversations, messages, violations, tags] = await Promise.all([
      this.conversationRepo
        .createQueryBuilder('c')
        .where('c.tenant_id = :tenantId', { tenantId })
        .andWhere('c.last_message_at > :since', { since })
        .getCount(),
      this.messageRepo
        .createQueryBuilder('m')
        .where('m.tenant_id = :tenantId', { tenantId })
        .andWhere('m.sent_at > :since', { since })
        .getCount(),
      this.jobResultRepo
        .createQueryBuilder('r')
        .where('r.tenant_id = :tenantId', { tenantId })
        .andWhere("r.result_type = 'qc_violation'")
        .andWhere('r.created_at > :since', { since })
        .getCount(),
      this.jobResultRepo
        .createQueryBuilder('r')
        .where('r.tenant_id = :tenantId', { tenantId })
        .andWhere("r.result_type = 'classification_tag'")
        .andWhere('r.created_at > :since', { since })
        .getCount(),
    ]);

    return this.jsonResult({
      period: period || 'today',
      since,
      conversations,
      messages,
      violations,
      tags,
    });
  }

  private async toolGetNotificationLogs(
    tenantId: string,
    args: Record<string, unknown>,
  ): Promise<ToolResult> {
    const limit = this.getLimit(args, 20);
    const qb = this.notificationLogRepo
      .createQueryBuilder('n')
      .where('n.tenant_id = :tenantId', { tenantId });

    const status = args.status as string | undefined;
    if (status) {
      qb.andWhere('n.status = :status', { status });
    }

    const logs = await qb.orderBy('n.sent_at', 'DESC').take(limit).getMany();
    return this.jsonResult(logs);
  }

  private async toolTriggerJob(tenantId: string, jobId: string): Promise<ToolResult> {
    const job = await this.jobRepo.findOne({
      where: { id: jobId, tenant_id: tenantId },
    });
    if (!job) {
      return this.errResult('Job not found');
    }
    return this.jsonResult({
      status: 'triggered',
      message: 'Job ' + job.name + ' has been queued for execution',
    });
  }
}
