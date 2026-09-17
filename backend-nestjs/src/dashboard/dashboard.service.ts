import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
import { parseExchangeRate } from '../common/helpers';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Channel)
    private readonly channelRepo: Repository<Channel>,
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
    @InjectRepository(Job)
    private readonly jobRepo: Repository<Job>,
    @InjectRepository(JobRun)
    private readonly jobRunRepo: Repository<JobRun>,
    @InjectRepository(JobResult)
    private readonly jobResultRepo: Repository<JobResult>,
    @InjectRepository(AIUsageLog)
    private readonly aiUsageLogRepo: Repository<AIUsageLog>,
    @InjectRepository(AppSetting)
    private readonly appSettingRepo: Repository<AppSetting>,
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
  ) {}

  async getDashboard(tenantId: string, dateFrom?: string, dateTo?: string) {
    const now = new Date();
    const today = new Date(now);
    today.setUTCHours(0, 0, 0, 0);

    let from = today;
    let to = now;

    if (dateFrom) {
      const parsed = new Date(dateFrom);
      if (!isNaN(parsed.getTime())) from = parsed;
    }
    if (dateTo) {
      const parsed = new Date(dateTo);
      if (!isNaN(parsed.getTime())) {
        parsed.setUTCHours(23, 59, 59, 0);
        to = parsed;
      }
    }

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      activeChannels,
      activeJobs,
      totalConversations,
      issuesToday,
      conversationsByChannel,
      qcAlerts,
      classificationRecent,
      costPeriodResult,
      costMonthResult,
      costByDay,
      messagesByDay,
      rateSetting,
    ] = await Promise.all([
      this.channelRepo.count({
        where: { tenant_id: tenantId, is_active: true },
      }),
      this.jobRepo.count({
        where: { tenant_id: tenantId, is_active: true },
      }),
      this.conversationRepo
        .createQueryBuilder('c')
        .where('c.tenant_id = :tenantId', { tenantId })
        .andWhere('c.last_message_at BETWEEN :from AND :to', { from, to })
        .getCount(),
      this.jobResultRepo
        .createQueryBuilder('jr')
        .where('jr.tenant_id = :tenantId', { tenantId })
        .andWhere('jr.created_at BETWEEN :from AND :to', { from, to })
        .getCount(),
      this.conversationRepo
        .createQueryBuilder('conv')
        .innerJoin('channels', 'ch', 'ch.id = conv.channel_id')
        .select('ch.channel_type', 'channel_type')
        .addSelect('COUNT(*)::int', 'count')
        .where('conv.tenant_id = :tenantId', { tenantId })
        .andWhere('conv.last_message_at BETWEEN :from AND :to', { from, to })
        .groupBy('ch.channel_type')
        .getRawMany(),
      this.jobResultRepo
        .createQueryBuilder('jr')
        .where('jr.tenant_id = :tenantId', { tenantId })
        .andWhere("jr.result_type = 'qc_violation'")
        .andWhere('jr.created_at BETWEEN :from AND :to', { from, to })
        .orderBy('jr.created_at', 'DESC')
        .limit(5)
        .getMany(),
      this.jobResultRepo
        .createQueryBuilder('jr')
        .leftJoin('conversations', 'conv', 'conv.id = jr.conversation_id')
        .select('jr.*')
        .addSelect('conv.customer_name', 'customer_name')
        .where('jr.tenant_id = :tenantId', { tenantId })
        .andWhere("jr.result_type = 'classification_tag'")
        .andWhere('jr.created_at BETWEEN :from AND :to', { from, to })
        .orderBy('jr.created_at', 'DESC')
        .limit(10)
        .getRawMany(),
      this.aiUsageLogRepo
        .createQueryBuilder('a')
        .select('COALESCE(SUM(a.cost_usd), 0)', 'total')
        .where('a.tenant_id = :tenantId', { tenantId })
        .andWhere('a.created_at BETWEEN :from AND :to', { from, to })
        .getRawOne(),
      this.aiUsageLogRepo
        .createQueryBuilder('a')
        .select('COALESCE(SUM(a.cost_usd), 0)', 'total')
        .where('a.tenant_id = :tenantId', { tenantId })
        .andWhere('a.created_at >= :monthStart', { monthStart })
        .getRawOne(),
      this.aiUsageLogRepo
        .createQueryBuilder('a')
        .select('DATE(a.created_at)', 'date')
        .addSelect('SUM(a.cost_usd)', 'total_cost')
        .addSelect('SUM(a.input_tokens)::int', 'input_tokens')
        .addSelect('SUM(a.output_tokens)::int', 'output_tokens')
        .addSelect('COUNT(*)::int', 'call_count')
        .where('a.tenant_id = :tenantId', { tenantId })
        .andWhere('a.created_at >= :thirtyDaysAgo', { thirtyDaysAgo })
        .groupBy('DATE(a.created_at)')
        .orderBy('date', 'DESC')
        .getRawMany(),
      this.messageRepo
        .createQueryBuilder('m')
        .select('DATE(m.sent_at)', 'date')
        .addSelect('COUNT(*)::int', 'count')
        .addSelect(
          "COUNT(DISTINCT CASE WHEN m.sender_type = 'customer' THEN m.conversation_id END)::int",
          'chat_count',
        )
        .addSelect(
          "SUM(CASE WHEN m.sender_type = 'agent' THEN 1 ELSE 0 END)::int",
          'reply_count',
        )
        .where('m.tenant_id = :tenantId', { tenantId })
        .andWhere('m.sent_at >= :thirtyDaysAgo', { thirtyDaysAgo })
        .groupBy('DATE(m.sent_at)')
        .orderBy('date', 'ASC')
        .getRawMany(),
      this.appSettingRepo.findOne({
        where: { tenant_id: tenantId, setting_key: 'exchange_rate_vnd' },
      }),
    ]);

    const costToday = parseFloat(costPeriodResult?.total || '0');
    const costThisMonth = parseFloat(costMonthResult?.total || '0');
    const exchangeRate = parseExchangeRate(rateSetting?.value_plain);

    return {
      total_conversations: totalConversations,
      active_channels: activeChannels,
      active_jobs: activeJobs,
      issues_today: issuesToday,
      conversations_by_channel: conversationsByChannel,
      qc_alerts: qcAlerts,
      classification_recent: classificationRecent,
      cost_today: costToday,
      cost_this_month: costThisMonth,
      cost_by_day: costByDay,
      messages_by_day: messagesByDay,
      exchange_rate: exchangeRate,
    };
  }

  async getOnboardingStatus(tenantId: string) {
    const [channelCount, convCount, jobCount, runCount, aiSetting, dismissSetting] = await Promise.all([
      this.channelRepo.count({ where: { tenant_id: tenantId } }),
      this.conversationRepo.count({ where: { tenant_id: tenantId } }),
      this.jobRepo.count({ where: { tenant_id: tenantId } }),
      this.jobRunRepo.count({ where: { tenant_id: tenantId } }),
      this.appSettingRepo.findOne({
        where: { tenant_id: tenantId, setting_key: 'ai_provider' },
      }),
      this.appSettingRepo.findOne({
        where: { tenant_id: tenantId, setting_key: 'onboarding_dismissed' },
      }),
    ]);

    const aiConfigured = !!(aiSetting?.value_plain);
    const dismissed = dismissSetting?.value_plain === 'true';

    return {
      dismissed,
      steps: [
        {
          key: 'channel',
          title: 'K\u1EBFt n\u1ED1i k\u00EAnh chat',
          done: channelCount > 0,
          link: 'channels',
        },
        {
          key: 'sync',
          title: '\u0110\u1ED3ng b\u1ED9 tin nh\u1EAFn',
          done: convCount > 0,
          link: 'messages',
        },
        {
          key: 'ai',
          title: 'C\u1EA5u h\u00ECnh AI Provider',
          done: aiConfigured,
          link: 'settings',
        },
        {
          key: 'job',
          title: 'T\u1EA1o c\u00F4ng vi\u1EC7c ph\u00E2n t\u00EDch',
          done: jobCount > 0,
          link: 'jobs/create',
        },
        {
          key: 'run',
          title: 'Ch\u1EA1y th\u1EED ph\u00E2n t\u00EDch',
          done: runCount > 0,
          link: 'jobs',
        },
      ],
    };
  }
}
