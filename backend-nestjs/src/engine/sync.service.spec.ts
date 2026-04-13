import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SyncService } from './sync.service';
import { CryptoService } from '../common/crypto/crypto.service';
import { Channel, Conversation, Message, ActivityLog } from '../entities';
import {
  ChannelAdapter,
  SyncedConversation,
  SyncedMessage,
} from './channel-adapter.interface';

// ---------------------------------------------------------------------------
// Mock channel adapter
// ---------------------------------------------------------------------------

class MockChannelAdapter implements ChannelAdapter {
  constructor(
    private readonly conversations: SyncedConversation[],
    private readonly messages: Map<string, SyncedMessage[]>,
  ) {}

  async fetchRecentConversations(
    _signal: AbortSignal | undefined,
    _since: Date,
    _limit: number,
  ): Promise<SyncedConversation[]> {
    return this.conversations;
  }

  async fetchMessages(
    _signal: AbortSignal | undefined,
    conversationId: string,
    _since: Date,
  ): Promise<SyncedMessage[]> {
    return this.messages.get(conversationId) || [];
  }

  async healthCheck(): Promise<void> {}
}

// ---------------------------------------------------------------------------
// Repository mock factory
// ---------------------------------------------------------------------------

function createMockRepository() {
  return {
    create: jest.fn((entity) => entity),
    save: jest.fn((entity) => Promise.resolve(entity)),
    update: jest.fn(() => Promise.resolve({ affected: 1 })),
    findOne: jest.fn(() => Promise.resolve(null)),
    find: jest.fn(() => Promise.resolve([])),
    count: jest.fn(() => Promise.resolve(0)),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SyncService', () => {
  let service: SyncService;
  let channelRepo: any;
  let conversationRepo: any;
  let messageRepo: any;
  let activityLogRepo: any;
  let cryptoService: any;

  beforeEach(async () => {
    channelRepo = createMockRepository();
    conversationRepo = createMockRepository();
    messageRepo = createMockRepository();
    activityLogRepo = createMockRepository();
    cryptoService = {
      encrypt: jest.fn((data: Buffer) => data),
      decrypt: jest.fn((data: Buffer) => data),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncService,
        {
          provide: getRepositoryToken(Channel),
          useValue: channelRepo,
        },
        {
          provide: getRepositoryToken(Conversation),
          useValue: conversationRepo,
        },
        {
          provide: getRepositoryToken(Message),
          useValue: messageRepo,
        },
        {
          provide: getRepositoryToken(ActivityLog),
          useValue: activityLogRepo,
        },
        {
          provide: CryptoService,
          useValue: cryptoService,
        },
      ],
    }).compile();

    service = module.get<SyncService>(SyncService);
  });

  describe('syncChannel', () => {
    it('should sync conversations and messages', async () => {
      const now = new Date();
      const mockConversations: SyncedConversation[] = [
        {
          externalId: 'ext-conv-1',
          externalUserId: 'user-1',
          customerName: 'Test Customer',
          lastMessageAt: now,
          metadata: { source: 'test' },
        },
      ];

      const mockMessages = new Map<string, SyncedMessage[]>();
      mockMessages.set('ext-conv-1', [
        {
          externalId: 'ext-msg-1',
          senderType: 'customer',
          senderName: 'Test Customer',
          content: 'Hello',
          contentType: 'text',
          attachments: [],
          sentAt: new Date(now.getTime() - 5 * 60 * 1000),
          rawData: {},
        },
        {
          externalId: 'ext-msg-2',
          senderType: 'agent',
          senderName: 'Agent',
          content: 'Hi! How can I help?',
          contentType: 'text',
          attachments: [],
          sentAt: new Date(now.getTime() - 3 * 60 * 1000),
          rawData: {},
        },
      ]);

      const mockAdapter = new MockChannelAdapter(
        mockConversations,
        mockMessages,
      );

      service.setAdapterFactory(() => mockAdapter);

      // Conversation not found (new)
      conversationRepo.findOne.mockResolvedValue(null);
      // Message not found (new)
      messageRepo.findOne.mockResolvedValue(null);
      // Message count
      messageRepo.count.mockResolvedValue(2);

      const channel: Channel = {
        id: 'ch-1',
        tenant_id: 'tenant-1',
        channel_type: 'facebook',
        name: 'Test Channel',
        external_id: 'ext-1',
        credentials_encrypted: Buffer.from('{}'),
        is_active: true,
        last_sync_at: null,
        last_sync_status: '',
        last_sync_error: '',
        metadata: '{}',
        created_at: new Date(),
        updated_at: new Date(),
      };

      await service.syncChannel(channel);

      // Should have created 1 conversation
      expect(conversationRepo.save).toHaveBeenCalledTimes(1);
      const savedConv = conversationRepo.save.mock.calls[0][0];
      expect(savedConv.external_conversation_id).toBe('ext-conv-1');
      expect(savedConv.customer_name).toBe('Test Customer');

      // Should have created 2 messages
      expect(messageRepo.save).toHaveBeenCalledTimes(2);

      // Should have updated message count
      expect(conversationRepo.update).toHaveBeenCalledWith(
        expect.any(String),
        { message_count: 2 },
      );

      // Should have updated sync status
      expect(channelRepo.update).toHaveBeenCalledWith('ch-1', {
        last_sync_at: expect.any(Date),
        last_sync_status: 'success',
        last_sync_error: '',
        updated_at: expect.any(Date),
      });
    });

    it('should upsert existing conversations', async () => {
      const now = new Date();
      const mockConversations: SyncedConversation[] = [
        {
          externalId: 'ext-conv-1',
          externalUserId: 'user-1',
          customerName: 'Updated Name',
          lastMessageAt: now,
          metadata: {},
        },
      ];

      const mockAdapter = new MockChannelAdapter(
        mockConversations,
        new Map(),
      );
      service.setAdapterFactory(() => mockAdapter);

      // Conversation already exists
      conversationRepo.findOne.mockResolvedValue({
        id: 'existing-conv-id',
        tenant_id: 'tenant-1',
        channel_id: 'ch-1',
        external_conversation_id: 'ext-conv-1',
      });

      const channel: Channel = {
        id: 'ch-1',
        tenant_id: 'tenant-1',
        channel_type: 'facebook',
        name: 'Test Channel',
        external_id: 'ext-1',
        credentials_encrypted: Buffer.from('{}'),
        is_active: true,
        last_sync_at: new Date(Date.now() - 3600000),
        last_sync_status: 'success',
        last_sync_error: '',
        metadata: '{}',
        created_at: new Date(),
        updated_at: new Date(),
      };

      await service.syncChannel(channel);

      // Should have updated existing conversation (not created new)
      expect(conversationRepo.update).toHaveBeenCalledWith(
        'existing-conv-id',
        expect.objectContaining({
          customer_name: 'Updated Name',
          last_message_at: now,
        }),
      );
      // save is not called for an existing conversation (only for new ones)
      expect(conversationRepo.save).not.toHaveBeenCalled();
    });

    it('should upsert existing messages (skip duplicates)', async () => {
      const now = new Date();
      const mockConversations: SyncedConversation[] = [
        {
          externalId: 'ext-conv-1',
          externalUserId: 'user-1',
          customerName: 'Test',
          lastMessageAt: now,
          metadata: {},
        },
      ];

      const mockMessages = new Map<string, SyncedMessage[]>();
      mockMessages.set('ext-conv-1', [
        {
          externalId: 'ext-msg-existing',
          senderType: 'customer',
          senderName: 'Test',
          content: 'Hello',
          contentType: 'text',
          attachments: [],
          sentAt: now,
          rawData: {},
        },
      ]);

      const mockAdapter = new MockChannelAdapter(
        mockConversations,
        mockMessages,
      );
      service.setAdapterFactory(() => mockAdapter);

      // Conversation is new
      conversationRepo.findOne.mockResolvedValue(null);
      // Message already exists
      messageRepo.findOne.mockResolvedValue({
        id: 'existing-msg-id',
        external_message_id: 'ext-msg-existing',
      });

      const channel: Channel = {
        id: 'ch-1',
        tenant_id: 'tenant-1',
        channel_type: 'facebook',
        name: 'Test Channel',
        external_id: 'ext-1',
        credentials_encrypted: Buffer.from('{}'),
        is_active: true,
        last_sync_at: null,
        last_sync_status: '',
        last_sync_error: '',
        metadata: '{}',
        created_at: new Date(),
        updated_at: new Date(),
      };

      await service.syncChannel(channel);

      // Message.save should NOT be called since message already exists and has no local paths
      expect(messageRepo.save).not.toHaveBeenCalled();
    });

    it('should handle sync errors gracefully', async () => {
      cryptoService.decrypt.mockImplementation(() => {
        throw new Error('decrypt failed');
      });

      const channel: Channel = {
        id: 'ch-1',
        tenant_id: 'tenant-1',
        channel_type: 'facebook',
        name: 'Test Channel',
        external_id: 'ext-1',
        credentials_encrypted: Buffer.from('bad-data'),
        is_active: true,
        last_sync_at: null,
        last_sync_status: '',
        last_sync_error: '',
        metadata: '{}',
        created_at: new Date(),
        updated_at: new Date(),
      };

      await service.syncChannel(channel);

      // Should have updated sync status to error
      expect(channelRepo.update).toHaveBeenCalledWith('ch-1', {
        last_sync_at: expect.any(Date),
        last_sync_status: 'error',
        last_sync_error: expect.stringContaining('decrypt failed'),
        updated_at: expect.any(Date),
      });
    });
  });

  describe('syncAllChannels', () => {
    it('should sync all active channels for a tenant', async () => {
      const channels: Channel[] = [
        {
          id: 'ch-1',
          tenant_id: 'tenant-1',
          channel_type: 'facebook',
          name: 'Channel 1',
          external_id: 'ext-1',
          credentials_encrypted: Buffer.from('{}'),
          is_active: true,
          last_sync_at: null,
          last_sync_status: '',
          last_sync_error: '',
          metadata: '{}',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];
      channelRepo.find.mockResolvedValue(channels);

      const mockAdapter = new MockChannelAdapter([], new Map());
      service.setAdapterFactory(() => mockAdapter);

      await service.syncAllChannels('tenant-1');

      // Should have queried active channels
      expect(channelRepo.find).toHaveBeenCalledWith({
        where: { is_active: true, tenant_id: 'tenant-1' },
      });
    });
  });
});
