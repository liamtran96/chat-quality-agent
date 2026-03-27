import axios, { AxiosInstance } from 'axios';
import { Mutex } from 'async-mutex';
import {
  ChannelAdapter,
  SyncedConversation,
  SyncedMessage,
  Attachment,
  OnTokenRefresh,
} from './channel-adapter.interface';
import { Logger } from '@nestjs/common';

const ZALO_API_BASE_V2 = 'https://openapi.zalo.me/v2.0/oa';
const ZALO_OAUTH_URL = 'https://oauth.zaloapp.com/v4/oa/access_token';

export interface ZaloOACredentials {
  app_id: string;
  app_secret: string;
  access_token: string;
  refresh_token: string;
  oa_id?: string;
}

export class ZaloOAAdapter implements ChannelAdapter {
  private readonly logger = new Logger(ZaloOAAdapter.name);
  private creds: ZaloOACredentials;
  private readonly client: AxiosInstance;
  private readonly mu = new Mutex();
  private onTokenRefresh: OnTokenRefresh | null = null;

  constructor(creds: ZaloOACredentials) {
    this.creds = { ...creds };
    this.client = axios.create({ timeout: 30_000 });
  }

  setTokenRefreshCallback(cb: OnTokenRefresh): void {
    this.onTokenRefresh = cb;
  }

  /**
   * refreshToken performs Zalo token refresh (single-use rotation).
   * Must be called within mutex to prevent concurrent refresh attempts.
   */
  private async refreshToken(): Promise<void> {
    const release = await this.mu.acquire();
    try {
      const params = new URLSearchParams({
        refresh_token: this.creds.refresh_token,
        app_id: this.creds.app_id,
        grant_type: 'refresh_token',
      });

      const resp = await this.client.post(
        `${ZALO_OAUTH_URL}?${params.toString()}`,
        null,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            secret_key: this.creds.app_secret,
          },
        },
      );

      const result = resp.data;
      if (result.error && result.error !== 0) {
        throw new Error(
          `zalo token refresh error ${result.error}: ${result.message}`,
        );
      }

      this.creds.access_token = result.access_token;
      this.creds.refresh_token = result.refresh_token;

      if (this.onTokenRefresh) {
        this.onTokenRefresh(result.access_token, result.refresh_token);
      }
    } finally {
      release();
    }
  }

  /**
   * doRequest makes an authenticated Zalo API request with auto-retry on token expiry.
   * Zalo API: params go as JSON-encoded `data` query param.
   */
  private async doRequest(
    method: 'GET' | 'POST',
    apiUrl: string,
    params?: Record<string, any>,
  ): Promise<Record<string, any>> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const queryParams: Record<string, string> = {};
      if (params) {
        queryParams.data = JSON.stringify(params);
      }

      let token: string;
      const release = await this.mu.acquire();
      token = this.creds.access_token;
      release();

      const resp = await this.client.request({
        method,
        url: apiUrl,
        params: queryParams,
        headers: {
          access_token: token,
        },
      });

      const result = resp.data;
      this.logger.debug(
        `[zalo] API ${apiUrl}: status=${resp.status} len=${JSON.stringify(result).length}`,
      );

      // Check for token expired error (error=-216)
      if (result.error === -216 && attempt === 0) {
        await this.refreshToken();
        continue;
      }

      if (result.error && result.error !== 0) {
        const msg = result.message || '';
        throw new Error(`zalo api error ${result.error}: ${msg}`);
      }

      return result;
    }
    throw new Error('zalo api failed after retry');
  }

  async fetchRecentConversations(
    since: Date,
    limit: number,
  ): Promise<SyncedConversation[]> {
    const conversations: SyncedConversation[] = [];
    let offset = 0;
    const pageSize = 10; // Zalo max is 10

    while (true) {
      if (limit > 0 && conversations.length >= limit) {
        break;
      }

      const result = await this.doRequest(
        'GET',
        `${ZALO_API_BASE_V2}/listrecentchat`,
        { offset, count: pageSize },
      );

      const data = extractZaloDataArray(result);
      this.logger.debug(
        `[zalo] extractZaloDataArray returned ${data.length} items`,
      );
      if (data.length === 0) {
        break;
      }

      for (const item of data) {
        const conv = item as Record<string, any>;

        // Zalo listrecentchat: src=0 means OA sent (from=OA, to=customer), src=1 means customer sent
        let userId: string;
        let displayName: string;
        const src = conv.src as number;
        if (src === 0) {
          // OA sent last message -> customer is "to"
          userId = conv.to_id || '';
          displayName = conv.to_display_name || '';
        } else {
          // Customer sent last message -> customer is "from"
          userId = conv.from_id || '';
          displayName = conv.from_display_name || '';
        }

        // Parse timestamp (Zalo uses milliseconds)
        let lastMsgAt = new Date(0);
        if (typeof conv.time === 'number') {
          lastMsgAt = new Date(conv.time);
        }

        conversations.push({
          externalId: userId, // Zalo uses user_id as conversation key
          externalUserId: userId,
          customerName: displayName,
          lastMessageAt: lastMsgAt,
          metadata: conv,
        });
      }

      if (data.length < pageSize) {
        break;
      }
      offset += pageSize;
    }

    return conversations;
  }

  async fetchMessages(
    conversationId: string,
    since: Date,
  ): Promise<SyncedMessage[]> {
    const messages: SyncedMessage[] = [];
    let offset = 0;
    const pageSize = 10;

    while (true) {
      const result = await this.doRequest(
        'GET',
        `${ZALO_API_BASE_V2}/conversation`,
        { user_id: conversationId, offset, count: pageSize },
      );

      const data = extractZaloDataArray(result);
      if (data.length === 0) {
        break;
      }

      for (const item of data) {
        const msg = item as Record<string, any>;

        let sentAt = new Date(0);
        if (typeof msg.time === 'number') {
          sentAt = new Date(msg.time);
        }

        const msgId = String(msg.message_id ?? '');
        const content = (msg.message as string) || '';
        let senderType: 'customer' | 'agent' | 'system' = 'customer';
        let senderName = '';

        if (typeof msg.src === 'number' && msg.src === 0) {
          senderType = 'agent';
          senderName = 'OA';
        }
        if (senderType === 'customer' && msg.from_display_name) {
          senderName = msg.from_display_name;
        }

        const syncedMsg: SyncedMessage = {
          externalId: msgId,
          senderType,
          senderName,
          content,
          contentType: 'text',
          attachments: [],
          sentAt,
          rawData: msg,
        };

        // Check for attachments (image, file, sticker, gif, etc.)
        const msgType = msg.type as string | undefined;
        if (msgType && msgType !== 'text') {
          syncedMsg.contentType = msgType as any;

          // Extract attachment URL from Zalo message
          let aUrl = '';
          let aName = '';
          if (msg.url && typeof msg.url === 'string') {
            aUrl = msg.url;
          } else if (msg.thumb && typeof msg.thumb === 'string') {
            aUrl = msg.thumb;
          }
          // For file type: check links array
          if (Array.isArray(msg.links) && msg.links.length > 0) {
            const link = msg.links[0] as Record<string, any>;
            if (link?.url) {
              aUrl = link.url;
            }
            if (link?.name) {
              aName = link.name;
            }
          }
          if (aUrl) {
            if (!aName) {
              aName = `${msgType}-${msgId}`;
            }
            syncedMsg.attachments.push({
              type: msgType,
              url: aUrl,
              name: aName,
            });
          }
        }

        messages.push(syncedMsg);
      }

      if (data.length < pageSize) {
        break;
      }
      offset += pageSize;
    }

    return messages;
  }

  async healthCheck(): Promise<void> {
    await this.doRequest('GET', `${ZALO_API_BASE_V2}/getoa`);
  }
}

/**
 * extractZaloDataArray handles both {"data": [...]} and {"data": {"data": [...]}} response formats.
 */
function extractZaloDataArray(result: Record<string, any>): any[] {
  if (Array.isArray(result.data)) {
    return result.data;
  }
  if (result.data && typeof result.data === 'object' && Array.isArray(result.data.data)) {
    return result.data.data;
  }
  return [];
}
