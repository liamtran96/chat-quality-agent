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

  @Column({ type: 'uuid', name: 'tenant_id', nullable: false })
  tenant_id: string;

  @Column({ type: 'uuid', name: 'channel_id', nullable: false })
  channel_id: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  external_conversation_id: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  external_user_id: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  customer_name: string;

  @Column({ type: 'timestamptz', nullable: true })
  last_message_at: Date | null;

  @Column({ type: 'int', default: 0 })
  message_count: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updated_at: Date;

  @ManyToOne(() => Channel)
  @JoinColumn({ name: 'channel_id' })
  channel?: Channel;

  @OneToMany(() => Message, (message) => message.conversation)
  messages?: Message[];
}
