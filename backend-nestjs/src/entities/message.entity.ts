import {
  Entity,
  PrimaryColumn,
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
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'tenant_id', nullable: false })
  tenant_id: string;

  @Column({ type: 'uuid', name: 'conversation_id', nullable: false })
  conversation_id: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  external_message_id: string;

  @Column({ type: 'varchar', length: 20, nullable: false })
  sender_type: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  sender_name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  sender_external_id: string;

  @Column({ type: 'text', nullable: true })
  content: string;

  @Column({ type: 'varchar', length: 50, default: 'text' })
  content_type: string;

  @Column({ type: 'jsonb', nullable: true })
  attachments: string;

  @Column({ type: 'timestamptz', nullable: false })
  sent_at: Date;

  @Column({ type: 'jsonb', nullable: true })
  raw_data: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  created_at: Date;

  @ManyToOne(() => Conversation, (conversation) => conversation.messages)
  @JoinColumn({ name: 'conversation_id' })
  conversation?: Conversation;
}
