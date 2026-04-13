import {
  Injectable,
  Inject,
  Optional,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Workbook } from 'exceljs';
import { Job } from '../entities/job.entity';
import { JobRun } from '../entities/job-run.entity';
import { JobResult } from '../entities/job-result.entity';
import { AIUsageLog } from '../entities/ai-usage-log.entity';
import { NotificationLog } from '../entities/notification-log.entity';
import { Message } from '../entities/message.entity';
import { newUUID } from '../common/helpers/uuid.helper';
import { formatVNDateTime } from '../common/helpers/timezone.helper';
import {
  ISchedulerSignal,
  SCHEDULER_SIGNAL,
} from '../common/interfaces/scheduler.interface';
import { CreateJobDto } from './dto/create-job.dto';

const ALLOWED_JOB_UPDATE_FIELDS = new Set([
  'name',
  'description',
  'type',
  'status',
  'input_channel_ids',
  'outputs',
  'rules_config',
  'rules_content',
  'skip_conditions',
  'ai_provider',
  'ai_model',
  'ai_system_prompt',
  'schedule_type',
  'schedule_cron',
  'schedule_enabled',
  'date_from',
  'date_to',
  'max_conversations',
]);

const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export interface JobResultWithConvDate {
  id: string;
  job_run_id: string;
  tenant_id: string;
  conversation_id: string;
  result_type: string;
  severity: string;
  rule_name: string;
  evidence: string;
  detail: any;
  ai_raw_response: string;
  confidence: number;
  notified_at: Date | null;
  created_at: Date;
  conversation_date: Date | null;
  customer_name: string;
}

/** Escape a value for CSV (RFC 4180). */
function escapeCsvField(s: string): string {
  return '"' + (s || '').replace(/"/g, '""') + '"';
}

/** Build a CSV string from headers and row arrays. */
function buildCsv(headers: string[], rows: string[][]): string {
  let csv = '\uFEFF'; // UTF-8 BOM
  csv += headers.join(',') + '\n';
  for (const row of rows) {
    csv += row.map(escapeCsvField).join(',') + '\n';
  }
  return csv;
}

/** Build an XLSX buffer from headers and row arrays. */
async function buildXlsx(
  sheetName: string,
  headers: string[],
  rows: string[][],
): Promise<Buffer> {
  const wb = new Workbook();
  const ws = wb.addWorksheet(sheetName);
  ws.addRow(headers);
  for (const row of rows) {
    ws.addRow(row);
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);
  private readonly runningJobs = new Map<string, AbortController>();

  constructor(
    @InjectRepository(Job)
    private readonly jobRepo: Repository<Job>,
    @InjectRepository(JobRun)
    private readonly jobRunRepo: Repository<JobRun>,
    @InjectRepository(JobResult)
    private readonly jobResultRepo: Repository<JobResult>,
    @InjectRepository(AIUsageLog)
    private readonly aiUsageLogRepo: Repository<AIUsageLog>,
    @InjectRepository(NotificationLog)
    private readonly notificationLogRepo: Repository<NotificationLog>,
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    @Optional()
    @Inject(SCHEDULER_SIGNAL)
    private readonly schedulerSignal?: ISchedulerSignal,
  ) {}

  async listJobs(tenantId: string): Promise<Job[]> {
    return this.jobRepo.find({
      where: { tenant_id: tenantId },
      order: { created_at: 'DESC' },
    });
  }

  async createJob(tenantId: string, dto: CreateJobDto): Promise<Job> {
    const now = new Date();
    const job = this.jobRepo.create({
      id: newUUID(),
      tenant_id: tenantId,
      name: dto.name,
      description: dto.description || '',
      job_type: dto.job_type,
      input_channel_ids: dto.input_channel_ids,
      rules_content: dto.rules_content || '',
      rules_config: dto.rules_config || {},
      skip_conditions: dto.skip_conditions || '',
      ai_provider: dto.ai_provider || 'claude',
      ai_model: dto.ai_model || '',
      outputs: dto.outputs,
      output_schedule: dto.output_schedule,
      output_cron: dto.output_cron || '',
      output_at: dto.output_at ? new Date(dto.output_at) : null,
      schedule_type: dto.schedule_type,
      schedule_cron: dto.schedule_cron || '',
      is_active: true,
      created_at: now,
      updated_at: now,
    });

    const saved = await this.jobRepo.save(job);

    if (saved.schedule_type === 'cron') {
      this.schedulerSignal?.reloadJobs();
    }

    return saved;
  }

  async getJob(tenantId: string, jobId: string): Promise<Job> {
    const job = await this.jobRepo.findOne({
      where: { id: jobId, tenant_id: tenantId },
    });
    if (!job) {
      throw new NotFoundException({ error: 'job_not_found' });
    }
    return job;
  }

  async updateJob(
    tenantId: string,
    jobId: string,
    raw: Record<string, any>,
  ): Promise<{ message: string }> {
    // Filter to allowed fields only -- prevents mass assignment of tenant_id, id, etc.
    const updates: Record<string, any> = {};
    for (const key of Object.keys(raw)) {
      if (ALLOWED_JOB_UPDATE_FIELDS.has(key)) {
        updates[key] = raw[key];
      }
    }

    updates['updated_at'] = new Date();

    const result = await this.jobRepo
      .createQueryBuilder()
      .update(Job)
      .set(updates)
      .where('id = :jobId AND tenant_id = :tenantId', { jobId, tenantId })
      .execute();

    if (result.affected === 0) {
      throw new NotFoundException({ error: 'job_not_found' });
    }

    if (updates['schedule_type'] !== undefined || updates['schedule_cron'] !== undefined) {
      this.schedulerSignal?.reloadJobs();
    }

    return { message: 'updated' };
  }

  async deleteJob(tenantId: string, jobId: string): Promise<{ message: string }> {
    const job = await this.jobRepo.findOne({
      where: { id: jobId, tenant_id: tenantId },
    });
    if (!job) {
      throw new NotFoundException({ error: 'job_not_found' });
    }

    // Cascade delete: results -> runs -> usage logs -> notification logs -> job
    const runIds = await this.getRunIds(jobId, tenantId);
    if (runIds.length > 0) {
      await this.jobResultRepo.delete({
        job_run_id: In(runIds),
        tenant_id: tenantId,
      });
    }
    await this.jobRunRepo.delete({ job_id: jobId, tenant_id: tenantId });
    await this.aiUsageLogRepo.delete({ job_id: jobId, tenant_id: tenantId });
    await this.notificationLogRepo.delete({ job_id: jobId, tenant_id: tenantId });
    await this.jobRepo.delete({ id: jobId, tenant_id: tenantId });

    if (job.schedule_type === 'cron') {
      this.schedulerSignal?.reloadJobs();
    }

    return { message: 'deleted' };
  }

  async triggerJob(
    tenantId: string,
    jobId: string,
    mode: string,
    params: { limit?: number; dateFrom?: string; dateTo?: string },
  ): Promise<{ message: string }> {
    const job = await this.jobRepo.findOne({
      where: { id: jobId, tenant_id: tenantId },
    });
    if (!job) {
      throw new NotFoundException({ error: 'job_not_found' });
    }

    const abortController = new AbortController();
    this.runningJobs.set(job.id, abortController);

    // Fire-and-forget -- the actual analysis engine would be injected here
    setImmediate(async () => {
      try {
        this.logger.log(
          `[trigger] job=${job.name} mode=${mode} limit=${params.limit ?? 'none'}`,
        );
      } catch (err) {
        this.logger.error(`[trigger] error for job ${job.name}: ${err}`);
      } finally {
        this.runningJobs.delete(job.id);
      }
    });

    return { message: 'job_triggered' };
  }

  async testRunJob(
    tenantId: string,
    jobId: string,
  ): Promise<{ message: string }> {
    const job = await this.jobRepo.findOne({
      where: { id: jobId, tenant_id: tenantId },
    });
    if (!job) {
      throw new NotFoundException({ error: 'job_not_found' });
    }

    const abortController = new AbortController();
    this.runningJobs.set(job.id, abortController);

    setImmediate(async () => {
      try {
        this.logger.log(`[test-run] job=${job.name} limit=3`);
      } catch (err) {
        this.logger.error(`[test-run] error for job ${job.name}: ${err}`);
      } finally {
        this.runningJobs.delete(job.id);
      }
    });

    return { message: 'test_run_started' };
  }

  async cancelJob(
    tenantId: string,
    jobId: string,
  ): Promise<{ message: string }> {
    const job = await this.jobRepo.findOne({
      where: { id: jobId, tenant_id: tenantId },
    });
    if (!job) {
      throw new NotFoundException({ error: 'job_not_found' });
    }

    const controller = this.runningJobs.get(job.id);
    if (controller) {
      controller.abort();
      this.runningJobs.delete(job.id);
    }

    await this.jobRunRepo
      .createQueryBuilder()
      .update(JobRun)
      .set({
        status: 'cancelled',
        finished_at: new Date(),
        error_message: 'Cancelled by user',
      })
      .where('job_id = :jobId AND status = :status', {
        jobId: job.id,
        status: 'running',
      })
      .execute();

    return { message: 'job_cancelled' };
  }

  async listJobRuns(
    tenantId: string,
    jobId: string,
    _page?: number,
    _perPage?: number,
  ): Promise<JobRun[]> {
    return this.jobRunRepo.find({
      where: { job_id: jobId, tenant_id: tenantId },
      order: { started_at: 'DESC' },
      take: 50,
    });
  }

  async listRunResults(
    tenantId: string,
    _jobId: string,
    runId: string,
    _page?: number,
    _perPage?: number,
  ): Promise<JobResult[]> {
    return this.jobResultRepo.find({
      where: { job_run_id: runId, tenant_id: tenantId },
      order: { created_at: 'DESC' },
    });
  }

  async listAllResults(
    tenantId: string,
    jobId: string,
    _query?: Record<string, any>,
  ): Promise<JobResultWithConvDate[]> {
    const runIds = await this.getRunIds(jobId, tenantId);
    if (runIds.length === 0) {
      return [];
    }
    return this.getResultsWithConvDate(runIds, tenantId);
  }

  async exportResults(
    tenantId: string,
    jobId: string,
    format: string,
  ): Promise<{ contentType: string; filename: string; data: Buffer | string }> {
    const runIds = await this.getRunIds(jobId, tenantId);

    const results =
      runIds.length > 0
        ? await this.getResultsWithConvDate(runIds, tenantId)
        : [];

    const job = await this.jobRepo.findOne({
      where: { id: jobId, tenant_id: tenantId },
      select: ['job_type'],
    });
    const jobType = job?.job_type || 'qc_analysis';

    if (jobType === 'classification') {
      return this.exportClassification(tenantId, results, format);
    }
    return this.exportQC(results, format);
  }

  async clearResults(
    tenantId: string,
    jobId: string,
  ): Promise<{ message: string }> {
    const job = await this.jobRepo.findOne({
      where: { id: jobId, tenant_id: tenantId },
    });
    if (!job) {
      throw new NotFoundException({ error: 'job_not_found' });
    }

    const runIds = await this.getRunIds(jobId, tenantId);
    if (runIds.length > 0) {
      await this.jobResultRepo.delete({
        job_run_id: In(runIds),
        tenant_id: tenantId,
      });
    }
    await this.aiUsageLogRepo.delete({ job_id: jobId, tenant_id: tenantId });
    await this.notificationLogRepo.delete({ job_id: jobId, tenant_id: tenantId });

    return { message: 'cleared' };
  }

  async clearRuns(
    tenantId: string,
    jobId: string,
  ): Promise<{ message: string }> {
    const job = await this.jobRepo.findOne({
      where: { id: jobId, tenant_id: tenantId },
    });
    if (!job) {
      throw new NotFoundException({ error: 'job_not_found' });
    }

    const runIds = await this.getRunIds(jobId, tenantId);
    if (runIds.length > 0) {
      await this.jobResultRepo.delete({
        job_run_id: In(runIds),
        tenant_id: tenantId,
      });
    }
    await this.jobRunRepo.delete({ job_id: jobId, tenant_id: tenantId });
    await this.aiUsageLogRepo.delete({ job_id: jobId, tenant_id: tenantId });
    await this.notificationLogRepo.delete({ job_id: jobId, tenant_id: tenantId });

    await this.jobRepo
      .createQueryBuilder()
      .update(Job)
      .set({
        last_run_at: null,
        last_run_status: '',
        updated_at: new Date(),
      })
      .where('id = :jobId AND tenant_id = :tenantId', { jobId, tenantId })
      .execute();

    return { message: 'cleared' };
  }

  async testOutput(
    _tenantId: string,
    dto: { type: string; bot_token?: string; chat_id?: string },
  ): Promise<{ status: string; message: string }> {
    if (dto.type === 'telegram') {
      if (!dto.bot_token || !dto.chat_id) {
        throw new BadRequestException({
          error: 'bot_token and chat_id are required',
        });
      }

      const url = `https://api.telegram.org/bot${dto.bot_token}/sendMessage`;
      const body = {
        chat_id: dto.chat_id,
        text: 'CQA - Test\n\nDay la tin nhan thu nghiem tu Chat Quality Agent.\nKet noi Telegram thanh cong!',
        parse_mode: 'HTML',
      };

      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!resp.ok) {
          const text = await resp.text();
          throw new BadRequestException({ error: text });
        }
      } catch (err) {
        if (err instanceof BadRequestException) throw err;
        throw new BadRequestException({ error: String(err) });
      }

      return { status: 'ok', message: 'Telegram message sent' };
    }

    throw new BadRequestException({ error: 'unsupported output type' });
  }

  // ─── Private helpers ──────────────────────────────────────────────────

  private async getRunIds(jobId: string, tenantId: string): Promise<string[]> {
    const runs = await this.jobRunRepo.find({
      where: { job_id: jobId, tenant_id: tenantId },
      select: ['id'],
    });
    return runs.map((r) => r.id);
  }

  /** Shared query: results joined with conversation date and customer name. */
  private async getResultsWithConvDate(
    runIds: string[],
    tenantId: string,
  ): Promise<JobResultWithConvDate[]> {
    return this.jobResultRepo
      .createQueryBuilder('jr')
      .select('jr.*')
      .addSelect(
        `(SELECT MIN(m.sent_at) FROM messages m WHERE m.conversation_id = jr.conversation_id)`,
        'conversation_date',
      )
      .addSelect('c.customer_name', 'customer_name')
      .leftJoin('conversations', 'c', 'c.id = jr.conversation_id')
      .where('jr.job_run_id IN (:...runIds)', { runIds })
      .andWhere('jr.tenant_id = :tenantId', { tenantId })
      .orderBy('jr.created_at', 'DESC')
      .getRawMany();
  }

  private buildExportRows(
    results: JobResultWithConvDate[],
  ): {
    customerName: string;
    conversationDate: string;
    evalDate: string;
    review: string;
    verdict: string;
    score: string;
    issues: string;
  }[] {
    interface ConvGroup {
      customerName: string;
      conversationDate: string;
      evalDate: string;
      review: string;
      verdict: string;
      score: string;
      violations: string[];
    }

    const groups: Record<string, ConvGroup> = {};
    const order: string[] = [];

    for (const r of results) {
      const cid = r.conversation_id;
      if (!groups[cid]) {
        const convDate = r.conversation_date
          ? formatVNDateTime(new Date(r.conversation_date))
          : '';
        groups[cid] = {
          customerName: r.customer_name || '',
          conversationDate: convDate,
          evalDate: '',
          review: '',
          verdict: '',
          score: '',
          violations: [],
        };
        order.push(cid);
      }
      const g = groups[cid];

      if (r.result_type === 'conversation_evaluation') {
        if (r.severity === 'PASS') {
          g.verdict = 'Dat';
        } else if (r.severity === 'SKIP') {
          g.verdict = 'Bo qua';
        } else {
          g.verdict = 'Khong dat';
        }
        g.review = r.evidence || '';
        g.evalDate = formatVNDateTime(new Date(r.created_at));
        try {
          const detail =
            typeof r.detail === 'string' ? JSON.parse(r.detail) : r.detail;
          if (detail?.score !== undefined) {
            g.score = String(detail.score);
          }
        } catch {
          // ignore parse errors
        }
      } else {
        let issue = r.rule_name || '';
        if (r.evidence) {
          issue += ': ' + r.evidence;
        }
        g.violations.push(issue);
      }
    }

    return order.map((cid) => {
      const g = groups[cid];
      return {
        customerName: g.customerName,
        conversationDate: g.conversationDate,
        evalDate: g.evalDate,
        review: g.review,
        verdict: g.verdict,
        score: g.score,
        issues: g.violations.join('; '),
      };
    });
  }

  private async exportQC(
    results: JobResultWithConvDate[],
    format: string,
  ): Promise<{ contentType: string; filename: string; data: Buffer | string }> {
    const rows = this.buildExportRows(results);
    const headers = [
      'Ten',
      'Ngay phat sinh chat',
      'Ngay danh gia',
      'Ket qua danh gia chi tiet',
      'Danh gia',
      'Diem',
      'Van de',
    ];
    const dataRows = rows.map((r) => [
      r.customerName,
      r.conversationDate,
      r.evalDate,
      r.review,
      r.verdict,
      r.score,
      r.issues,
    ]);

    if (format === 'xlsx') {
      return {
        contentType: XLSX_CONTENT_TYPE,
        filename: 'results.xlsx',
        data: await buildXlsx('Results', headers, dataRows),
      };
    }

    return {
      contentType: 'text/csv; charset=utf-8',
      filename: 'results.csv',
      data: buildCsv(headers, dataRows),
    };
  }

  private async exportClassification(
    tenantId: string,
    results: JobResultWithConvDate[],
    format: string,
  ): Promise<{ contentType: string; filename: string; data: Buffer | string }> {
    interface ConvGroup {
      customerName: string;
      conversationDate: string;
      evalDate: string;
      tags: string[];
      issues: string[];
    }

    const groups: Record<string, ConvGroup> = {};
    const order: string[] = [];

    for (const r of results) {
      const cid = r.conversation_id;
      if (!groups[cid]) {
        const convDate = r.conversation_date
          ? formatVNDateTime(new Date(r.conversation_date))
          : '';
        groups[cid] = {
          customerName: r.customer_name || '',
          conversationDate: convDate,
          evalDate: '',
          tags: [],
          issues: [],
        };
        order.push(cid);
      }
      const g = groups[cid];
      if (r.result_type === 'conversation_evaluation') {
        g.evalDate = formatVNDateTime(new Date(r.created_at));
      } else if (r.result_type === 'classification_tag') {
        g.tags.push(r.rule_name || '');
        if (r.evidence) {
          g.issues.push(r.evidence);
        }
      }
    }

    // Batch-fetch chat messages for all conversations at once (avoids N+1)
    const chatMap: Record<string, string> = {};
    if (order.length > 0) {
      const allMessages = await this.messageRepo.find({
        where: { conversation_id: In(order), tenant_id: tenantId },
        order: { conversation_id: 'ASC', sent_at: 'ASC' },
      });
      for (const m of allMessages) {
        if (!m.content) continue;
        const name = m.sender_name || m.sender_type;
        const line = `[${name}] ${m.content}`;
        chatMap[m.conversation_id] = chatMap[m.conversation_id]
          ? chatMap[m.conversation_id] + '\n' + line
          : line;
      }
    }

    const headers = [
      'Ten',
      'Ngay phat sinh chat',
      'Ngay danh gia',
      'Loai',
      'Van de',
      'Noi dung chat',
    ];
    const dataRows = order.map((cid) => {
      const g = groups[cid];
      return [
        g.customerName,
        g.conversationDate,
        g.evalDate,
        g.tags.join('\n'),
        g.issues.join('\n'),
        chatMap[cid] || '',
      ];
    });

    if (format === 'xlsx') {
      return {
        contentType: XLSX_CONTENT_TYPE,
        filename: 'classification.xlsx',
        data: await buildXlsx('Results', headers, dataRows),
      };
    }

    return {
      contentType: 'text/csv; charset=utf-8',
      filename: 'classification.csv',
      data: buildCsv(headers, dataRows),
    };
  }
}
