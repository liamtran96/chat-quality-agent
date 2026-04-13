import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Index('idx_notiflog_tenant_sent', ['tenant_id', 'sent_at'])
@Entity('notification_logs')
export class NotificationLog {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'tenant_id', nullable: false })
  tenant_id: string;

  @Column({ type: 'uuid', name: 'job_id', nullable: true })
  job_id: string;

  @Column({ type: 'uuid', name: 'job_run_id', nullable: true })
  job_run_id: string;

  @Column({ type: 'varchar', length: 20, nullable: false })
  channel_type: string;

  @Column({ type: 'varchar', length: 500, nullable: false })
  recipient: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  subject: string;

  @Column({ type: 'text', nullable: false })
  body: string;

  @Column({ type: 'varchar', length: 20, nullable: false })
  status: string;

  @Column({ type: 'text', nullable: true })
  error_message: string;

  @Column({ type: 'timestamptz', nullable: false })
  sent_at: Date;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  created_at: Date;
}
