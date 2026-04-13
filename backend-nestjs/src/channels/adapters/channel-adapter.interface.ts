/**
 * Attachment represents a media attachment in a message.
 */
export interface Attachment {
  type: string; // image, file, video, sticker
  url: string;
  name?: string;
  size?: number;
  localPath?: string; // relative path on server
}

/**
 * SyncedConversation represents a conversation fetched from an external channel.
 */
export interface SyncedConversation {
  externalId: string;
  externalUserId: string;
  customerName: string;
  lastMessageAt: Date;
  metadata: Record<string, any>;
}

/**
 * SyncedMessage represents a message fetched from an external channel.
 */
export interface SyncedMessage {
  externalId: string;
  senderType: 'customer' | 'agent' | 'system';
  senderName: string;
  content: string;
  contentType: 'text' | 'image' | 'file' | 'sticker' | 'gif' | 'attachment';
  attachments: Attachment[];
  sentAt: Date;
  rawData: Record<string, any>;
}

/**
 * ChannelAdapter defines the interface for fetching data from external chat channels.
 */
export interface ChannelAdapter {
  /**
   * FetchRecentConversations returns conversations updated since `since`, up to `limit`.
   */
  fetchRecentConversations(
    since: Date,
    limit: number,
  ): Promise<SyncedConversation[]>;

  /**
   * FetchMessages returns messages for a conversation since `since`.
   */
  fetchMessages(
    conversationId: string,
    since: Date,
  ): Promise<SyncedMessage[]>;

  /**
   * HealthCheck verifies the channel connection is working.
   */
  healthCheck(): Promise<void>;
}

/**
 * OnTokenRefresh callback - called when tokens are refreshed so caller can persist new creds.
 */
export type OnTokenRefresh = (
  newAccessToken: string,
  newRefreshToken: string,
) => void;
