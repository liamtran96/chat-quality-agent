import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { CryptoService } from '../common/crypto/crypto.service';
import { newUUID } from '../common/helpers/uuid.helper';
import {
  Channel,
  Conversation,
  Message,
  ActivityLog,
} from '../entities';
import {
  ChannelAdapter,
  SyncedConversation,
  SyncedMessage,
  isTokenRefreshable,
} from './channel-adapter.interface';

/**
 * Factory function type for creating channel adapters.
 * In production, this would be injected; for testing, a mock can be provided.
 */
export type AdapterFactory = (
  channelType: string,
  credentials: Buffer,
) => ChannelAdapter;

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private adapterFactory: AdapterFactory | null = null;

  constructor(
    @InjectRepository(Channel)
    private readonly channelRepo: Repository<Channel>,
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    @InjectRepository(ActivityLog)
    private readonly activityLogRepo: Repository<ActivityLog>,
    private readonly cryptoService: CryptoService,
  ) {}

  /** Set adapter factory for creating channel adapters. */
  setAdapterFactory(factory: AdapterFactory): void {
    this.adapterFactory = factory;
  }

  /**
   * SyncChannel syncs a single channel: fetches conversations + messages and upserts into DB.
   */
  async syncChannel(channel: Channel): Promise<void> {
    this.logger.log(
      `starting sync for channel ${channel.name} (${channel.channel_type})`,
    );

    // Decrypt credentials
    let credBytes: Buffer;
    try {
      credBytes = this.cryptoService.decrypt(channel.credentials_encrypted);
    } catch (err) {
      await this.updateSyncStatus(
        channel.id,
        'error',
        `decrypt failed: ${(err as Error).message}`,
        channel.tenant_id,
        channel.name,
      );
      return;
    }

    // Create adapter
    if (!this.adapterFactory) {
      await this.updateSyncStatus(
        channel.id,
        'error',
        'adapter factory not configured',
        channel.tenant_id,
        channel.name,
      );
      return;
    }

    let adapter: ChannelAdapter;
    try {
      adapter = this.adapterFactory(channel.channel_type, credBytes);
    } catch (err) {
      await this.updateSyncStatus(
        channel.id,
        'error',
        `adapter init failed: ${(err as Error).message}`,
        channel.tenant_id,
        channel.name,
      );
      return;
    }

    // Set token refresh callback for Zalo-like adapters
    if (isTokenRefreshable(adapter)) {
      const chId = channel.id;
      adapter.setTokenRefreshCallback(
        async (newAccess: string, newRefresh: string) => {
          try {
            const ch = await this.channelRepo.findOne({
              where: { id: chId },
            });
            if (!ch) return;

            const oldCreds = this.cryptoService.decrypt(
              ch.credentials_encrypted,
            );
            const credsMap = JSON.parse(oldCreds.toString('utf-8'));
            credsMap.access_token = newAccess;
            credsMap.refresh_token = newRefresh;

            const newCredJSON = Buffer.from(JSON.stringify(credsMap), 'utf-8');
            const encrypted = this.cryptoService.encrypt(newCredJSON);

            await this.channelRepo.update(chId, {
              credentials_encrypted: encrypted,
            });
            this.logger.log(
              `persisted refreshed tokens for channel ${chId}`,
            );
          } catch (err) {
            this.logger.error(
              `token refresh persist failed: ${(err as Error).message}`,
            );
          }
        },
      );
    }

    // Determine since -- use last_sync_at minus 1h buffer, or 7 days ago
    let since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    if (channel.last_sync_at) {
      since = new Date(
        new Date(channel.last_sync_at).getTime() - 60 * 60 * 1000,
      );
    }

    // Fetch recent conversations
    let conversations: SyncedConversation[];
    try {
      conversations = await adapter.fetchRecentConversations(
        undefined,
        since,
        100,
      );
    } catch (err) {
      await this.updateSyncStatus(
        channel.id,
        'error',
        `fetch conversations failed: ${(err as Error).message}`,
        channel.tenant_id,
        channel.name,
      );
      return;
    }

    this.logger.log(
      `channel ${channel.name}: found ${conversations.length} conversations`,
    );

    // Check if file sync is enabled
    let syncFiles = false;
    if (channel.metadata) {
      try {
        const meta = JSON.parse(channel.metadata);
        if (meta.sync_files === true) {
          syncFiles = true;
        }
      } catch {
        // ignore
      }
    }
    this.logger.log(
      `channel ${channel.name}: sync_files=${syncFiles}`,
    );

    let totalMessages = 0;
    for (const conv of conversations) {
      // Upsert conversation
      let convId: string;
      try {
        convId = await this.upsertConversation(
          channel.tenant_id,
          channel.id,
          conv,
        );
      } catch (err) {
        this.logger.warn(
          `error upserting conversation ${conv.externalId}: ${(err as Error).message}`,
        );
        continue;
      }

      // Fetch messages
      let messages: SyncedMessage[];
      try {
        messages = await adapter.fetchMessages(
          undefined,
          conv.externalId,
          since,
        );
      } catch (err) {
        this.logger.warn(
          `error fetching messages for ${conv.externalId}: ${(err as Error).message}`,
        );
        continue;
      }

      // Upsert messages
      for (const msg of messages) {
        if (syncFiles) {
          await this.downloadAttachments(channel.tenant_id, convId, msg);
        }
        try {
          await this.upsertMessage(channel.tenant_id, convId, msg);
          totalMessages++;
        } catch (err) {
          this.logger.warn(
            `error upserting message ${msg.externalId}: ${(err as Error).message}`,
          );
        }
      }

      // Update conversation message count
      const msgCount = await this.messageRepo.count({
        where: { conversation_id: convId },
      });
      await this.conversationRepo.update(convId, { message_count: msgCount });
    }

    this.logger.log(
      `channel ${channel.name}: synced ${conversations.length} conversations, ${totalMessages} messages`,
    );

    // Log activity
    await this.logActivity({
      tenantId: channel.tenant_id,
      action: 'sync.completed',
      resourceType: 'channel',
      resourceId: channel.id,
      detail: `Sync '${channel.name}': ${conversations.length} conversations, ${totalMessages} messages`,
    });

    await this.updateSyncStatus(
      channel.id,
      'success',
      '',
      channel.tenant_id,
    );
  }

  /**
   * SyncAllChannels syncs all active channels for a tenant.
   */
  async syncAllChannels(tenantId?: string): Promise<void> {
    const where: Record<string, unknown> = { is_active: true };
    if (tenantId) {
      where.tenant_id = tenantId;
    }

    const channels = await this.channelRepo.find({ where });
    for (const ch of channels) {
      try {
        await this.syncChannel(ch);
      } catch (err) {
        this.logger.warn(
          `channel ${ch.name} failed: ${(err as Error).message}`,
        );
      }
    }
  }

  /**
   * Upsert a conversation: dedup by external_conversation_id.
   */
  private async upsertConversation(
    tenantId: string,
    channelId: string,
    conv: SyncedConversation,
  ): Promise<string> {
    const existing = await this.conversationRepo.findOne({
      where: {
        tenant_id: tenantId,
        channel_id: channelId,
        external_conversation_id: conv.externalId,
      },
    });

    const metadataJSON = JSON.stringify(conv.metadata);

    if (existing) {
      await this.conversationRepo.update(existing.id, {
        customer_name: conv.customerName,
        last_message_at: conv.lastMessageAt,
        metadata: metadataJSON,
        updated_at: new Date(),
      });
      return existing.id;
    }

    const newConv = this.conversationRepo.create({
      id: newUUID(),
      tenant_id: tenantId,
      channel_id: channelId,
      external_conversation_id: conv.externalId,
      external_user_id: conv.externalUserId,
      customer_name: conv.customerName,
      last_message_at: conv.lastMessageAt,
      message_count: 0,
      metadata: metadataJSON,
      created_at: new Date(),
      updated_at: new Date(),
    });
    await this.conversationRepo.save(newConv);
    return newConv.id;
  }

  /**
   * Upsert a message: dedup by external_message_id.
   */
  private async upsertMessage(
    tenantId: string,
    conversationId: string,
    msg: SyncedMessage,
  ): Promise<void> {
    const existing = await this.messageRepo.findOne({
      where: {
        tenant_id: tenantId,
        conversation_id: conversationId,
        external_message_id: msg.externalId,
      },
    });

    if (existing) {
      // Update attachments if we have new local paths
      const hasLocalPath = msg.attachments.some(
        (att) => att.local_path && att.local_path !== '',
      );
      if (hasLocalPath) {
        await this.messageRepo.update(existing.id, {
          attachments: JSON.stringify(msg.attachments),
        });
      }
      return;
    }

    const attachmentsJSON = JSON.stringify(msg.attachments);
    const rawDataJSON = JSON.stringify(msg.rawData);

    const message = this.messageRepo.create({
      id: newUUID(),
      tenant_id: tenantId,
      conversation_id: conversationId,
      external_message_id: msg.externalId,
      sender_type: msg.senderType,
      sender_name: msg.senderName,
      content: msg.content,
      content_type: msg.contentType,
      attachments: attachmentsJSON,
      sent_at: msg.sentAt,
      raw_data: rawDataJSON,
      created_at: new Date(),
    });
    await this.messageRepo.save(message);
  }

  /**
   * Update channel sync status.
   */
  private async updateSyncStatus(
    channelId: string,
    status: string,
    errMsg: string,
    tenantId?: string,
    channelName?: string,
  ): Promise<void> {
    const now = new Date();
    await this.channelRepo.update(channelId, {
      last_sync_at: now,
      last_sync_status: status,
      last_sync_error: errMsg,
      updated_at: now,
    });

    if (errMsg && tenantId) {
      await this.logActivity({
        tenantId,
        action: 'sync.error',
        resourceType: 'channel',
        resourceId: channelId,
        detail: `Sync failed: ${channelName ?? channelId}`,
        errorMessage: errMsg,
      });
    }
  }

  /**
   * Download attachment files from URLs to local storage.
   */
  private async downloadAttachments(
    tenantId: string,
    convId: string,
    msg: SyncedMessage,
  ): Promise<void> {
    for (let i = 0; i < msg.attachments.length; i++) {
      const att = msg.attachments[i];
      if (!att.url) continue;

      // Create directory
      const dir = path.join('/var/lib/cqa/files', tenantId, convId);
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (err) {
        this.logger.warn(
          `mkdir failed for ${dir}: ${(err as Error).message}`,
        );
        continue;
      }

      // Generate filename -- sanitize to prevent path traversal
      let name = att.name ? path.basename(att.name) : '';
      if (!name || name === '.' || name === '/') {
        name = `${att.type}-${Date.now()}`;
      }
      const localPath = path.join(dir, name);

      // Verify path stays within intended directory
      const cleanLocalPath = path.resolve(localPath);
      const cleanDir = path.resolve(dir) + path.sep;
      if (!cleanLocalPath.startsWith(cleanDir)) {
        this.logger.warn(
          `[security] path traversal blocked: att.name=${att.name} resolved=${localPath}`,
        );
        continue;
      }

      try {
        await this.downloadFile(att.url, localPath);
        msg.attachments[i].local_path = path.join(tenantId, convId, name);
        this.logger.log(`downloaded ${att.url} -> ${localPath}`);
      } catch (err) {
        this.logger.warn(
          `download failed for ${att.url}: ${(err as Error).message}`,
        );
      }
    }
  }

  /** Download a file from URL with 30s timeout. */
  private async downloadFile(url: string, localPath: string): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(localPath, buffer);
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Log an activity. */
  private async logActivity(opts: {
    tenantId: string;
    action: string;
    resourceType: string;
    resourceId: string;
    detail?: string;
    errorMessage?: string;
  }): Promise<void> {
    try {
      await this.activityLogRepo.save({
        id: newUUID(),
        tenant_id: opts.tenantId,
        user_email: 'system',
        action: opts.action,
        resource_type: opts.resourceType,
        resource_id: opts.resourceId,
        detail: opts.detail ?? '',
        error_message: opts.errorMessage ?? '',
        ip_address: '',
        created_at: new Date(),
      });
    } catch (err) {
      this.logger.error(
        `Failed to log activity: ${(err as Error).message}`,
      );
    }
  }
}
