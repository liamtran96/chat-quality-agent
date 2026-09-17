import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantGuard } from '../auth/tenant.guard';
import { TenantId } from '../auth/decorators';
import { ActivityLog, AIUsageLog, AppSetting, NotificationLog } from '../entities';
import { parsePagination, parseExchangeRate } from '../common/helpers';

@Controller('api/v1/tenants/:tenantId')
@UseGuards(JwtAuthGuard, TenantGuard)
export class LogsController {
  constructor(
    @InjectRepository(ActivityLog)
    private readonly activityLogRepo: Repository<ActivityLog>,
    @InjectRepository(AIUsageLog)
    private readonly aiUsageLogRepo: Repository<AIUsageLog>,
    @InjectRepository(NotificationLog)
    private readonly notificationLogRepo: Repository<NotificationLog>,
    @InjectRepository(AppSetting)
    private readonly appSettingRepo: Repository<AppSetting>,
  ) {}

  @Get('activity-logs')
  async listActivityLogs(
    @TenantId() tenantId: string,
    @Query('page') pageStr?: string,
    @Query('per_page') perPageStr?: string,
    @Query('action') action?: string,
  ) {
    const { page, perPage } = parsePagination(pageStr, perPageStr);

    const qb = this.activityLogRepo
      .createQueryBuilder('log')
      .where('log.tenant_id = :tenantId', { tenantId });

    if (action) {
      qb.andWhere('log.action LIKE :action', { action: action + '%' });
    }

    const total = await qb.getCount();
    const data = await qb
      .orderBy('log.created_at', 'DESC')
      .offset((page - 1) * perPage)
      .limit(perPage)
      .getMany();

    return { data, total, page, per_page: perPage };
  }

  @Get('cost-logs')
  async listCostLogs(
    @TenantId() tenantId: string,
    @Query('page') pageStr?: string,
    @Query('per_page') perPageStr?: string,
    @Query('provider') provider?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const { page, perPage } = parsePagination(pageStr, perPageStr);

    const qb = this.aiUsageLogRepo
      .createQueryBuilder('log')
      .where('log.tenant_id = :tenantId', { tenantId });

    if (provider) {
      qb.andWhere('log.provider = :provider', { provider });
    }
    if (from) {
      qb.andWhere('log.created_at >= :from', { from: from + ' 00:00:00' });
    }
    if (to) {
      qb.andWhere('log.created_at <= :to', { to: to + ' 23:59:59' });
    }

    const total = await qb.getCount();
    const data = await qb
      .orderBy('log.created_at', 'DESC')
      .offset((page - 1) * perPage)
      .limit(perPage)
      .getMany();

    const rateSetting = await this.appSettingRepo.findOne({
      where: { tenant_id: tenantId, setting_key: 'exchange_rate_vnd' },
    });
    const exchangeRate = parseExchangeRate(rateSetting?.value_plain);

    return { data, total, page, per_page: perPage, exchange_rate: exchangeRate };
  }

  @Get('notification-logs')
  async listNotificationLogs(
    @TenantId() tenantId: string,
    @Query('page') pageStr?: string,
    @Query('per_page') perPageStr?: string,
  ) {
    const { page, perPage } = parsePagination(pageStr, perPageStr, 20);

    const total = await this.notificationLogRepo.count({
      where: { tenant_id: tenantId },
    });

    const data = await this.notificationLogRepo.find({
      where: { tenant_id: tenantId },
      order: { sent_at: 'DESC' },
      skip: (page - 1) * perPage,
      take: perPage,
    });

    return { data, total, page, per_page: perPage };
  }
}
