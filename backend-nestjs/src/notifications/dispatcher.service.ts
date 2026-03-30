import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Job } from '../entities/job.entity';
import { JobRun } from '../entities/job-run.entity';
import { JobResult } from '../entities/job-result.entity';
import { AppSetting } from '../entities/app-setting.entity';
import { NotificationLog } from '../entities/notification-log.entity';
import { newUUID } from '../common/helpers';
import { Notifier, TelegramNotifier, EmailNotifier } from './notifiers';

export interface OutputConfig {
  type: string; // "telegram" | "email"
  bot_token?: string;
  chat_id?: string;
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  smtp_pass?: string;
  from?: string;
  to?: string;
  template?: string; // "default" | "custom"
  custom_template?: string;
}

@Injectable()
export class DispatcherService {
  private readonly logger = new Logger(DispatcherService.name);

  constructor(
    @InjectRepository(JobResult)
    private readonly jobResultRepo: Repository<JobResult>,
    @InjectRepository(AppSetting)
    private readonly appSettingRepo: Repository<AppSetting>,
    @InjectRepository(NotificationLog)
    private readonly notificationLogRepo: Repository<NotificationLog>,
    private readonly configService: ConfigService,
  ) {}

  async sendJobResults(job: Job, run: JobRun): Promise<void> {
    const outputs = this.parseOutputs(job.outputs);
    if (!outputs || outputs.length === 0) {
      return;
    }

    // Get unnotified results for this run
    const results = await this.jobResultRepo.find({
      where: { job_run_id: run.id, notified_at: IsNull() },
    });

    if (results.length === 0) {
      return;
    }

    // Extract stats from run summary
    const summary = this.parseSummary(run.summary);
    const total = this.getFloat(summary, 'conversations_analyzed');
    const passed = this.getFloat(summary, 'conversations_passed');
    const failed = total - passed;
    const issues = this.getFloat(summary, 'issues_found');

    const subject = `[CQA] ${job.name} - ${issues} issues found`;

    for (const output of outputs) {
      try {
        const notifier = this.createNotifier(output);
        if (!notifier) {
          this.logger.warn(`Unsupported output type: ${output.type}`);
          continue;
        }

        const defaultBody = this.buildNotificationBody(job, results);
        let body = defaultBody;

        const link = `${await this.getBaseURL(job.tenant_id)}/${job.tenant_id}/jobs/${job.id}`;

        if (output.template === 'custom' && output.custom_template) {
          body = this.renderCustomTemplate(
            output.custom_template,
            job.name,
            total,
            passed,
            failed,
            issues,
            defaultBody,
            link,
          );
        }

        let status = 'sent';
        let errMsg = '';

        try {
          await notifier.send(subject, body);
        } catch (sendErr) {
          status = 'failed';
          errMsg = sendErr instanceof Error ? sendErr.message : String(sendErr);
          this.logger.error(`Send failed for ${output.type}: ${errMsg}`);
        }

        // Log notification
        const recipient = output.type === 'email' ? (output.to || '') : (output.chat_id || '');
        const logEntry: NotificationLog = {
          id: newUUID(),
          tenant_id: job.tenant_id,
          job_id: job.id,
          job_run_id: run.id,
          channel_type: output.type,
          recipient,
          subject,
          body,
          status,
          error_message: errMsg,
          sent_at: new Date(),
          created_at: new Date(),
        };
        await this.notificationLogRepo.save(logEntry);
      } catch (err) {
        this.logger.error(
          `Create notifier failed for ${output.type}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    // Mark results as notified
    await this.jobResultRepo.update(
      { job_run_id: run.id, notified_at: IsNull() },
      { notified_at: new Date() },
    );
  }

  parseOutputs(outputsRaw: string): OutputConfig[] {
    if (!outputsRaw) return [];

    try {
      const parsed = JSON.parse(outputsRaw);
      if (Array.isArray(parsed)) return parsed;

      // Handle double-encoded JSON string
      if (typeof parsed === 'string') {
        const inner = JSON.parse(parsed);
        if (Array.isArray(inner)) return inner;
      }
    } catch {
      // ignore malformed JSON
    }

    return [];
  }

  private parseSummary(summaryRaw: string): Record<string, unknown> {
    if (!summaryRaw) return {};
    try {
      return JSON.parse(summaryRaw);
    } catch {
      return {};
    }
  }

  private getFloat(m: Record<string, unknown>, key: string): number {
    if (!m) return 0;
    const v = m[key];
    if (typeof v === 'number') return v;
    return 0;
  }

  createNotifier(cfg: OutputConfig): Notifier | null {
    switch (cfg.type) {
      case 'telegram':
        return new TelegramNotifier(cfg.bot_token || '', cfg.chat_id || '');
      case 'email':
        return new EmailNotifier(
          cfg.smtp_host || '',
          cfg.smtp_port || 587,
          cfg.smtp_user || '',
          cfg.smtp_pass || '',
          cfg.from || '',
          this.splitComma(cfg.to || ''),
        );
      default:
        return null;
    }
  }

  buildNotificationBody(job: Job, results: JobResult[]): string {
    let body = `<b>K\u1EBFt qu\u1EA3 ph\u00E2n t\u00EDch: ${job.name}</b>\n\n`;

    for (let i = 0; i < results.length; i++) {
      if (i >= 10) {
        body += `\n... v\u00E0 ${results.length - 10} v\u1EA5n \u0111\u1EC1 kh\u00E1c\n`;
        break;
      }
      const r = results[i];
      if (r.result_type === 'qc_violation') {
        const emoji = r.severity === 'NGHIEM_TRONG' ? '\uD83D\uDD34' : '\u26A0\uFE0F';
        body += `${emoji} <b>${r.severity}</b> \u2014 ${r.rule_name}\n\uD83D\uDCCC ${r.evidence}\n\n`;
      } else if (r.result_type === 'classification_tag') {
        body += `\uD83C\uDFF7 <b>${r.rule_name}</b> (${Math.round((r.confidence || 0) * 100)}%)\n\uD83D\uDCCC ${r.evidence}\n\n`;
      }
    }

    return body;
  }

  renderCustomTemplate(
    tmpl: string,
    jobName: string,
    total: number,
    passed: number,
    failed: number,
    issues: number,
    content: string,
    link: string,
  ): string {
    let result = tmpl;
    const replacements: Record<string, string> = {
      '{{job_name}}': jobName,
      '{{total}}': String(total),
      '{{passed}}': String(passed),
      '{{failed}}': String(failed),
      '{{issues}}': String(issues),
      '{{content}}': content,
      '{{link}}': link,
    };

    for (const [key, value] of Object.entries(replacements)) {
      result = result.split(key).join(value);
    }

    return result;
  }

  private async getBaseURL(tenantID: string): Promise<string> {
    // Priority 1: tenant setting from DB
    try {
      const setting = await this.appSettingRepo.findOne({
        where: { tenant_id: tenantID, setting_key: 'app_url' },
      });
      if (setting?.value_plain) {
        return setting.value_plain;
      }
    } catch {
      // ignore
    }

    // Priority 2: environment variable
    const appUrl = this.configService.get<string>('APP_URL');
    if (appUrl) return appUrl;

    // Priority 3: fallback
    return 'http://localhost:8080';
  }

  private splitComma(s: string): string[] {
    return s
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  }
}
