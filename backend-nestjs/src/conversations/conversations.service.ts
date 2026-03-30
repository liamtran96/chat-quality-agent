import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Conversation } from '../entities/conversation.entity';
import { Message } from '../entities/message.entity';
import { Channel } from '../entities/channel.entity';
import { JobResult } from '../entities/job-result.entity';
import { JobRun } from '../entities/job-run.entity';
import { toVN, toVNTime, toVNDateTime, toVNDate, toUTCString } from '../common/helpers';

interface ListConversationsQuery {
  page?: number;
  per_page?: number;
  channel_id?: string;
  channel_type?: string;
  search?: string;
  evaluation?: string;
}

interface ExportQuery {
  from?: string;
  to?: string;
  format?: string;
  channel_id?: string;
  channel_type?: string;
}

export type ExportResult =
  | { type: 'json'; body: { error: string } }
  | { type: 'csv'; content: string; filename: string }
  | { type: 'txt'; content: string; filename: string };

@Injectable()
export class ConversationsService {
  constructor(
    @InjectRepository(Conversation)
    private conversationRepo: Repository<Conversation>,
    @InjectRepository(Message)
    private messageRepo: Repository<Message>,
    @InjectRepository(Channel)
    private channelRepo: Repository<Channel>,
    @InjectRepository(JobResult)
    private jobResultRepo: Repository<JobResult>,
    @InjectRepository(JobRun)
    private jobRunRepo: Repository<JobRun>,
  ) {}

  async listConversations(tenantId: string, query: ListConversationsQuery) {
    let page = query.page || 1;
    let perPage = query.per_page || 50;

    if (page < 1) page = 1;
    if (perPage < 1 || perPage > 100) perPage = 50;

    const qb = this.conversationRepo
      .createQueryBuilder('conversations')
      .where('conversations.tenant_id = :tenantId', { tenantId });

    this.applyChannelFilters(qb, query.channel_id, query.channel_type);

    if (query.search) {
      qb.andWhere('conversations.customer_name ILIKE :search', {
        search: `%${query.search}%`,
      });
    }

    this.applyEvaluationFilter(qb, query.evaluation, tenantId);

    const total = await qb.getCount();

    const conversations = await qb
      .orderBy('conversations.last_message_at', 'DESC')
      .offset((page - 1) * perPage)
      .limit(perPage)
      .getMany();

    const channelIds = [...new Set(conversations.map((c) => c.channel_id))];
    const channelMap = new Map<string, Channel>();

    if (channelIds.length > 0) {
      const channels = await this.channelRepo
        .createQueryBuilder('channels')
        .where('channels.id IN (:...channelIds)', { channelIds })
        .getMany();
      for (const ch of channels) {
        channelMap.set(ch.id, ch);
      }
    }

    const data = conversations.map((conv) => {
      const ch = channelMap.get(conv.channel_id);
      return {
        id: conv.id,
        channel_id: conv.channel_id,
        channel_name: ch?.name || '',
        channel_type: ch?.channel_type || '',
        customer_name: conv.customer_name,
        last_message_at: conv.last_message_at
          ? toUTCString(conv.last_message_at)
          : null,
        message_count: conv.message_count,
        created_at: toUTCString(conv.created_at),
      };
    });

    return { data, total, page, per_page: perPage };
  }

  async getConversationMessages(tenantId: string, conversationId: string) {
    const conv = await this.conversationRepo.findOne({
      where: { id: conversationId, tenant_id: tenantId },
    });

    if (!conv) {
      throw new NotFoundException('conversation_not_found');
    }

    const messages = await this.messageRepo.find({
      where: { conversation_id: conversationId, tenant_id: tenantId },
      order: { sent_at: 'ASC' },
    });

    const results = messages.map((msg) => ({
      id: msg.id,
      sender_type: msg.sender_type,
      sender_name: msg.sender_name,
      content: msg.content,
      content_type: msg.content_type,
      attachments: msg.attachments,
      sent_at: toVN(msg.sent_at),
    }));

    return {
      conversation: {
        id: conv.id,
        customer_name: conv.customer_name,
        message_count: conv.message_count,
      },
      messages: results,
    };
  }

  async listEvaluatedConversations(tenantId: string) {
    const results: Array<{
      conversation_id: string;
      severity: string;
    }> = await this.jobResultRepo.query(
      `
      SELECT jr.conversation_id, jr.severity
      FROM job_results jr
      INNER JOIN (
        SELECT conversation_id, MAX(created_at) as max_created
        FROM job_results
        WHERE tenant_id = $1 AND result_type = 'conversation_evaluation'
        GROUP BY conversation_id
      ) latest ON jr.conversation_id = latest.conversation_id AND jr.created_at = latest.max_created
      WHERE jr.tenant_id = $2 AND jr.result_type = 'conversation_evaluation'
      `,
      [tenantId, tenantId],
    );

    const evalMap: Record<string, string> = {};
    for (const r of results) {
      evalMap[r.conversation_id] = r.severity;
    }
    return evalMap;
  }

  async getConversationEvaluations(tenantId: string, conversationId: string) {
    const conv = await this.conversationRepo.findOne({
      where: { id: conversationId, tenant_id: tenantId },
    });

    if (!conv) {
      throw new NotFoundException('conversation_not_found');
    }

    const results = await this.jobResultRepo.find({
      where: { conversation_id: conversationId, tenant_id: tenantId },
      order: { created_at: 'DESC' },
    });

    if (results.length === 0) {
      return { has_evaluation: false, groups: [] };
    }

    const runIds = [...new Set(results.map((r) => r.job_run_id))];

    const runs: Array<{
      run_id: string;
      job_name: string;
      job_type: string;
      evaluated_at: Date;
    }> = await this.jobRunRepo
      .createQueryBuilder('job_runs')
      .select([
        'job_runs.id AS run_id',
        'jobs.name AS job_name',
        'jobs.job_type AS job_type',
        'job_runs.started_at AS evaluated_at',
      ])
      .leftJoin('jobs', 'jobs', 'jobs.id = job_runs.job_id')
      .where('job_runs.id IN (:...runIds)', { runIds })
      .orderBy('job_runs.started_at', 'DESC')
      .getRawMany();

    const runMap = new Map<
      string,
      { run_id: string; job_name: string; job_type: string; evaluated_at: Date }
    >();
    for (const r of runs) {
      runMap.set(r.run_id, r);
    }

    const groupMap = new Map<
      string,
      {
        job_run_id: string;
        job_name: string;
        job_type: string;
        evaluated_at: Date;
        results: any[];
      }
    >();

    for (const r of results) {
      if (!groupMap.has(r.job_run_id)) {
        const info = runMap.get(r.job_run_id);
        groupMap.set(r.job_run_id, {
          job_run_id: r.job_run_id,
          job_name: info?.job_name || '',
          job_type: info?.job_type || '',
          evaluated_at: info?.evaluated_at || r.created_at,
          results: [],
        });
      }
      groupMap.get(r.job_run_id)!.results.push(r);
    }

    const groups = Array.from(groupMap.values());

    return { has_evaluation: true, groups };
  }

  async getConversationPage(
    tenantId: string,
    conversationId: string,
    perPage?: number,
  ) {
    if (!perPage || perPage < 1 || perPage > 100) {
      perPage = 9;
    }

    const conv = await this.conversationRepo.findOne({
      where: { id: conversationId, tenant_id: tenantId },
    });

    if (!conv) {
      throw new NotFoundException('conversation_not_found');
    }

    const position = await this.conversationRepo
      .createQueryBuilder('conversations')
      .where('conversations.tenant_id = :tenantId', { tenantId })
      .andWhere('conversations.last_message_at > :lastMessageAt', {
        lastMessageAt: conv.last_message_at,
      })
      .getCount();

    const page = Math.floor(position / perPage) + 1;

    return { page };
  }

  async exportMessages(tenantId: string, query: ExportQuery): Promise<ExportResult> {
    const format = query.format || 'txt';

    if (!query.from || !query.to) {
      throw new BadRequestException(
        'Cần chọn ngày bắt đầu (from) và ngày kết thúc (to)',
      );
    }

    const fromDate = new Date(query.from);
    if (isNaN(fromDate.getTime())) {
      throw new BadRequestException('Ngày bắt đầu không hợp lệ');
    }

    const toDate = new Date(query.to);
    if (isNaN(toDate.getTime())) {
      throw new BadRequestException('Ngày kết thúc không hợp lệ');
    }

    // Include the whole end day (23:59:59)
    toDate.setHours(23, 59, 59, 0);

    const qb = this.conversationRepo
      .createQueryBuilder('conversations')
      .where('conversations.tenant_id = :tenantId', { tenantId })
      .andWhere('conversations.last_message_at >= :fromDate', { fromDate })
      .andWhere('conversations.last_message_at <= :toDate', { toDate });

    this.applyChannelFilters(qb, query.channel_id, query.channel_type);

    const conversations = await qb
      .orderBy('conversations.last_message_at', 'ASC')
      .getMany();

    if (conversations.length === 0) {
      return {
        type: 'json',
        body: { error: 'Không có cuộc chat nào trong khoảng thời gian này' },
      };
    }

    const convIds = conversations.map((c) => c.id);
    const allMessages = await this.messageRepo
      .createQueryBuilder('messages')
      .where('messages.tenant_id = :tenantId', { tenantId })
      .andWhere('messages.conversation_id IN (:...convIds)', { convIds })
      .orderBy('messages.conversation_id', 'ASC')
      .addOrderBy('messages.sent_at', 'ASC')
      .getMany();

    const msgMap = new Map<string, Message[]>();
    for (const msg of allMessages) {
      if (!msgMap.has(msg.conversation_id)) {
        msgMap.set(msg.conversation_id, []);
      }
      msgMap.get(msg.conversation_id)!.push(msg);
    }

    if (format === 'csv') {
      return {
        type: 'csv',
        ...this.exportMessagesCSV(conversations, msgMap, query.from, query.to),
      };
    }

    return {
      type: 'txt',
      ...this.exportMessagesTXT(conversations, msgMap, query.from, query.to),
    };
  }

  private exportMessagesTXT(
    conversations: Conversation[],
    msgMap: Map<string, Message[]>,
    fromStr: string,
    toStr: string,
  ): { content: string; filename: string } {
    const lines: string[] = [];
    lines.push(`=== EXPORT TIN NHẮN: ${fromStr} đến ${toStr} ===`);
    lines.push(`Tổng số cuộc chat: ${conversations.length}`);
    lines.push('');

    for (let i = 0; i < conversations.length; i++) {
      const conv = conversations[i];
      const msgs = msgMap.get(conv.id) || [];
      let firstMsgDate = '';
      if (msgs.length > 0) {
        firstMsgDate = toVNDateTime(msgs[0].sent_at);
      }

      lines.push(`--- Cuộc chat #${i + 1}: ${conv.customer_name} ---`);
      lines.push(`Ngày: ${firstMsgDate} | Số tin nhắn: ${msgs.length}`);
      lines.push('');

      for (const msg of msgs) {
        const ts = toVNTime(msg.sent_at);
        const name = this.resolveSenderName(msg, conv.customer_name);
        const content = this.resolveContent(msg);
        lines.push(`[${ts}] ${name}: ${content}`);
      }
      lines.push('');
    }

    return {
      content: lines.join('\n'),
      filename: `messages_${fromStr}_${toStr}.txt`,
    };
  }

  private exportMessagesCSV(
    conversations: Conversation[],
    msgMap: Map<string, Message[]>,
    fromStr: string,
    toStr: string,
  ): { content: string; filename: string } {
    const escape = (s: string): string => {
      s = s.replace(/"/g, '""');
      s = s.replace(/\n/g, ' ');
      s = s.replace(/\r/g, '');
      return `"${s}"`;
    };

    const lines: string[] = [];
    lines.push(
      '\xEF\xBB\xBFKhách hàng,Ngày chat,Người gửi,Loại,Thời gian,Nội dung',
    );

    for (const conv of conversations) {
      const msgs = msgMap.get(conv.id) || [];
      let convDate = '';
      if (msgs.length > 0) {
        convDate = toVNDate(msgs[0].sent_at);
      }

      for (const msg of msgs) {
        const name = this.resolveSenderName(msg, conv.customer_name);
        const content = this.resolveContent(msg);
        lines.push(
          [
            escape(conv.customer_name),
            escape(convDate),
            escape(name),
            escape(msg.sender_type),
            escape(toVNTime(msg.sent_at)),
            escape(content),
          ].join(','),
        );
      }
    }

    return {
      content: lines.join('\n'),
      filename: `messages_${fromStr}_${toStr}.csv`,
    };
  }

  private resolveSenderName(msg: Message, customerName: string): string {
    if (msg.sender_name) return msg.sender_name;
    return msg.sender_type === 'agent' ? 'OA' : customerName;
  }

  private resolveContent(msg: Message): string {
    if (msg.content) return msg.content;
    if (msg.content_type !== 'text') return `[${msg.content_type}]`;
    return '';
  }

  private applyChannelFilters(
    qb: SelectQueryBuilder<Conversation>,
    channelId?: string,
    channelType?: string,
  ): void {
    if (channelId) {
      qb.andWhere('conversations.channel_id = :channelId', { channelId });
    }

    if (channelType) {
      qb.innerJoin(
        'channels',
        'ch_filter',
        'ch_filter.id = conversations.channel_id',
      ).andWhere('ch_filter.channel_type = :channelType', { channelType });
    }
  }

  private applyEvaluationFilter(
    qb: SelectQueryBuilder<Conversation>,
    evalFilter: string | undefined,
    tenantId: string,
  ): void {
    if (!evalFilter) return;

    switch (evalFilter) {
      case 'evaluated':
        qb.andWhere(
          `conversations.id IN (SELECT DISTINCT conversation_id FROM job_results WHERE tenant_id = :evalTenantId AND result_type = 'conversation_evaluation')`,
          { evalTenantId: tenantId },
        );
        break;

      case 'not_evaluated':
        qb.andWhere(
          `conversations.id NOT IN (SELECT DISTINCT conversation_id FROM job_results WHERE tenant_id = :evalTenantId AND result_type = 'conversation_evaluation')`,
          { evalTenantId: tenantId },
        );
        break;

      case 'PASS':
      case 'FAIL':
        qb.andWhere(
          `conversations.id IN (
            SELECT jr.conversation_id FROM job_results jr
            INNER JOIN (
              SELECT conversation_id, MAX(created_at) as mc
              FROM job_results
              WHERE tenant_id = :evalTenantId AND result_type = 'conversation_evaluation'
              GROUP BY conversation_id
            ) latest ON jr.conversation_id = latest.conversation_id AND jr.created_at = latest.mc
            WHERE jr.severity = :evalSeverity
          )`,
          { evalTenantId: tenantId, evalSeverity: evalFilter },
        );
        break;
    }
  }
}
