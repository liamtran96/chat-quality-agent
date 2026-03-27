import { User } from './user.entity';
import { UserTenant } from './user-tenant.entity';
import { Tenant } from './tenant.entity';
import { Channel } from './channel.entity';
import { Conversation } from './conversation.entity';
import { Message } from './message.entity';
import { Job } from './job.entity';
import { JobRun } from './job-run.entity';
import { JobResult } from './job-result.entity';
import { AppSetting } from './app-setting.entity';
import { NotificationLog } from './notification-log.entity';
import { AIUsageLog } from './ai-usage-log.entity';
import { ActivityLog } from './activity-log.entity';
import { OAuthClient } from './oauth-client.entity';
import { OAuthAuthorizationCode } from './oauth-authorization-code.entity';
import { OAuthToken } from './oauth-token.entity';

export {
  User,
  UserTenant,
  Tenant,
  Channel,
  Conversation,
  Message,
  Job,
  JobRun,
  JobResult,
  AppSetting,
  NotificationLog,
  AIUsageLog,
  ActivityLog,
  OAuthClient,
  OAuthAuthorizationCode,
  OAuthToken,
};

export const ALL_ENTITIES = [
  User,
  UserTenant,
  Tenant,
  Channel,
  Conversation,
  Message,
  Job,
  JobRun,
  JobResult,
  AppSetting,
  NotificationLog,
  AIUsageLog,
  ActivityLog,
  OAuthClient,
  OAuthAuthorizationCode,
  OAuthToken,
];
