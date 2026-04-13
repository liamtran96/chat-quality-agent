import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { JobsService } from './jobs.service';
import { CreateJobDto } from './dto/create-job.dto';

@Controller('api/v1/tenants/:tenantId')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  // GET /api/v1/tenants/:tenantId/jobs — permission: jobs:r
  @Get('jobs')
  listJobs(@Param('tenantId') tenantId: string) {
    return this.jobsService.listJobs(tenantId);
  }

  // POST /api/v1/tenants/:tenantId/jobs — permission: jobs:w
  @Post('jobs')
  @HttpCode(HttpStatus.CREATED)
  createJob(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateJobDto,
  ) {
    return this.jobsService.createJob(tenantId, dto);
  }

  // GET /api/v1/tenants/:tenantId/jobs/:jobId — permission: jobs:r
  @Get('jobs/:jobId')
  getJob(
    @Param('tenantId') tenantId: string,
    @Param('jobId') jobId: string,
  ) {
    return this.jobsService.getJob(tenantId, jobId);
  }

  // PUT /api/v1/tenants/:tenantId/jobs/:jobId — permission: jobs:w
  @Put('jobs/:jobId')
  updateJob(
    @Param('tenantId') tenantId: string,
    @Param('jobId') jobId: string,
    @Body() body: Record<string, any>,
  ) {
    return this.jobsService.updateJob(tenantId, jobId, body);
  }

  // DELETE /api/v1/tenants/:tenantId/jobs/:jobId — permission: jobs:d
  @Delete('jobs/:jobId')
  deleteJob(
    @Param('tenantId') tenantId: string,
    @Param('jobId') jobId: string,
  ) {
    return this.jobsService.deleteJob(tenantId, jobId);
  }

  // POST /api/v1/tenants/:tenantId/jobs/:jobId/trigger — permission: jobs:w
  @Post('jobs/:jobId/trigger')
  @HttpCode(HttpStatus.ACCEPTED)
  triggerJob(
    @Param('tenantId') tenantId: string,
    @Param('jobId') jobId: string,
    @Query('mode') mode?: string,
    @Query('full') full?: string,
    @Query('from') dateFrom?: string,
    @Query('to') dateTo?: string,
    @Query('limit') limitStr?: string,
  ) {
    // Backward compat: if full=true treat as conditional
    let resolvedMode = mode || '';
    if (!resolvedMode && full === 'true') {
      resolvedMode = 'conditional';
    }
    if (!resolvedMode) {
      resolvedMode = 'since_last';
    }
    const limit = limitStr ? parseInt(limitStr, 10) : undefined;
    return this.jobsService.triggerJob(tenantId, jobId, resolvedMode, {
      limit: limit && limit > 0 ? limit : undefined,
      dateFrom,
      dateTo,
    });
  }

  // POST /api/v1/tenants/:tenantId/jobs/:jobId/test-run — permission: jobs:w
  @Post('jobs/:jobId/test-run')
  @HttpCode(HttpStatus.ACCEPTED)
  testRunJob(
    @Param('tenantId') tenantId: string,
    @Param('jobId') jobId: string,
  ) {
    return this.jobsService.testRunJob(tenantId, jobId);
  }

  // POST /api/v1/tenants/:tenantId/jobs/:jobId/cancel — permission: jobs:w
  @Post('jobs/:jobId/cancel')
  cancelJob(
    @Param('tenantId') tenantId: string,
    @Param('jobId') jobId: string,
  ) {
    return this.jobsService.cancelJob(tenantId, jobId);
  }

  // GET /api/v1/tenants/:tenantId/jobs/:jobId/runs — permission: jobs:r
  @Get('jobs/:jobId/runs')
  listJobRuns(
    @Param('tenantId') tenantId: string,
    @Param('jobId') jobId: string,
    @Query('page') page?: string,
    @Query('per_page') perPage?: string,
  ) {
    return this.jobsService.listJobRuns(
      tenantId,
      jobId,
      page ? parseInt(page, 10) : undefined,
      perPage ? parseInt(perPage, 10) : undefined,
    );
  }

  // GET /api/v1/tenants/:tenantId/jobs/:jobId/runs/:runId/results — permission: jobs:r
  @Get('jobs/:jobId/runs/:runId/results')
  listRunResults(
    @Param('tenantId') tenantId: string,
    @Param('jobId') jobId: string,
    @Param('runId') runId: string,
    @Query('page') page?: string,
    @Query('per_page') perPage?: string,
  ) {
    return this.jobsService.listRunResults(
      tenantId,
      jobId,
      runId,
      page ? parseInt(page, 10) : undefined,
      perPage ? parseInt(perPage, 10) : undefined,
    );
  }

  // POST /api/v1/tenants/:tenantId/test-output — permission: jobs:w
  @Post('test-output')
  testOutput(
    @Param('tenantId') tenantId: string,
    @Body() dto: { type: string; bot_token?: string; chat_id?: string },
  ) {
    return this.jobsService.testOutput(tenantId, dto);
  }

  // GET /api/v1/tenants/:tenantId/jobs/:jobId/results — permission: jobs:r
  @Get('jobs/:jobId/results')
  listAllResults(
    @Param('tenantId') tenantId: string,
    @Param('jobId') jobId: string,
    @Query() query: Record<string, any>,
  ) {
    return this.jobsService.listAllResults(tenantId, jobId, query);
  }

  // GET /api/v1/tenants/:tenantId/jobs/:jobId/results/export — permission: jobs:r
  @Get('jobs/:jobId/results/export')
  async exportResults(
    @Param('tenantId') tenantId: string,
    @Param('jobId') jobId: string,
    @Query('format') format: string,
    @Res() res: Response,
  ) {
    const result = await this.jobsService.exportResults(
      tenantId,
      jobId,
      format || 'csv',
    );
    res.set('Content-Type', result.contentType);
    res.set('Content-Disposition', `attachment; filename=${result.filename}`);
    res.send(result.data);
  }

  // DELETE /api/v1/tenants/:tenantId/jobs/:jobId/results — permission: jobs:d
  @Delete('jobs/:jobId/results')
  clearResults(
    @Param('tenantId') tenantId: string,
    @Param('jobId') jobId: string,
  ) {
    return this.jobsService.clearResults(tenantId, jobId);
  }

  // DELETE /api/v1/tenants/:tenantId/jobs/:jobId/runs — permission: jobs:d
  @Delete('jobs/:jobId/runs')
  clearRuns(
    @Param('tenantId') tenantId: string,
    @Param('jobId') jobId: string,
  ) {
    return this.jobsService.clearRuns(tenantId, jobId);
  }
}
