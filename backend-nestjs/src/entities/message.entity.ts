import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Conversation } from './conversation.entity';

@Index('idx_msg_conv_time', ['conversation_id', 'sent_at'])
@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false, name: 'tenant_id' })
  tenant_id: string;

  @Column({ type: 'uuid', nullable: false, name: 'conversation_id' })
  conversation_id: string;

  @Column({ type: 'varchar', length: 255, nullable: false, name: 'external_message_id' })
  external_message_id: string;

  @Column({ type: 'varchar', length: 20, nullable: false, name: 'sender_type' })
  sender_type: string;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'sender_name' })
  sender_name: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'sender_external_id' })
  sender_external_id: string;

  @Column({ type: 'text', nullable: true })
  content: string;

  @Column({ type: 'varchar', length: 50, default: 'text', name: 'content_type' })
  content_type: string;

  @Column({ type: 'jsonb', nullable: true })
  attachments: string;

  @Column({ type: 'timestamptz', nullable: false, name: 'sent_at' })
  sent_at: Date;

  @Column({ type: 'jsonb', nullable: true, name: 'raw_data' })
  raw_data: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  created_at: Date;

  @ManyToOne(() => Conversation, (conv) => conv.messages)
  @JoinColumn({ name: 'conversation_id' })
  conversation?: Conversation;
}
