import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('notification_logs')
export class NotificationLog {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: false })
  tenant_id!: string;

  @Column({ name: 'job_id', type: 'uuid', nullable: true })
  job_id!: string;

  @Column({ name: 'job_run_id', type: 'uuid', nullable: true })
  job_run_id!: string;

  @Column({ name: 'channel_type', type: 'varchar', length: 20, nullable: false })
  channel_type!: string;

  @Column({ type: 'varchar', length: 500, nullable: false })
  recipient!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  subject!: string;

  @Column({ type: 'text', nullable: false })
  body!: string;

  @Column({ type: 'varchar', length: 20, nullable: false })
  status!: string;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  error_message!: string;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: false })
  sent_at!: Date;

  @CreateDateColumn({ type: 'timestamptz', nullable: false })
  created_at!: Date;
}
