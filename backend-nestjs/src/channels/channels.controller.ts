import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Req,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ChannelsService } from './channels.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';

/**
 * ChannelsController replicates the Go backend's channel endpoints exactly.
 *
 * Note: Permission guards (channels:r, channels:w, channels:d) and tenant context
 * extraction will be implemented in a shared auth middleware module.
 * For now, tenantId comes from the route param.
 */
@Controller()
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  // GET /api/v1/tenants/:tenantId/channels (permission: channels:r)
  @Get('api/v1/tenants/:tenantId/channels')
  async listChannels(@Param('tenantId') tenantId: string) {
    return this.channelsService.listChannels(tenantId);
  }

  // POST /api/v1/tenants/:tenantId/channels (permission: channels:w)
  @Post('api/v1/tenants/:tenantId/channels')
  @HttpCode(HttpStatus.CREATED)
  async createChannel(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateChannelDto,
  ) {
    return this.channelsService.createChannel(tenantId, dto);
  }

  // GET /api/v1/tenants/:tenantId/channels/:channelId (permission: channels:r)
  @Get('api/v1/tenants/:tenantId/channels/:channelId')
  async getChannel(
    @Param('tenantId') tenantId: string,
    @Param('channelId') channelId: string,
  ) {
    return this.channelsService.getChannel(tenantId, channelId);
  }

  // PUT /api/v1/tenants/:tenantId/channels/:channelId (permission: channels:w)
  @Put('api/v1/tenants/:tenantId/channels/:channelId')
  async updateChannel(
    @Param('tenantId') tenantId: string,
    @Param('channelId') channelId: string,
    @Body() dto: UpdateChannelDto,
  ) {
    return this.channelsService.updateChannel(tenantId, channelId, dto);
  }

  // DELETE /api/v1/tenants/:tenantId/channels/:channelId (permission: channels:d)
  @Delete('api/v1/tenants/:tenantId/channels/:channelId')
  async deleteChannel(
    @Param('tenantId') tenantId: string,
    @Param('channelId') channelId: string,
    @Req() req: Request,
  ) {
    // userId/userEmail will come from auth middleware later
    return this.channelsService.deleteChannel(
      tenantId,
      channelId,
      undefined,
      undefined,
      req.ip,
    );
  }

  // POST /api/v1/tenants/:tenantId/channels/:channelId/test (permission: channels:r)
  @Post('api/v1/tenants/:tenantId/channels/:channelId/test')
  async testChannel(
    @Param('tenantId') tenantId: string,
    @Param('channelId') channelId: string,
  ) {
    return this.channelsService.testChannel(tenantId, channelId);
  }

  // POST /api/v1/tenants/:tenantId/channels/:channelId/sync (permission: channels:w)
  @Post('api/v1/tenants/:tenantId/channels/:channelId/sync')
  @HttpCode(HttpStatus.ACCEPTED)
  async syncChannel(
    @Param('tenantId') tenantId: string,
    @Param('channelId') channelId: string,
  ) {
    return this.channelsService.syncChannel(tenantId, channelId);
  }

  // POST /api/v1/tenants/:tenantId/channels/:channelId/reauth (permission: channels:w)
  @Post('api/v1/tenants/:tenantId/channels/:channelId/reauth')
  async reauthChannel(
    @Param('tenantId') tenantId: string,
    @Param('channelId') channelId: string,
    @Req() req: Request,
  ) {
    const baseUrl = this.channelsService.getBaseUrl(req);
    return this.channelsService.reauthChannel(tenantId, channelId, baseUrl);
  }

  // GET /api/v1/tenants/:tenantId/channels/:channelId/sync-history (permission: channels:r)
  @Get('api/v1/tenants/:tenantId/channels/:channelId/sync-history')
  async getSyncHistory(
    @Param('tenantId') tenantId: string,
    @Param('channelId') channelId: string,
    @Query('page') page?: string,
    @Query('per_page') perPage?: string,
  ) {
    return this.channelsService.getSyncHistory(
      tenantId,
      channelId,
      parseInt(page || '1', 10),
      parseInt(perPage || '10', 10),
    );
  }

  // DELETE /api/v1/tenants/:tenantId/channels/:channelId/conversations (permission: channels:d)
  @Delete('api/v1/tenants/:tenantId/channels/:channelId/conversations')
  async purgeConversations(
    @Param('tenantId') tenantId: string,
    @Param('channelId') channelId: string,
    @Req() req: Request,
  ) {
    return this.channelsService.purgeConversations(
      tenantId,
      channelId,
      undefined,
      undefined,
      req.ip,
    );
  }

  // GET /api/v1/channels/zalo/callback (public OAuth callback)
  @Get('api/v1/channels/zalo/callback')
  async zaloCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!code || !state) {
      return res.redirect('/login?zalo_auth=error&message=Missing+code+or+state');
    }
    const baseUrl = this.channelsService.getBaseUrl(req);
    const redirectPath = await this.channelsService.handleZaloCallback(
      code,
      state,
      baseUrl,
    );
    return res.redirect(redirectPath);
  }

  // GET /api/v1/channels/facebook/callback (public OAuth callback)
  @Get('api/v1/channels/facebook/callback')
  async facebookCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!code || !state) {
      return res.redirect('/login?fb_auth=error&message=Missing+code+or+state');
    }
    const baseUrl = this.channelsService.getBaseUrl(req);
    const redirectPath = await this.channelsService.handleFacebookCallback(
      code,
      state,
      baseUrl,
    );
    return res.redirect(redirectPath);
  }
}
