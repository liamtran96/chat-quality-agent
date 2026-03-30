import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { McpController } from './mcp.controller';
import { McpToolsService } from './mcp-tools.service';
import { McpOAuthController } from './mcp-oauth.controller';
import { McpOAuthService } from './mcp-oauth.service';
import { McpClientsController } from './mcp-clients.controller';
import { OAuthClient } from '../entities/oauth-client.entity';
import { OAuthAuthorizationCode } from '../entities/oauth-authorization-code.entity';
import { OAuthToken } from '../entities/oauth-token.entity';
import { User } from '../entities/user.entity';
import { UserTenant } from '../entities/user-tenant.entity';
import { Tenant } from '../entities/tenant.entity';
import { Channel } from '../entities/channel.entity';
import { Conversation } from '../entities/conversation.entity';
import { Message } from '../entities/message.entity';
import { Job } from '../entities/job.entity';
import { JobRun } from '../entities/job-run.entity';
import { JobResult } from '../entities/job-result.entity';
import { NotificationLog } from '../entities/notification-log.entity';
import { AIUsageLog } from '../entities/ai-usage-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OAuthClient,
      OAuthAuthorizationCode,
      OAuthToken,
      User,
      UserTenant,
      Tenant,
      Channel,
      Conversation,
      Message,
      Job,
      JobRun,
      JobResult,
      NotificationLog,
      AIUsageLog,
    ]),
  ],
  controllers: [McpController, McpOAuthController, McpClientsController],
  providers: [McpToolsService, McpOAuthService],
})
export class McpModule {}
