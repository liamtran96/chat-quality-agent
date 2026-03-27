/**
 * SyncedConversation represents a conversation fetched from an external channel.
 */
export interface SyncedConversation {
  externalId: string;
  externalUserId: string;
  customerName: string;
  lastMessageAt: Date;
  metadata: Record<string, unknown>;
}

/**
 * Attachment represents a media attachment in a message.
 */
export interface Attachment {
  type: string; // image, file, video, sticker
  url: string;
  name?: string;
  local_path?: string; // relative path on server
}

/**
 * SyncedMessage represents a message fetched from an external channel.
 */
export interface SyncedMessage {
  externalId: string;
  senderType: string; // "customer" | "agent" | "system"
  senderName: string;
  content: string;
  contentType: string; // "text" | "image" | "file" | "sticker" | "gif"
  attachments: Attachment[];
  sentAt: Date;
  rawData: Record<string, unknown>;
}

/**
 * ChannelAdapter defines the interface for fetching data from external chat channels.
 */
export interface ChannelAdapter {
  fetchRecentConversations(
    signal: AbortSignal | undefined,
    since: Date,
    limit: number,
  ): Promise<SyncedConversation[]>;

  fetchMessages(
    signal: AbortSignal | undefined,
    conversationId: string,
    since: Date,
  ): Promise<SyncedMessage[]>;

  healthCheck(signal: AbortSignal | undefined): Promise<void>;
}

/**
 * Token refresh callback for adapters that support token refresh (e.g., Zalo OA).
 */
export type TokenRefreshCallback = (
  newAccessToken: string,
  newRefreshToken: string,
) => void;

/**
 * Adapter with token refresh support.
 */
export interface TokenRefreshableAdapter extends ChannelAdapter {
  setTokenRefreshCallback(callback: TokenRefreshCallback): void;
}

/**
 * Check if an adapter supports token refresh.
 */
export function isTokenRefreshable(
  adapter: ChannelAdapter,
): adapter is TokenRefreshableAdapter {
  return 'setTokenRefreshCallback' in adapter;
}
