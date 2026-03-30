import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Conversation } from './conversation.entity';

@Entity('messages')
export class Message {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: false })
  tenant_id!: string;

  @Column({ name: 'conversation_id', type: 'uuid', nullable: false })
  conversation_id!: string;

  @Column({ name: 'external_message_id', type: 'varchar', length: 255, nullable: false })
  external_message_id!: string;

  @Column({ name: 'sender_type', type: 'varchar', length: 20, nullable: false })
  sender_type!: string;

  @Column({ name: 'sender_name', type: 'varchar', length: 500, nullable: true })
  sender_name!: string;

  @Column({ name: 'sender_external_id', type: 'varchar', length: 255, nullable: true })
  sender_external_id!: string;

  @Column({ type: 'text', nullable: true })
  content!: string;

  @Column({ name: 'content_type', type: 'varchar', length: 50, default: 'text' })
  content_type!: string;

  @Column({ type: 'jsonb', nullable: true })
  attachments!: string;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: false })
  sent_at!: Date;

  @Column({ name: 'raw_data', type: 'jsonb', nullable: true })
  raw_data!: string;

  @CreateDateColumn({ type: 'timestamptz', nullable: false })
  created_at!: Date;

  @ManyToOne(() => Conversation, (conversation) => conversation.messages)
  @JoinColumn({ name: 'conversation_id' })
  conversation?: Conversation;
}
