import axios, { AxiosInstance } from 'axios';
import {
  ChannelAdapter,
  SyncedConversation,
  SyncedMessage,
  Attachment,
} from './channel-adapter.interface';
import { Logger } from '@nestjs/common';

const FB_GRAPH_BASE = 'https://graph.facebook.com/v21.0';

export interface FacebookCredentials {
  page_id: string;
  access_token: string;
}

export class FacebookAdapter implements ChannelAdapter {
  private readonly logger = new Logger(FacebookAdapter.name);
  private readonly creds: FacebookCredentials;
  private readonly client: AxiosInstance;

  constructor(creds: FacebookCredentials) {
    this.creds = { ...creds };
    this.client = axios.create({ timeout: 30_000 });
  }

  private async doRequest(url: string): Promise<Record<string, any>> {
    // Add access_token if not already in URL
    const parsedUrl = new URL(url);
    if (!parsedUrl.searchParams.has('access_token')) {
      parsedUrl.searchParams.set('access_token', this.creds.access_token);
    }

    const resp = await this.client.get(parsedUrl.toString());
    const result = resp.data;

    if (result.error && typeof result.error === 'object') {
      const msg = result.error.message || '';
      const code = result.error.code || 0;
      throw new Error(`facebook api error: (#${code}) ${msg}`);
    }

    return result;
  }

  async fetchRecentConversations(
    since: Date,
    limit: number,
  ): Promise<SyncedConversation[]> {
    const conversations: SyncedConversation[] = [];
    let nextUrl: string | null =
      `${FB_GRAPH_BASE}/${this.creds.page_id}/conversations?fields=id,link,updated_time,participants&limit=100`;

    while (nextUrl) {
      if (limit > 0 && conversations.length >= limit) {
        break;
      }

      const result = await this.doRequest(nextUrl);

      const data = result.data as any[];
      if (!Array.isArray(data) || data.length === 0) {
        break;
      }

      for (const item of data) {
        const conv = item as Record<string, any>;
        const convId = (conv.id as string) || '';

        let updatedAt = new Date(0);
        if (conv.updated_time) {
          updatedAt = new Date(conv.updated_time);
        }

        if (since.getTime() > 0 && updatedAt < since) {
          return conversations; // FB returns sorted by updated_time desc
        }

        // Extract participant name (the non-page user)
        let customerName = '';
        if (conv.participants?.data && Array.isArray(conv.participants.data)) {
          for (const p of conv.participants.data) {
            const participant = p as Record<string, any>;
            const pId = participant.id as string;
            if (pId !== this.creds.page_id) {
              customerName = (participant.name as string) || '';
              break;
            }
          }
        }

        conversations.push({
          externalId: convId,
          externalUserId: convId,
          customerName,
          lastMessageAt: updatedAt,
          metadata: conv,
        });
      }

      // Cursor-based pagination
      nextUrl = null;
      if (result.paging?.next) {
        nextUrl = result.paging.next;
      }
    }

    return conversations;
  }

  async fetchMessages(
    conversationId: string,
    since: Date,
  ): Promise<SyncedMessage[]> {
    const messages: SyncedMessage[] = [];
    let nextUrl: string | null =
      `${FB_GRAPH_BASE}/${conversationId}/messages?fields=id,message,from,to,created_time,attachments,shares,sticker&limit=100`;

    while (nextUrl) {
      const result = await this.doRequest(nextUrl);

      const data = result.data as any[];
      if (!Array.isArray(data) || data.length === 0) {
        break;
      }

      for (const item of data) {
        const msg = item as Record<string, any>;

        let sentAt = new Date(0);
        if (msg.created_time) {
          sentAt = new Date(msg.created_time);
        }

        if (since.getTime() > 0 && sentAt < since) {
          return messages;
        }

        const msgId = (msg.id as string) || '';
        const content = (msg.message as string) || '';

        // Determine sender type
        let senderType: 'customer' | 'agent' | 'system' = 'customer';
        let senderName = '';
        if (msg.from && typeof msg.from === 'object') {
          const fromId = (msg.from.id as string) || '';
          senderName = (msg.from.name as string) || '';
          if (fromId === this.creds.page_id) {
            senderType = 'agent';
          }
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

        // Parse attachments
        if (
          msg.attachments &&
          typeof msg.attachments === 'object' &&
          Array.isArray(msg.attachments.data)
        ) {
          for (const a of msg.attachments.data) {
            const att = a as Record<string, any>;
            const aType = (att.mime_type as string) || '';
            const aName = (att.name as string) || '';
            let aUrl = '';

            if (att.image_data?.url) {
              aUrl = att.image_data.url;
            } else if (att.video_data?.url) {
              aUrl = att.video_data.url;
            } else if (att.file_url) {
              aUrl = att.file_url;
            }
            // Fallback: top-level url field
            if (!aUrl && att.url) {
              aUrl = att.url;
            }
            // Fallback: media.image.src (StoryAttachment format)
            if (!aUrl && att.media?.image?.src) {
              aUrl = att.media.image.src;
            }

            syncedMsg.attachments.push({
              type: aType,
              url: aUrl,
              name: aName,
            });
          }

          if (syncedMsg.attachments.length > 0) {
            syncedMsg.contentType = 'attachment';
          }
        }

        // Sticker
        if (msg.sticker) {
          syncedMsg.contentType = 'sticker';
        }

        messages.push(syncedMsg);
      }

      // Cursor pagination
      nextUrl = null;
      if (result.paging?.next) {
        nextUrl = result.paging.next;
      }
    }

    return messages;
  }

  async healthCheck(): Promise<void> {
    const url = `${FB_GRAPH_BASE}/${this.creds.page_id}?fields=id,name`;
    await this.doRequest(url);
  }
}
