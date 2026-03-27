import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { AgentsService } from './agents.service';
import { AgentRunRequest } from './agents.interfaces';

@Controller('api/v1/agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get()
  listAgents() {
    return this.agentsService.listAgents();
  }

  @Get('capabilities')
  listCapabilities() {
    return this.agentsService.listAgents();
  }

  @Post(':agentName/run')
  @HttpCode(HttpStatus.OK)
  async runAgent(
    @Param('agentName') agentName: string,
    @Body() body: AgentRunRequest,
  ) {
    if (!body.tenant_id) {
      throw new BadRequestException({ error: 'invalid_request', details: 'tenant_id is required' });
    }
    if (!body.action) {
      throw new BadRequestException({ error: 'invalid_request', details: 'action is required' });
    }

    const result = await this.agentsService.runAgent(agentName, body);
    if (result === null) {
      throw new NotFoundException({ error: 'agent_not_found' });
    }
    return result;
  }

  @Get(':agentName/query')
  async queryAgent(
    @Param('agentName') agentName: string,
    @Query('tenant_id') tenantId: string,
    @Query('resource') resource: string,
    @Query('conversation_id') conversationId?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException({ error: 'tenant_id_required' });
    }

    const result = await this.agentsService.queryAgent(
      agentName,
      tenantId,
      resource,
      conversationId,
    );
    if (result === null) {
      throw new NotFoundException({ error: 'agent_not_found' });
    }
    return result;
  }

  @Get(':agentName/health')
  agentHealth() {
    return { status: 'healthy', timestamp: new Date() };
  }
}
