import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

@Entity('notification_logs')
@Index('idx_notiflog_tenant_sent', ['tenant_id', 'sent_at'])
export class NotificationLog {
  @PrimaryColumn('uuid')
  id: string = uuidv4();

  @Column({ type: 'uuid', nullable: false, name: 'tenant_id' })
  tenant_id!: string;

  @Column({ type: 'uuid', nullable: true, name: 'job_id' })
  job_id!: string;

  @Column({ type: 'uuid', nullable: true, name: 'job_run_id' })
  job_run_id!: string;

  @Column({ type: 'varchar', length: 20, nullable: false, name: 'channel_type' })
  channel_type!: string;

  @Column({ type: 'varchar', length: 500, nullable: false })
  recipient!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  subject!: string;

  @Column({ type: 'text', nullable: false })
  body!: string;

  @Column({ type: 'varchar', length: 20, nullable: false })
  status!: string;

  @Column({ type: 'text', nullable: true, name: 'error_message' })
  error_message!: string;

  @Column({ type: 'timestamptz', nullable: false, name: 'sent_at' })
  sent_at!: Date;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  created_at!: Date;
}
