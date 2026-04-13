import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('notification_logs')
@Index('idx_notiflog_tenant_sent', ['tenant_id', 'sent_at'])
export class NotificationLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false })
  tenant_id!: string;

  @Column({ type: 'uuid', nullable: true })
  job_id!: string;

  @Column({ type: 'uuid', nullable: true })
  job_run_id!: string;

  @Column({ type: 'varchar', length: 20, nullable: false })
  channel_type!: string;

  @Column({ type: 'varchar', length: 500, nullable: false })
  recipient!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  subject!: string;

  @Column({ type: 'text', nullable: false })
  body!: string;

  @Column({ type: 'varchar', length: 20, nullable: false })
  status!: string;

  @Column({ type: 'text', nullable: true })
  error_message!: string;

  @Column({ type: 'timestamptz', nullable: false })
  sent_at!: Date;

  @CreateDateColumn({ type: 'timestamptz', nullable: false })
  created_at!: Date;
}
