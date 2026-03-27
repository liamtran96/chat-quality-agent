import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Channel } from './channel.entity';
import { Message } from './message.entity';

@Entity('conversations')
export class Conversation {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: false })
  tenant_id!: string;

  @Column({ name: 'channel_id', type: 'uuid', nullable: false })
  channel_id!: string;

  @Column({ name: 'external_conversation_id', type: 'varchar', length: 255, nullable: false })
  external_conversation_id!: string;

  @Column({ name: 'external_user_id', type: 'varchar', length: 255, nullable: true })
  external_user_id!: string;

  @Column({ name: 'customer_name', type: 'varchar', length: 500, nullable: true })
  customer_name!: string;

  @Column({ name: 'last_message_at', type: 'timestamptz', nullable: true })
  last_message_at!: Date | null;

  @Column({ name: 'message_count', type: 'int', default: 0 })
  message_count!: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: string;

  @CreateDateColumn({ type: 'timestamptz', nullable: false })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz', nullable: false })
  updated_at!: Date;

  @ManyToOne(() => Channel)
  @JoinColumn({ name: 'channel_id' })
  channel?: Channel;

  @OneToMany(() => Message, (message) => message.conversation)
  messages?: Message[];
}
