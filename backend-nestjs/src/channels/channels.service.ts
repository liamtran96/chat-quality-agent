import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import axios from 'axios';
import * as crypto from 'crypto';
import { Channel } from '../entities/channel.entity';
import { Conversation } from '../entities/conversation.entity';
import { Message } from '../entities/message.entity';
import { JobResult } from '../entities/job-result.entity';
import { ActivityLog } from '../entities/activity-log.entity';
import { CryptoService } from '../common/crypto/crypto.service';
import { ConfigService } from '@nestjs/config';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';
import { createAdapter } from './adapters/adapter.factory';
import { newUUID } from '../common/helpers/uuid.helper';

const httpClient = axios.create({ timeout: 30_000 });

export interface ChannelResponse {
  id: string;
  tenant_id: string;
  channel_type: string;
  name: string;
  external_id: string;
  is_active: boolean;
  metadata: string;
  last_sync_at: Date | null;
  last_sync_status: string;
  conversation_count: number;
  created_at: Date;
}

@Injectable()
export class ChannelsService {
  private readonly logger = new Logger(ChannelsService.name);

  constructor(
    @InjectRepository(Channel)
    private readonly channelRepo: Repository<Channel>,
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    @InjectRepository(JobResult)
    private readonly jobResultRepo: Repository<JobResult>,
    @InjectRepository(ActivityLog)
    private readonly activityLogRepo: Repository<ActivityLog>,
    private readonly cryptoService: CryptoService,
    private readonly configService: ConfigService,
  ) {}

  private channelToResponse(
    ch: Channel,
    conversationCount = 0,
  ): ChannelResponse {
    return {
      id: ch.id,
      tenant_id: ch.tenant_id,
      channel_type: ch.channel_type,
      name: ch.name,
      external_id: ch.external_id || '',
      is_active: ch.is_active,
      metadata: ch.metadata || '{}',
      last_sync_at: ch.last_sync_at,
      last_sync_status: ch.last_sync_status || '',
      conversation_count: conversationCount,
      created_at: ch.created_at,
    };
  }

  async listChannels(tenantId: string): Promise<ChannelResponse[]> {
    const channels = await this.channelRepo.find({
      where: { tenant_id: tenantId },
      order: { created_at: 'DESC' },
    });

    // Get conversation counts per channel
    const counts = await this.conversationRepo
      .createQueryBuilder('c')
      .select('c.channel_id', 'channel_id')
      .addSelect('COUNT(*)', 'count')
      .where('c.tenant_id = :tenantId', { tenantId })
      .groupBy('c.channel_id')
      .getRawMany();

    const countMap: Record<string, number> = {};
    for (const row of counts) {
      countMap[row.channel_id] = parseInt(row.count, 10);
    }

    return channels.map((ch) =>
      this.channelToResponse(ch, countMap[ch.id] || 0),
    );
  }

  async createChannel(
    tenantId: string,
    dto: CreateChannelDto,
  ): Promise<ChannelResponse> {
    let credentialsToStore = this.encryptCredentials(dto.credentials);
    let externalId = '';
    let channelName = dto.name;

    // For Facebook: exchange user/system token for Page Access Token
    if (dto.channel_type === 'facebook') {
      const fbCreds = dto.credentials as {
        page_id?: string;
        access_token?: string;
      };
      if (fbCreds.access_token) {
        try {
          const { pageId, pageToken, pageName } = await this.getFBPageToken(
            fbCreds.access_token,
            fbCreds.page_id || '',
          );
          // Exchange succeeded -- use the page token
          const updatedCreds = {
            page_id: pageId,
            access_token: pageToken,
          };
          if (pageName) {
            channelName = pageName;
          }
          externalId = pageId;

          credentialsToStore = this.encryptCredentials(updatedCreds);
        } catch (exchangeErr) {
          if (fbCreds.page_id) {
            // Exchange failed but PageID provided -- token might already be a Page Token
            this.logger.warn(
              `getFBPageToken failed for page ${fbCreds.page_id}, using token as-is: ${exchangeErr}`,
            );
            externalId = fbCreds.page_id;
          } else {
            throw new BadRequestException((exchangeErr as Error).message);
          }
        }
      }
    }

    const now = new Date();
    const channel = this.channelRepo.create({
      id: newUUID(),
      tenant_id: tenantId,
      channel_type: dto.channel_type,
      name: channelName,
      external_id: externalId,
      credentials_encrypted: credentialsToStore,
      is_active: true,
      metadata: dto.metadata || '{}',
      created_at: now,
      updated_at: now,
    });

    await this.channelRepo.save(channel);
    return this.channelToResponse(channel);
  }

  async getChannel(
    tenantId: string,
    channelId: string,
  ): Promise<ChannelResponse> {
    const channel = await this.channelRepo.findOne({
      where: { id: channelId, tenant_id: tenantId },
    });
    if (!channel) {
      throw new NotFoundException({ error: 'channel_not_found' });
    }

    const convCount = await this.conversationRepo.count({
      where: { channel_id: channelId, tenant_id: tenantId },
    });

    return this.channelToResponse(channel, convCount);
  }

  async updateChannel(
    tenantId: string,
    channelId: string,
    dto: UpdateChannelDto,
  ): Promise<{ message: string }> {
    const updates: Record<string, any> = { updated_at: new Date() };
    if (dto.name) {
      updates.name = dto.name;
    }
    if (dto.is_active !== undefined) {
      updates.is_active = dto.is_active;
    }
    if (dto.metadata) {
      updates.metadata = dto.metadata;
    }

    const result = await this.channelRepo.update(
      { id: channelId, tenant_id: tenantId },
      updates,
    );

    if (result.affected === 0) {
      throw new NotFoundException({ error: 'channel_not_found' });
    }

    return { message: 'updated' };
  }

  async deleteChannel(
    tenantId: string,
    channelId: string,
    userId?: string,
    userEmail?: string,
    ipAddress?: string,
  ): Promise<{ message: string }> {
    const channel = await this.channelRepo.findOne({
      where: { id: channelId, tenant_id: tenantId },
    });
    if (!channel) {
      throw new NotFoundException({ error: 'channel_not_found' });
    }

    // Cascade: delete messages -> conversations -> channel
    const convIds: string[] = (
      await this.conversationRepo.find({
        where: { channel_id: channelId, tenant_id: tenantId },
        select: ['id'],
      })
    ).map((c) => c.id);

    if (convIds.length > 0) {
      await this.messageRepo.delete({
        conversation_id: In(convIds),
        tenant_id: tenantId,
      });
    }
    await this.conversationRepo.delete({
      channel_id: channelId,
      tenant_id: tenantId,
    });
    await this.channelRepo.delete({ id: channelId });

    await this.logActivity(
      tenantId,
      userId,
      userEmail,
      'channel.delete',
      'channel',
      channelId,
      `Deleted channel: ${channel.name}`,
      '',
      ipAddress,
    );

    return { message: 'deleted' };
  }

  async testChannel(
    tenantId: string,
    channelId: string,
  ): Promise<{ status: string; message: string }> {
    const channel = await this.channelRepo.findOne({
      where: { id: channelId, tenant_id: tenantId },
    });
    if (!channel) {
      throw new NotFoundException({ error: 'channel_not_found' });
    }

    const creds = this.decryptCredentials(channel);
    const adapter = createAdapter(channel.channel_type, JSON.stringify(creds));
    await adapter.healthCheck();

    return { status: 'ok', message: 'connection_successful' };
  }

  async syncChannel(
    tenantId: string,
    channelId: string,
  ): Promise<{ message: string }> {
    const channel = await this.channelRepo.findOne({
      where: { id: channelId, tenant_id: tenantId },
    });
    if (!channel) {
      throw new NotFoundException({ error: 'channel_not_found' });
    }

    // Mark channel as syncing immediately
    await this.channelRepo.update(
      { id: channelId },
      {
        last_sync_status: 'syncing',
        last_sync_error: '',
        updated_at: new Date(),
      },
    );

    // Run sync in background (thin wrapper -- full sync logic is in the engine module)
    // For now we just mark and return; the engine module will be implemented separately.
    setImmediate(async () => {
      try {
        // Placeholder for engine.SyncChannel(channel)
        // The engine module will decrypt creds, create adapter, and orchestrate sync
        this.logger.log(
          `Sync started for channel ${channelId} (${channel.name})`,
        );
      } catch (err) {
        this.logger.error(
          `Sync channel ${channelId} failed: ${err}`,
        );
        await this.channelRepo.update(
          { id: channelId },
          {
            last_sync_status: 'error',
            last_sync_error: String(err),
            updated_at: new Date(),
          },
        );
      }
    });

    return { message: 'sync_started' };
  }

  async reauthChannel(
    tenantId: string,
    channelId: string,
    baseUrl: string,
  ): Promise<{ redirect_url: string }> {
    const channel = await this.channelRepo.findOne({
      where: { id: channelId, tenant_id: tenantId },
    });
    if (!channel) {
      throw new NotFoundException({ error: 'Channel not found' });
    }

    const creds = this.decryptCredentials(channel);
    const jwtSecret = this.configService.get<string>('jwt.secret', '');
    const state = this.signOAuthState(tenantId, channelId, jwtSecret);

    let redirectUrl: string;
    switch (channel.channel_type) {
      case 'zalo_oa': {
        const appId = creds.app_id;
        const callbackUrl = `${baseUrl}/api/v1/channels/zalo/callback`;
        redirectUrl = `https://oauth.zaloapp.com/v4/oa/permission?app_id=${appId}&redirect_uri=${encodeURIComponent(callbackUrl)}&state=${state}`;
        break;
      }
      case 'facebook': {
        const appId = creds.app_id;
        const callbackUrl = `${baseUrl}/api/v1/channels/facebook/callback`;
        redirectUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(callbackUrl)}&state=${state}&scope=pages_show_list,pages_messaging,pages_read_engagement,pages_manage_metadata`;
        break;
      }
      default:
        throw new BadRequestException({
          error: 'Channel type does not support re-auth',
        });
    }

    return { redirect_url: redirectUrl };
  }

  async getSyncHistory(
    tenantId: string,
    channelId: string,
    page: number,
    perPage: number,
  ): Promise<{
    data: ActivityLog[];
    total: number;
    page: number;
    per_page: number;
  }> {
    if (page < 1) page = 1;
    if (perPage < 1 || perPage > 100) perPage = 10;

    const qb = this.activityLogRepo
      .createQueryBuilder('al')
      .where('al.tenant_id = :tenantId', { tenantId })
      .andWhere("al.resource_type = 'channel'")
      .andWhere('al.resource_id = :channelId', { channelId })
      .andWhere("al.action LIKE 'sync.%'")
      .orderBy('al.created_at', 'DESC');

    const total = await qb.getCount();
    const data = await qb
      .skip((page - 1) * perPage)
      .take(perPage)
      .getMany();

    return { data, total, page, per_page: perPage };
  }

  async purgeConversations(
    tenantId: string,
    channelId: string,
    userId?: string,
    userEmail?: string,
    ipAddress?: string,
  ): Promise<{
    message: string;
    conversations_deleted: number;
    messages_deleted: number;
  }> {
    const channel = await this.channelRepo.findOne({
      where: { id: channelId, tenant_id: tenantId },
    });
    if (!channel) {
      throw new NotFoundException({ error: 'channel_not_found' });
    }

    // Get all conversation IDs for this channel
    const convIds = (
      await this.conversationRepo.find({
        where: { channel_id: channelId, tenant_id: tenantId },
        select: ['id'],
      })
    ).map((c) => c.id);

    let messagesDeleted = 0;
    let convsDeleted = 0;

    if (convIds.length > 0) {
      // Delete evaluation results linked to these conversations
      await this.jobResultRepo.delete({
        conversation_id: In(convIds),
        tenant_id: tenantId,
      });

      // Delete messages
      const msgResult = await this.messageRepo.delete({
        conversation_id: In(convIds),
        tenant_id: tenantId,
      });
      messagesDeleted = msgResult.affected || 0;
    }

    // Delete conversations
    const convResult = await this.conversationRepo.delete({
      channel_id: channelId,
      tenant_id: tenantId,
    });
    convsDeleted = convResult.affected || 0;

    // Reset sync state so next sync fetches everything from scratch
    await this.channelRepo.update(
      { id: channelId },
      {
        last_sync_at: null,
        last_sync_status: null as any,
        last_sync_error: '',
        updated_at: new Date(),
      },
    );

    await this.logActivity(
      tenantId,
      userId,
      userEmail,
      'channel.purge_conversations',
      'channel',
      channelId,
      `Purged all conversations: ${channel.name} (${convsDeleted} conversations, ${messagesDeleted} messages)`,
      '',
      ipAddress,
    );

    return {
      message: 'purged',
      conversations_deleted: convsDeleted,
      messages_deleted: messagesDeleted,
    };
  }

  // --- Zalo OAuth Callback ---

  async handleZaloCallback(
    code: string,
    state: string,
    baseUrl: string,
  ): Promise<string> {
    const jwtSecret = this.configService.get<string>('jwt.secret', '');
    const { tenantId, channelId } = this.verifyOAuthState(state, jwtSecret);

    const channel = await this.channelRepo.findOne({
      where: { id: channelId, tenant_id: tenantId },
    });
    if (!channel) {
      return this.redirectWithError(tenantId, 'Channel not found');
    }

    let creds: Record<string, string>;
    try {
      creds = this.decryptCredentials(channel);
    } catch {
      return this.redirectWithError(tenantId, 'Authorization failed');
    }

    const appId = creds.app_id;
    const appSecret = creds.app_secret;

    const callbackUrl = `${baseUrl}/api/v1/channels/zalo/callback`;
    let tokenResp: { access_token: string; refresh_token: string };
    try {
      tokenResp = await this.exchangeZaloCode(
        code,
        appId,
        appSecret,
        callbackUrl,
      );
    } catch (err) {
      this.logger.error(
        `zalo token exchange for channel ${channelId}: ${err}`,
      );
      return this.redirectWithError(tenantId, 'Token exchange failed');
    }

    creds.access_token = tokenResp.access_token;
    creds.refresh_token = tokenResp.refresh_token;

    // Fetch OA info
    let oaId = '';
    try {
      const oaInfo = await this.fetchZaloOAInfo(tokenResp.access_token);
      creds.oa_id = oaInfo.oaId;
      creds.oa_name = oaInfo.oaName;
      oaId = oaInfo.oaId;
    } catch {
      // non-fatal
    }

    const encrypted = this.cryptoService.encrypt(
      Buffer.from(JSON.stringify(creds), 'utf-8'),
    );

    const updates: Record<string, any> = {
      credentials_encrypted: encrypted,
      updated_at: new Date(),
    };
    if (oaId) {
      updates.external_id = oaId;
    }
    await this.channelRepo.update({ id: channelId }, updates);

    return `/${tenantId}/channels/${channelId}?zalo_auth=success`;
  }

  // --- Facebook OAuth Callback ---

  async handleFacebookCallback(
    code: string,
    state: string,
    baseUrl: string,
  ): Promise<string> {
    const jwtSecret = this.configService.get<string>('jwt.secret', '');
    const { tenantId, channelId } = this.verifyOAuthState(state, jwtSecret);

    const channel = await this.channelRepo.findOne({
      where: { id: channelId, tenant_id: tenantId },
    });
    if (!channel) {
      return this.redirectWithError(tenantId, 'Channel not found');
    }

    let creds: Record<string, string>;
    try {
      creds = this.decryptCredentials(channel);
    } catch {
      return this.redirectWithError(tenantId, 'Authorization failed');
    }

    const appId = creds.app_id;
    const appSecret = creds.app_secret;

    const callbackUrl = `${baseUrl}/api/v1/channels/facebook/callback`;
    let userToken: string;
    try {
      userToken = await this.exchangeFacebookCode(
        code,
        appId,
        appSecret,
        callbackUrl,
      );
    } catch (err) {
      this.logger.error(
        `facebook token exchange for channel ${channelId}: ${err}`,
      );
      return this.redirectWithError(tenantId, 'Token exchange failed');
    }

    // Step 2: Exchange for long-lived user token
    let longLivedToken: string;
    try {
      longLivedToken = await this.getLongLivedFBToken(
        appId,
        appSecret,
        userToken,
      );
    } catch (err) {
      this.logger.error(
        `facebook long-lived token for channel ${channelId}: ${err}`,
      );
      return this.redirectWithError(tenantId, 'Token exchange failed');
    }

    // Step 3: Get page access token
    let pageId: string;
    let pageToken: string;
    let pageName: string;
    try {
      const result = await this.getFBPageToken(longLivedToken, '');
      pageId = result.pageId;
      pageToken = result.pageToken;
      pageName = result.pageName;
    } catch (err) {
      this.logger.error(
        `facebook get page token for channel ${channelId}: ${err}`,
      );
      return this.redirectWithError(tenantId, 'Page token retrieval failed');
    }

    // Update channel credentials with page token
    creds.access_token = pageToken;
    creds.page_id = pageId;

    const encrypted = this.cryptoService.encrypt(
      Buffer.from(JSON.stringify(creds), 'utf-8'),
    );

    await this.channelRepo.update(
      { id: channelId },
      {
        credentials_encrypted: encrypted,
        external_id: pageId,
        name: pageName,
        updated_at: new Date(),
      },
    );

    return `/${tenantId}/channels/${channelId}?fb_auth=success`;
  }

  // --- Helper methods ---

  private signOAuthState(
    tenantId: string,
    channelId: string,
    secret: string,
  ): string {
    const payload = `${tenantId}:${channelId}`;
    const mac = crypto.createHmac('sha256', secret);
    mac.update(payload);
    const sig = mac.digest('hex').substring(0, 16);
    return `${payload}:${sig}`;
  }

  private verifyOAuthState(
    state: string,
    secret: string,
  ): { tenantId: string; channelId: string } {
    const parts = state.split(':');
    if (parts.length !== 3) {
      throw new BadRequestException('invalid state format');
    }
    const [tenantId, channelId, sig] = parts;
    const payload = `${tenantId}:${channelId}`;
    const mac = crypto.createHmac('sha256', secret);
    mac.update(payload);
    const expected = mac.digest('hex').substring(0, 16);
    if (
      !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
    ) {
      throw new BadRequestException('invalid state signature');
    }
    return { tenantId, channelId };
  }

  private redirectWithError(tenantId: string, message: string): string {
    let path = '/login';
    if (tenantId) {
      path = `/${tenantId}/channels`;
    }
    return `${path}?zalo_auth=error&message=${encodeURIComponent(message)}`;
  }

  private async exchangeZaloCode(
    code: string,
    appId: string,
    appSecret: string,
    redirectUri: string,
  ): Promise<{ access_token: string; refresh_token: string }> {
    const params = new URLSearchParams({
      code,
      app_id: appId,
      grant_type: 'authorization_code',
    });

    const resp = await httpClient.post(
      `https://oauth.zaloapp.com/v4/oa/access_token`,
      params.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          secret_key: appSecret,
        },
      },
    );

    const result = resp.data;
    // Check for error (can be int or string)
    const errVal = String(result.error ?? '0');
    if (errVal !== '0' && errVal !== '"0"' && errVal !== '') {
      throw new Error(
        `zalo error ${result.error}: ${result.message}`,
      );
    }
    if (!result.access_token) {
      throw new Error('empty access token');
    }

    return {
      access_token: result.access_token,
      refresh_token: result.refresh_token,
    };
  }

  private async fetchZaloOAInfo(
    accessToken: string,
  ): Promise<{ oaId: string; oaName: string }> {
    const resp = await httpClient.get(
      'https://openapi.zalo.me/v2.0/oa/getoa',
      { headers: { access_token: accessToken } },
    );
    const result = resp.data;
    if (result.error && result.error !== 0) {
      throw new Error(
        `zalo getoa error ${result.error}: ${result.message}`,
      );
    }
    return {
      oaId: result.data?.oa_id || '',
      oaName: result.data?.name || '',
    };
  }

  private async exchangeFacebookCode(
    code: string,
    appId: string,
    appSecret: string,
    redirectUri: string,
  ): Promise<string> {
    const resp = await httpClient.post(
      'https://graph.facebook.com/v21.0/oauth/access_token',
      new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        redirect_uri: redirectUri,
        code,
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );

    const result = resp.data;
    if (result.error?.message) {
      throw new Error(`facebook error: ${result.error.message}`);
    }
    if (!result.access_token) {
      throw new Error('empty access token');
    }
    return result.access_token;
  }

  private async getLongLivedFBToken(
    appId: string,
    appSecret: string,
    shortToken: string,
  ): Promise<string> {
    const url = `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortToken}`;
    const resp = await httpClient.get(url);
    const result = resp.data;
    if (result.error?.message) {
      throw new Error(`facebook error: ${result.error.message}`);
    }
    if (!result.access_token) {
      throw new Error('empty long-lived token');
    }
    return result.access_token;
  }

  private async getFBPageToken(
    userToken: string,
    targetPageId: string,
  ): Promise<{ pageId: string; pageToken: string; pageName: string }> {
    const url = `https://graph.facebook.com/v21.0/me/accounts?access_token=${userToken}&fields=id,name,access_token`;
    const resp = await httpClient.get(url);
    const result = resp.data;

    if (result.error?.message) {
      throw new Error(`facebook error: ${result.error.message}`);
    }

    const data = result.data as any[];
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error(
        'no pages found - make sure you have admin access to a Facebook Page',
      );
    }

    // If targetPageId specified, find that specific page
    if (targetPageId) {
      for (const page of data) {
        if (page.id === targetPageId) {
          return {
            pageId: page.id,
            pageToken: page.access_token || '',
            pageName: page.name || '',
          };
        }
      }
      throw new Error(
        `page ${targetPageId} not found in your account - make sure you have admin access to this page`,
      );
    }

    // No target: use first page
    const page = data[0];
    return {
      pageId: page.id || '',
      pageToken: page.access_token || '',
      pageName: page.name || '',
    };
  }

  private encryptCredentials(creds: Record<string, any>): Buffer {
    return this.cryptoService.encrypt(
      Buffer.from(JSON.stringify(creds), 'utf-8'),
    );
  }

  private decryptCredentials(channel: Channel): Record<string, string> {
    const credBytes = this.cryptoService.decrypt(channel.credentials_encrypted);
    return JSON.parse(credBytes.toString('utf-8'));
  }

  getBaseUrl(req: any): string {
    const proto =
      req.headers?.['x-forwarded-proto'] ||
      (req.secure ? 'https' : 'http');
    return `${proto}://${req.headers?.host || 'localhost'}`;
  }

  private async logActivity(
    tenantId: string,
    userId?: string,
    userEmail?: string,
    action?: string,
    resourceType?: string,
    resourceId?: string,
    detail?: string,
    errorMessage?: string,
    ipAddress?: string,
  ): Promise<void> {
    const log = this.activityLogRepo.create({
      id: newUUID(),
      tenant_id: tenantId,
      user_id: userId || '',
      user_email: userEmail || '',
      action: action || '',
      resource_type: resourceType || '',
      resource_id: resourceId || '',
      detail: detail || '',
      error_message: errorMessage || '',
      ip_address: ipAddress || '',
      created_at: new Date(),
    });
    await this.activityLogRepo.save(log);
  }
}
