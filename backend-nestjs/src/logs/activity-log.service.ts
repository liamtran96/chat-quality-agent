import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityLog } from '../entities';
import { newUUID } from '../common/helpers';

@Injectable()
export class ActivityLogService {
  constructor(
    @InjectRepository(ActivityLog)
    private readonly activityLogRepo: Repository<ActivityLog>,
  ) {}

  async logActivity(
    tenantId: string,
    userId: string,
    userEmail: string,
    action: string,
    resourceType: string,
    resourceId: string,
    detail: string,
    ipAddress: string,
    errorMessage?: string,
  ): Promise<void> {
    const log = this.activityLogRepo.create({
      id: newUUID(),
      tenant_id: tenantId,
      user_id: userId,
      user_email: userEmail,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      detail,
      error_message: errorMessage || '',
      ip_address: ipAddress,
      created_at: new Date(),
    });
    await this.activityLogRepo.save(log);
  }
}
