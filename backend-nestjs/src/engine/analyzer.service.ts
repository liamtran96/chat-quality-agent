import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, SelectQueryBuilder } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { CryptoService } from '../common/crypto/crypto.service';
import { newUUID } from '../common/helpers/uuid.helper';
import { formatTimeVN } from '../common/helpers/timezone.helper';
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
  ChatMessage,
  formatChatTranscript,
  buildQCPrompt,
  buildClassificationPrompt,
  calculateCostUSD,
  stripMarkdownFences,
} from './ai-provider.interface';

interface RunJobOptions {
  maxConversations: number;
  injectedProvider: AIProvider | null;
  fullRerun: boolean;
  dateFrom: string;
  dateTo: string;
  sinceOverride: Date | null;
  excludeAnalyzed: boolean;
}

const DEFAULT_OPTS: RunJobOptions = {
  maxConversations: 0,
  injectedProvider: null,
  fullRerun: false,
  dateFrom: '',
  dateTo: '',
  sinceOverride: null,
  excludeAnalyzed: false,
};

/** Helper: sleep for ms, respecting AbortSignal. */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

@Injectable()
export class AnalyzerService {
  private readonly logger = new Logger(AnalyzerService.name);

  constructor(
    @InjectRepository(Job)
    private readonly jobRepo: Repository<Job>,
    @InjectRepository(JobRun)
    private readonly jobRunRepo: Repository<JobRun>,
    @InjectRepository(JobResult)
    private readonly jobResultRepo: Repository<JobResult>,
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    @InjectRepository(AppSetting)
    private readonly appSettingRepo: Repository<AppSetting>,
    @InjectRepository(AIUsageLog)
    private readonly aiUsageLogRepo: Repository<AIUsageLog>,
    @InjectRepository(ActivityLog)
    private readonly activityLogRepo: Repository<ActivityLog>,
    private readonly cryptoService: CryptoService,
    private readonly configService: ConfigService,
  ) {}

  /** RunJob: incremental analysis since last run (or last 24h). */
  async runJob(job: Job, signal?: AbortSignal): Promise<JobRun> {
    return this.runJobInternalExt(job, { ...DEFAULT_OPTS }, signal);
  }

  /** RunJobFull: re-analyze ALL conversations. */
  async runJobFull(job: Job, signal?: AbortSignal): Promise<JobRun> {
    return this.runJobInternalExt(
      job,
      { ...DEFAULT_OPTS, fullRerun: true },
      signal,
    );
  }

  /** RunJobFullWithParams: full with date range and limit. */
  async runJobFullWithParams(
    job: Job,
    dateFrom: string,
    dateTo: string,
    limit: number,
    signal?: AbortSignal,
  ): Promise<JobRun> {
    return this.runJobInternalExt(
      job,
      { ...DEFAULT_OPTS, maxConversations: limit, fullRerun: true, dateFrom, dateTo },
      signal,
    );
  }

  /** RunJobUnanalyzed: only conversations never evaluated by this job. */
  async runJobUnanalyzed(
    job: Job,
    maxConv: number,
    signal?: AbortSignal,
  ): Promise<JobRun> {
    return this.runJobInternalExt(
      job,
      { ...DEFAULT_OPTS, maxConversations: maxConv, fullRerun: true, excludeAnalyzed: true },
      signal,
    );
  }

  /** RunJobSinceLast: conversations newer than max analyzed. */
  async runJobSinceLast(
    job: Job,
    maxConv: number,
    signal?: AbortSignal,
  ): Promise<JobRun> {
    // Find max last_message_at among conversations already evaluated by this job
    const result = await this.jobResultRepo
      .createQueryBuilder('jr')
      .select('MAX(c.last_message_at)', 'max_msg_at')
      .innerJoin('job_runs', 'run', 'run.id = jr.job_run_id')
      .innerJoin('conversations', 'c', 'c.id = jr.conversation_id')
      .where('run.job_id = :jobId', { jobId: job.id })
      .getRawOne();

    const maxMsgAt = result?.max_msg_at
      ? new Date(result.max_msg_at)
      : null;

    if (!maxMsgAt) {
      // No previous results -- fall back to regular incremental
      return this.runJobInternalExt(
        job,
        { ...DEFAULT_OPTS, maxConversations: maxConv },
        signal,
      );
    }

    return this.runJobInternalExt(
      job,
      { ...DEFAULT_OPTS, maxConversations: maxConv, sinceOverride: maxMsgAt },
      signal,
    );
  }

  /** RunJobWithLimit: test run with limit (excludes previously analyzed). */
  async runJobWithLimit(
    job: Job,
    limit: number,
    signal?: AbortSignal,
  ): Promise<JobRun> {
    return this.runJobInternalExt(
      job,
      { ...DEFAULT_OPTS, maxConversations: limit },
      signal,
    );
  }

  /** RunJobWithProvider: inject mock provider for testing. */
  async runJobWithProvider(
    job: Job,
    limit: number,
    provider: AIProvider,
    signal?: AbortSignal,
  ): Promise<JobRun> {
    return this.runJobInternalExt(
      job,
      { ...DEFAULT_OPTS, maxConversations: limit, injectedProvider: provider },
      signal,
    );
  }

  /**
   * Core analysis logic: create run, fetch conversations, call AI, save results.
   */
  private async runJobInternalExt(
    job: Job,
    opts: RunJobOptions,
    signal?: AbortSignal,
  ): Promise<JobRun> {
    const now = new Date();
    const run: JobRun = this.jobRunRepo.create({
      id: newUUID(),
      job_id: job.id,
      tenant_id: job.tenant_id,
      started_at: now,
      status: 'running',
      summary: '{}',
      created_at: now,
    });
    await this.jobRunRepo.save(run);

    // Log run started
    await this.logActivity({
      tenantId: job.tenant_id,
      action: 'job.run.started',
      resourceType: 'job',
      resourceId: job.id,
      detail: `Job '${job.name}': started analysis (max=${opts.maxConversations}, full=${opts.fullRerun})`,
    });

    // Get AI provider
    let provider: AIProvider;
    if (opts.injectedProvider) {
      provider = opts.injectedProvider;
    } else {
      try {
        provider = await this.getProvider(job);
      } catch (err) {
        return this.failRun(run, err as Error);
      }
    }

    // Parse input channel IDs
    let channelIDs: string[];
    try {
      channelIDs = JSON.parse(job.input_channel_ids);
    } catch {
      return this.failRun(
        run,
        new Error(`invalid input_channel_ids: ${job.input_channel_ids}`),
      );
    }

    // Determine time range
    const isTestRun = opts.maxConversations > 0;
    let excludeAnalyzed = opts.excludeAnalyzed;
    if (isTestRun) {
      excludeAnalyzed = true;
    }

    let since: Date | null = null;
    if (opts.sinceOverride) {
      since = opts.sinceOverride;
    } else if (opts.dateFrom) {
      const parsed = new Date(opts.dateFrom);
      if (!isNaN(parsed.getTime())) {
        since = parsed;
      }
    }

    if (!since && !opts.sinceOverride) {
      if (opts.fullRerun) {
        since = null; // epoch -- get ALL conversations
      } else if (isTestRun) {
        since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      } else {
        since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        if (job.last_run_at) {
          since = new Date(job.last_run_at);
        }
      }
    }

    // Fetch conversations with messages in time range
    let qb: SelectQueryBuilder<Conversation> = this.conversationRepo
      .createQueryBuilder('c')
      .where('c.tenant_id = :tenantId', { tenantId: job.tenant_id })
      .andWhere('c.channel_id IN (:...channelIDs)', { channelIDs });

    if (since) {
      qb = qb.andWhere('c.last_message_at > :since', { since });
    }

    if (opts.dateTo) {
      const parsed = new Date(opts.dateTo);
      if (!isNaN(parsed.getTime())) {
        const dateToEnd = new Date(parsed.getTime() + 24 * 60 * 60 * 1000);
        qb = qb.andWhere('c.last_message_at < :dateTo', {
          dateTo: dateToEnd,
        });
      }
    }

    if (excludeAnalyzed) {
      // Only include conversations not yet evaluated by this job
      const analyzedSubq = this.jobResultRepo
        .createQueryBuilder('jr')
        .select('jr.conversation_id')
        .innerJoin('job_runs', 'run', 'run.id = jr.job_run_id')
        .where('run.job_id = :jobId', { jobId: job.id });

      qb = qb.andWhere(
        `c.id NOT IN (${analyzedSubq.getQuery()})`,
      );
      qb.setParameters(analyzedSubq.getParameters());
    }

    if (opts.maxConversations > 0) {
      qb = qb.limit(opts.maxConversations);
    }

    let conversations: Conversation[];
    try {
      conversations = await qb.getMany();
    } catch (err) {
      return this.failRun(
        run,
        new Error(`fetch conversations: ${(err as Error).message}`),
      );
    }

    this.logger.log(
      `job ${job.name}: channelIDs=${channelIDs}, sinceNull=${since === null}, excludeAnalyzed=${excludeAnalyzed}, fullRerun=${opts.fullRerun}, found ${conversations.length} conversations`,
    );

    // Set initial total so frontend can show progress immediately
    const initialSummary = JSON.stringify({
      conversations_found: conversations.length,
    });
    await this.jobRunRepo.update(run.id, { summary: initialSummary });

    // Batch-fetch batch settings in one query
    let batchMode = true;
    let batchSize = 5;

    const batchSettings = await this.appSettingRepo.find({
      where: {
        tenant_id: job.tenant_id,
        setting_key: In(['ai_batch_mode', 'ai_batch_size']),
      },
    });
    const batchSettingMap = new Map(batchSettings.map((s) => [s.setting_key, s]));

    const batchModeSetting = batchSettingMap.get('ai_batch_mode');
    if (batchModeSetting) {
      batchMode = batchModeSetting.value_plain !== 'false';
    }

    const batchSizeSetting = batchSettingMap.get('ai_batch_size');
    if (batchSizeSetting) {
      const n = parseInt(batchSizeSetting.value_plain, 10);
      if (!isNaN(n) && n > 0 && n <= 30) {
        batchSize = n;
      }
    }

    let issuesFound = 0;
    let passCount = 0;
    let analyzedCount = 0;
    let errorCount = 0;

    if (batchMode) {
      const result = await this.runBatchMode(
        provider,
        job,
        run,
        conversations,
        since,
        batchSize,
        signal,
      );
      issuesFound = result.issuesFound;
      passCount = result.passCount;
      analyzedCount = result.analyzedCount;
      errorCount = result.errorCount;
    } else {
      // Single mode -- build prompt once (it's the same for every conversation)
      const systemPrompt = this.buildSystemPrompt(job);
      if (!systemPrompt) {
        return this.failRun(run, new Error(`unsupported job_type: ${job.job_type}`));
      }

      for (const conv of conversations) {
        // Check abort signal
        if (signal?.aborted) {
          this.logger.log(
            `job ${job.name}: cancelled, stopping after ${analyzedCount}/${conversations.length} conversations`,
          );
          break;
        }

        const messages = await this.fetchMessages(conv.id, since);
        if (messages.length === 0) {
          continue;
        }

        const transcript = formatChatTranscript(
          this.messagesToChatMessages(messages),
        );

        // Rate limit delay
        if (analyzedCount > 0) {
          try {
            await sleep(500, signal);
          } catch {
            break; // Aborted
          }
        }

        // Call AI
        let aiResp: AIResponse;
        try {
          aiResp = await provider.analyzeChat(signal, systemPrompt, transcript);
        } catch (err) {
          this.logger.warn(
            `AI error for conversation ${conv.id}: ${(err as Error).message}`,
          );
          errorCount++;
          // Update progress even on error
          await this.updateProgress(run.id, {
            conversations_found: conversations.length,
            conversations_analyzed: analyzedCount,
            conversations_passed: passCount,
            conversations_errors: errorCount,
            issues_found: issuesFound,
          });
          continue;
        }
        analyzedCount++;

        // Log AI usage + cost
        const cost = calculateCostUSD(
          aiResp.provider,
          aiResp.model,
          aiResp.inputTokens,
          aiResp.outputTokens,
        );
        await this.aiUsageLogRepo.save({
          id: newUUID(),
          tenant_id: job.tenant_id,
          job_id: job.id,
          job_run_id: run.id,
          provider: aiResp.provider,
          model: aiResp.model,
          input_tokens: aiResp.inputTokens,
          output_tokens: aiResp.outputTokens,
          cost_usd: cost,
          created_at: new Date(),
        });

        // Parse and save results
        const { count, passed } = await this.saveResults(
          run.id,
          job.tenant_id,
          conv.id,
          job.job_type,
          aiResp.content,
        );
        issuesFound += count;
        if (passed) {
          passCount++;
        }

        // Update progress
        await this.updateProgress(run.id, {
          conversations_found: conversations.length,
          conversations_analyzed: analyzedCount,
          conversations_passed: passCount,
          conversations_errors: errorCount,
          issues_found: issuesFound,
        });
      }
    }

    // Complete run
    const finishedAt = new Date();
    const summaryJSON = JSON.stringify({
      conversations_found: conversations.length,
      conversations_analyzed: analyzedCount,
      conversations_passed: passCount,
      conversations_errors: errorCount,
      issues_found: issuesFound,
    });

    let runStatus = 'success';
    let errorMessage = '';
    if (analyzedCount === 0 && errorCount > 0) {
      runStatus = 'error';
      errorMessage = `AI errors: ${errorCount}/${conversations.length} conversations failed`;
    }

    // Critical: final status update -- retry on failure to prevent stuck "running" state
    for (let retry = 0; retry < 3; retry++) {
      try {
        await this.jobRunRepo.update(run.id, {
          status: runStatus,
          finished_at: finishedAt,
          summary: summaryJSON,
          error_message: errorMessage,
        });
        break;
      } catch (err) {
        this.logger.error(
          `DB update error (final status, attempt ${retry + 1}): ${(err as Error).message}`,
        );
        if (retry < 2) {
          await sleep(2000).catch(() => {});
        }
      }
    }

    // Update job last_run (skip for test runs)
    if (!isTestRun) {
      await this.jobRepo.update(job.id, {
        last_run_at: finishedAt,
        last_run_status: 'success',
        updated_at: finishedAt,
      });
    }

    run.status = runStatus;
    run.finished_at = finishedAt;
    run.summary = summaryJSON;
    run.error_message = errorMessage;

    this.logger.log(
      `job ${job.name} completed: ${conversations.length} conversations, ${issuesFound} issues`,
    );

    // Log activity
    await this.logActivity({
      tenantId: job.tenant_id,
      action: 'job.run.completed',
      resourceType: 'job',
      resourceId: job.id,
      detail: `Job '${job.name}': ${analyzedCount} analyzed, ${passCount} passed, ${issuesFound} issues, ${errorCount} errors`,
      errorMessage,
    });

    return run;
  }

  /**
   * Get AI provider from tenant settings.
   */
  private async getProvider(job: Job): Promise<AIProvider> {
    // Batch-fetch all AI settings in one query
    const aiSettings = await this.appSettingRepo.find({
      where: {
        tenant_id: job.tenant_id,
        setting_key: In(['ai_provider', 'ai_api_key', 'ai_model', 'ai_base_url']),
      },
    });
    const settingMap = new Map(aiSettings.map((s) => [s.setting_key, s]));

    const providerSetting = settingMap.get('ai_provider');
    const providerName = providerSetting?.value_plain || job.ai_provider;

    const apiKeySetting = settingMap.get('ai_api_key');
    if (!apiKeySetting) {
      throw new Error(
        'API key not configured - go to Settings > AI Config',
      );
    }

    let apiKey = apiKeySetting.value_plain;
    if (
      apiKeySetting.value_encrypted &&
      apiKeySetting.value_encrypted.length > 0
    ) {
      const decrypted = this.cryptoService.decrypt(
        apiKeySetting.value_encrypted,
      );
      apiKey = decrypted.toString('utf-8');
    }

    const modelSetting = settingMap.get('ai_model');
    const model = modelSetting?.value_plain || job.ai_model;

    const baseURLSetting = settingMap.get('ai_base_url');
    const baseURL = baseURLSetting?.value_plain || '';

    // Return a stub provider -- real implementations (Claude, Gemini) would be
    // injected via a factory. For now, throw for unsupported providers.
    switch (providerName) {
      case 'claude':
      case 'gemini':
        // In a full implementation, we'd create real AI providers here.
        // For this module, the provider factory is a placeholder that the
        // caller should inject via runJobWithProvider for testing.
        throw new Error(
          `AI provider '${providerName}' factory not yet implemented in NestJS. ` +
            `Use runJobWithProvider() to inject a provider. ` +
            `API key: ${apiKey ? '***' + apiKey.slice(-4) : 'missing'}, model: ${model}, baseURL: ${baseURL}`,
        );
      default:
        throw new Error(`unsupported AI provider: ${providerName}`);
    }
  }

  /**
   * Save analysis results to the database.
   */
  async saveResults(
    runId: string,
    tenantId: string,
    conversationId: string,
    jobType: string,
    aiResponse: string,
  ): Promise<{ count: number; passed: boolean }> {
    const now = new Date();
    let count = 0;
    let passed = false;

    aiResponse = stripMarkdownFences(aiResponse);

    switch (jobType) {
      case 'qc_analysis': {
        const qcResult = JSON.parse(aiResponse) as {
          verdict: string;
          violations: Array<{
            severity: string;
            rule: string;
            evidence: string;
            explanation: string;
            suggestion: string;
          }>;
          score: number;
          review: string;
          summary: string;
        };

        passed = qcResult.verdict === 'PASS';

        // Save conversation evaluation record
        const evalDetail = JSON.stringify({
          review: qcResult.review,
          score: qcResult.score,
          summary: qcResult.summary,
        });
        await this.jobResultRepo.save({
          id: newUUID(),
          job_run_id: runId,
          tenant_id: tenantId,
          conversation_id: conversationId,
          result_type: 'conversation_evaluation',
          severity: qcResult.verdict,
          evidence: qcResult.review,
          detail: evalDetail,
          ai_raw_response: aiResponse,
          confidence: 1.0,
          created_at: now,
        });

        // SKIP conversations have no violations
        if (qcResult.verdict === 'SKIP') {
          return { count: 0, passed: false };
        }

        // Save individual violations
        const violations = qcResult.violations || [];
        if (violations.length > 0) {
          await Promise.all(
            violations.map((v) => {
              const detailJSON = JSON.stringify({
                explanation: v.explanation,
                suggestion: v.suggestion,
                score: qcResult.score,
                summary: qcResult.summary,
              });
              return this.jobResultRepo.save({
                id: newUUID(),
                job_run_id: runId,
                tenant_id: tenantId,
                conversation_id: conversationId,
                result_type: 'qc_violation',
                severity: v.severity,
                rule_name: v.rule,
                evidence: v.evidence,
                detail: detailJSON,
                ai_raw_response: aiResponse,
                confidence: 1.0,
                created_at: now,
              });
            }),
          );
          count = violations.length;
        }
        break;
      }

      case 'classification': {
        const classResult = JSON.parse(aiResponse) as {
          tags: Array<{
            rule_name: string;
            confidence: number;
            evidence: string;
            explanation: string;
          }>;
          summary: string;
        };

        const tags = classResult.tags || [];
        if (tags.length > 0) {
          await Promise.all(
            tags.map((t) => {
              const detailJSON = JSON.stringify({
                explanation: t.explanation,
                summary: classResult.summary,
              });
              return this.jobResultRepo.save({
                id: newUUID(),
                job_run_id: runId,
                tenant_id: tenantId,
                conversation_id: conversationId,
                result_type: 'classification_tag',
                rule_name: t.rule_name,
                evidence: t.evidence,
                detail: detailJSON,
                ai_raw_response: aiResponse,
                confidence: t.confidence,
                created_at: now,
              });
            }),
          );
          count = tags.length;
        }

        // Create conversation_evaluation record
        if (tags.length > 0) {
          const evalDetail = JSON.stringify({
            summary: classResult.summary,
          });
          await this.jobResultRepo.save({
            id: newUUID(),
            job_run_id: runId,
            tenant_id: tenantId,
            conversation_id: conversationId,
            result_type: 'conversation_evaluation',
            severity: 'PASS',
            evidence: classResult.summary,
            detail: evalDetail,
            ai_raw_response: aiResponse,
            confidence: 1.0,
            created_at: now,
          });
        } else {
          const skipDetail = JSON.stringify({
            summary: classResult.summary,
          });
          await this.jobResultRepo.save({
            id: newUUID(),
            job_run_id: runId,
            tenant_id: tenantId,
            conversation_id: conversationId,
            result_type: 'conversation_evaluation',
            severity: 'SKIP',
            evidence:
              'Cu\u1ed9c chat kh\u00f4ng kh\u1edbp v\u1edbi b\u1ea5t k\u1ef3 nh\u00e3n ph\u00e2n lo\u1ea1i n\u00e0o.',
            detail: skipDetail,
            ai_raw_response: aiResponse,
            confidence: 1.0,
            created_at: now,
          });
        }
        break;
      }
    }

    return { count, passed };
  }

  /**
   * Batch mode: process conversations in batches.
   */
  private async runBatchMode(
    provider: AIProvider,
    job: Job,
    run: JobRun,
    conversations: Conversation[],
    since: Date | null,
    batchSize: number,
    signal?: AbortSignal,
  ): Promise<{
    issuesFound: number;
    passCount: number;
    analyzedCount: number;
    errorCount: number;
  }> {
    const systemPrompt = this.buildSystemPrompt(job);
    if (!systemPrompt) {
      return { issuesFound: 0, passCount: 0, analyzedCount: 0, errorCount: 0 };
    }

    // Prepare all conversations with transcripts
    interface ConvWithTranscript {
      conv: Conversation;
      transcript: string;
    }
    const prepared: ConvWithTranscript[] = [];
    for (const conv of conversations) {
      const messages = await this.fetchMessages(conv.id, since);
      if (messages.length === 0) {
        continue;
      }

      prepared.push({
        conv,
        transcript: formatChatTranscript(this.messagesToChatMessages(messages)),
      });
    }

    let issuesFound = 0;
    let passCount = 0;
    let analyzedCount = 0;
    let errorCount = 0;
    let consecutiveErrors = 0;

    // Process in batches
    for (let i = 0; i < prepared.length; i += batchSize) {
      // Check abort signal
      if (signal?.aborted) {
        this.logger.log(
          `job ${job.name}: cancelled, stopping after ${analyzedCount}/${conversations.length} conversations`,
        );
        break;
      }

      const end = Math.min(i + batchSize, prepared.length);
      const batch = prepared.slice(i, end);

      // Build batch items
      const items: BatchItem[] = batch.map((b) => ({
        conversationId: b.conv.id,
        transcript: b.transcript,
      }));

      // Call AI batch
      let aiResp: AIResponse;
      try {
        aiResp = await provider.analyzeChatBatch(signal, systemPrompt, items);
      } catch (err) {
        this.logger.warn(
          `AI error for batch starting at ${i}: ${(err as Error).message}`,
        );
        errorCount += batch.length;

        // Adaptive backoff
        if (end < prepared.length) {
          consecutiveErrors++;
          try {
            if (consecutiveErrors >= 3) {
              await sleep(30000, signal);
            } else {
              await sleep(10000, signal);
            }
          } catch {
            break; // Aborted
          }
        }
        continue;
      }

      // Log AI usage
      const cost = calculateCostUSD(
        aiResp.provider,
        aiResp.model,
        aiResp.inputTokens,
        aiResp.outputTokens,
      );
      await this.aiUsageLogRepo.save({
        id: newUUID(),
        tenant_id: job.tenant_id,
        job_id: job.id,
        job_run_id: run.id,
        provider: aiResp.provider,
        model: aiResp.model,
        input_tokens: aiResp.inputTokens,
        output_tokens: aiResp.outputTokens,
        cost_usd: cost,
        created_at: new Date(),
      });

      // Parse batch response -- expect JSON array
      const content = stripMarkdownFences(aiResp.content);

      let batchResults: any[];
      try {
        batchResults = JSON.parse(content);
        if (!Array.isArray(batchResults)) {
          throw new Error('not an array');
        }
      } catch {
        // Fallback: try as single result
        this.logger.warn(
          'failed to parse batch response as array, trying individual',
        );
        for (const b of batch) {
          try {
            const { count: cnt, passed: p } = await this.saveResults(
              run.id,
              job.tenant_id,
              b.conv.id,
              job.job_type,
              content,
            );
            analyzedCount++;
            issuesFound += cnt;
            if (p) passCount++;
          } catch {
            errorCount++;
          }
        }
        batchResults = []; // already processed
      }

      // Process each result
      for (let j = 0; j < batchResults.length; j++) {
        if (j >= batch.length) break;

        let convId = batch[j].conv.id;
        const rawResult = batchResults[j];

        // Extract conversation_id from result if present
        if (
          rawResult &&
          typeof rawResult === 'object' &&
          typeof rawResult.conversation_id === 'string' &&
          rawResult.conversation_id
        ) {
          convId = rawResult.conversation_id;
        }

        try {
          const { count: cnt, passed: p } = await this.saveResults(
            run.id,
            job.tenant_id,
            convId,
            job.job_type,
            JSON.stringify(rawResult),
          );
          analyzedCount++;
          issuesFound += cnt;
          if (p) passCount++;
        } catch (err) {
          this.logger.warn(
            `save error for ${convId}: ${(err as Error).message}`,
          );
          errorCount++;
        }
      }

      // Update progress
      await this.updateProgress(run.id, {
        conversations_found: conversations.length,
        conversations_analyzed: analyzedCount,
        conversations_passed: passCount,
        conversations_errors: errorCount,
        issues_found: issuesFound,
      });

      // Rate limit between batches (error backoff is handled in the catch block above)
      if (end < prepared.length) {
        consecutiveErrors = 0;
        try {
          await sleep(2000, signal);
        } catch {
          break;
        }
      }
    }

    this.logger.log(
      `job ${job.name}: ${prepared.length} conversations in ${Math.ceil(prepared.length / batchSize)} batches of ${batchSize}`,
    );

    return { issuesFound, passCount, analyzedCount, errorCount };
  }

  /** Convert DB messages to ChatMessages for transcript formatting. */
  private messagesToChatMessages(messages: Message[]): ChatMessage[] {
    return messages.map((m) => ({
      senderType: m.sender_type,
      senderName: m.sender_name,
      content: m.content,
      sentAt: formatTimeVN(m.sent_at),
    }));
  }

  /** Fetch messages for a conversation, optionally filtered by since date. */
  private async fetchMessages(
    conversationId: string,
    since: Date | null,
  ): Promise<Message[]> {
    const mqb = this.messageRepo
      .createQueryBuilder('m')
      .where('m.conversation_id = :convId', { convId: conversationId });
    if (since) {
      mqb.andWhere('m.sent_at > :since', { since });
    }
    mqb.orderBy('m.sent_at', 'ASC');
    return mqb.getMany();
  }

  /** Build system prompt based on job type. Returns null for unsupported types. */
  private buildSystemPrompt(job: Job): string | null {
    switch (job.job_type) {
      case 'qc_analysis':
        return buildQCPrompt(job.rules_content, job.skip_conditions);
      case 'classification':
        return buildClassificationPrompt(job.rules_config);
      default:
        return null;
    }
  }

  /** Update run progress summary. */
  private async updateProgress(
    runId: string,
    progress: Record<string, number>,
  ): Promise<void> {
    try {
      await this.jobRunRepo.update(runId, {
        summary: JSON.stringify(progress),
      });
    } catch (err) {
      this.logger.error(
        `DB update error (progress): ${(err as Error).message}`,
      );
    }
  }

  /** Fail a run with an error. */
  private async failRun(run: JobRun, err: Error): Promise<JobRun> {
    const finishedAt = new Date();
    await this.jobRunRepo.update(run.id, {
      status: 'error',
      finished_at: finishedAt,
      error_message: err.message,
    });
    run.status = 'error';
    run.finished_at = finishedAt;
    run.error_message = err.message;
    return run;
  }

  /** Log an activity. */
  private async logActivity(opts: {
    tenantId: string;
    action: string;
    resourceType: string;
    resourceId: string;
    detail?: string;
    errorMessage?: string;
  }): Promise<void> {
    try {
      await this.activityLogRepo.save({
        id: newUUID(),
        tenant_id: opts.tenantId,
        user_email: 'system',
        action: opts.action,
        resource_type: opts.resourceType,
        resource_id: opts.resourceId,
        detail: opts.detail ?? '',
        error_message: opts.errorMessage ?? '',
        ip_address: '',
        created_at: new Date(),
      });
    } catch (err) {
      this.logger.error(
        `Failed to log activity: ${(err as Error).message}`,
      );
    }
  }
}
