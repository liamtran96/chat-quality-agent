import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { Tenant } from '../entities/tenant.entity';
import { UserTenant } from '../entities/user-tenant.entity';
import { User } from '../entities/user.entity';
import { Channel } from '../entities/channel.entity';
import { Job } from '../entities/job.entity';
import { Conversation } from '../entities/conversation.entity';
import { Message } from '../entities/message.entity';
import { JobRun } from '../entities/job-run.entity';
import { JobResult } from '../entities/job-result.entity';
import { NotificationLog } from '../entities/notification-log.entity';
import { AIUsageLog } from '../entities/ai-usage-log.entity';
import { ActivityLog } from '../entities/activity-log.entity';
import { AppSetting } from '../entities/app-setting.entity';
import { TenantGuard } from '../common/guards/tenant.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Tenant,
      UserTenant,
      User,
      Channel,
      Job,
      Conversation,
      Message,
      JobRun,
      JobResult,
      NotificationLog,
      AIUsageLog,
      ActivityLog,
      AppSetting,
    ]),
  ],
  controllers: [TenantsController],
  providers: [TenantsService, TenantGuard],
  exports: [TenantsService, TenantGuard],
})
export class TenantsModule {}
