import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ConversationsService } from './conversations.service';
import {
  ListConversationsDto,
  GetConversationPageDto,
  ExportMessagesDto,
} from './dto/list-conversations.dto';

@Controller('api/v1/tenants/:tenantId')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get('conversations')
  async listConversations(
    @Param('tenantId') tenantId: string,
    @Query() query: ListConversationsDto,
  ) {
    return this.conversationsService.listConversations(tenantId, {
      page: query.page ? parseInt(query.page, 10) : undefined,
      per_page: query.per_page ? parseInt(query.per_page, 10) : undefined,
      channel_id: query.channel_id,
      channel_type: query.channel_type,
      search: query.search,
      evaluation: query.evaluation,
    });
  }

  @Get('conversations/export')
  async exportMessages(
    @Param('tenantId') tenantId: string,
    @Query() query: ExportMessagesDto,
    @Res() res: Response,
  ) {
    const result = await this.conversationsService.exportMessages(tenantId, {
      from: query.from,
      to: query.to,
      format: query.format,
      channel_id: query.channel_id,
      channel_type: query.channel_type,
    });

    if (result.type === 'json') {
      return res.status(HttpStatus.OK).json((result as any).body);
    }

    const contentType =
      result.type === 'csv'
        ? 'text/csv; charset=utf-8'
        : 'text/plain; charset=utf-8';

    res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=${(result as any).filename}`,
    );
    return res.status(HttpStatus.OK).send((result as any).content);
  }

  @Get('conversations/evaluated')
  async listEvaluatedConversations(@Param('tenantId') tenantId: string) {
    return this.conversationsService.listEvaluatedConversations(tenantId);
  }

  @Get('conversations/:conversationId/messages')
  async getConversationMessages(
    @Param('tenantId') tenantId: string,
    @Param('conversationId') conversationId: string,
  ) {
    return this.conversationsService.getConversationMessages(
      tenantId,
      conversationId,
    );
  }

  @Get('conversations/:conversationId/evaluations')
  async getConversationEvaluations(
    @Param('tenantId') tenantId: string,
    @Param('conversationId') conversationId: string,
  ) {
    return this.conversationsService.getConversationEvaluations(
      tenantId,
      conversationId,
    );
  }

  @Get('conversations/:conversationId/page')
  async getConversationPage(
    @Param('tenantId') tenantId: string,
    @Param('conversationId') conversationId: string,
    @Query() query: GetConversationPageDto,
  ) {
    const perPage = query.per_page ? parseInt(query.per_page, 10) : undefined;
    return this.conversationsService.getConversationPage(
      tenantId,
      conversationId,
      perPage,
    );
  }
}
