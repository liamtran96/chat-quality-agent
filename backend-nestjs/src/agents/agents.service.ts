import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from '../entities/conversation.entity';
import { Message } from '../entities/message.entity';
import { JobResult } from '../entities/job-result.entity';
import { AgentInfo, AgentRunRequest, AgentRunResponse } from './agents.interfaces';

@Injectable()
export class AgentsService {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    @InjectRepository(JobResult)
    private readonly jobResultRepo: Repository<JobResult>,
  ) {}

  listAgents(): AgentInfo[] {
    return [
      {
        name: 'cqa.sync',
        description:
          'Sync chat messages from external channels (Zalo OA, Facebook) into CQA database',
        version: '1.0.0',
        capabilities: ['sync_all', 'sync_channel', 'query:conversations', 'query:messages'],
      },
      {
        name: 'cqa.qc',
        description:
          'Analyze customer service chat quality against defined rules using AI',
        version: '1.0.0',
        capabilities: ['analyze_quality', 'query:violations', 'query:scores'],
      },
      {
        name: 'cqa.classify',
        description:
          'Classify and tag conversations using AI-powered rule matching',
        version: '1.0.0',
        capabilities: ['classify_conversations', 'query:tags', 'query:rules'],
      },
    ];
  }

  async runAgent(
    agentName: string,
    req: AgentRunRequest,
  ): Promise<AgentRunResponse | null> {
    switch (agentName) {
      case 'cqa.sync':
        return this.handleSyncAgent(req);
      case 'cqa.qc':
      case 'cqa.classify':
        return this.handleAnalysisAgent(req, agentName);
      default:
        return null;
    }
  }

  async queryAgent(
    agentName: string,
    tenantId: string,
    resource: string,
    conversationId?: string,
  ): Promise<unknown> {
    switch (agentName) {
      case 'cqa.sync':
        return this.handleSyncQuery(tenantId, resource, conversationId);
      case 'cqa.qc':
        return this.handleResultQuery(tenantId, resource, 'violations', 'qc_violation');
      case 'cqa.classify':
        return this.handleResultQuery(tenantId, resource, 'tags', 'classification_tag');
      default:
        return null;
    }
  }

  private async handleSyncAgent(req: AgentRunRequest): Promise<AgentRunResponse> {
    // Stub: real sync engine not yet implemented in NestJS
    switch (req.action) {
      case 'sync_all':
      case 'sync_channel':
        return { status: 'success' };
      default:
        return { status: 'error', errors: [`unknown action: ${req.action}`] };
    }
  }

  private async handleAnalysisAgent(
    req: AgentRunRequest,
    agentName: string,
  ): Promise<AgentRunResponse> {
    // Stub: real analysis engine not yet implemented in NestJS
    const jobType = agentName === 'cqa.classify' ? 'classification' : 'qc_analysis';
    return {
      status: 'success',
      summary: { agent: agentName, job_type: jobType, tenant_id: req.tenant_id },
    };
  }

  private async handleSyncQuery(
    tenantId: string,
    resource: string,
    conversationId?: string,
  ): Promise<unknown> {
    switch (resource) {
      case 'conversations':
        return this.conversationRepo.find({
          where: { tenant_id: tenantId },
          order: { last_message_at: 'DESC' },
          take: 50,
        });
      case 'messages':
        return this.messageRepo.find({
          where: { tenant_id: tenantId, conversation_id: conversationId },
          order: { sent_at: 'ASC' },
          take: 100,
        });
      default:
        return { error: `unknown resource: ${resource}` };
    }
  }

  private async handleResultQuery(
    tenantId: string,
    resource: string,
    expectedResource: string,
    resultType: string,
  ): Promise<unknown> {
    if (resource === expectedResource) {
      return this.jobResultRepo.find({
        where: { tenant_id: tenantId, result_type: resultType },
        order: { created_at: 'DESC' },
        take: 50,
      });
    }
    return { error: `unknown resource: ${resource}` };
  }
}
