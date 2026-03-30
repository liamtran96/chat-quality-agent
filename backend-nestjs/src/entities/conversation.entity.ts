import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Channel } from './channel.entity';
import { Message } from './message.entity';

@Index('idx_conv_tenant_last_msg', ['tenant_id', 'last_message_at'])
@Index('idx_conv_channel', ['channel_id'])
@Entity('conversations')
export class Conversation {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false, name: 'tenant_id' })
  tenant_id: string;

  @Column({ type: 'uuid', nullable: false, name: 'channel_id' })
  channel_id: string;

  @Column({ type: 'varchar', length: 255, nullable: false, name: 'external_conversation_id' })
  external_conversation_id: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'external_user_id' })
  external_user_id: string;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'customer_name' })
  customer_name: string;

  @Column({ type: 'timestamptz', nullable: true, name: 'last_message_at' })
  last_message_at: Date | null;

  @Column({ type: 'int', default: 0, name: 'message_count' })
  message_count: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: any;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updated_at: Date;

  @ManyToOne(() => Channel)
  @JoinColumn({ name: 'channel_id' })
  channel: Channel;

  @OneToMany(() => Message, (message) => message.conversation)
  messages: Message[];
}
