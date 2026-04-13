import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Tenant } from './tenant.entity';

@Entity('jobs')
export class Job {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: false })
  tenant_id!: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string;

  @Column({ name: 'job_type', type: 'varchar', length: 30, nullable: false })
  job_type!: string;

  @Column({ name: 'input_channel_ids', type: 'jsonb', nullable: false })
  input_channel_ids!: string;

  @Column({ name: 'rules_content', type: 'text', nullable: true })
  rules_content!: string;

  @Column({ name: 'rules_config', type: 'jsonb', nullable: true })
  rules_config!: string;

  @Column({ name: 'skip_conditions', type: 'text', nullable: true })
  skip_conditions!: string;

  @Column({ name: 'ai_provider', type: 'varchar', length: 20, default: 'claude' })
  ai_provider!: string;

  @Column({ name: 'ai_model', type: 'varchar', length: 100, nullable: true })
  ai_model!: string;

  @Column({ type: 'jsonb', nullable: false })
  outputs!: string;

  @Column({ name: 'output_schedule', type: 'varchar', length: 20, default: 'instant' })
  output_schedule!: string;

  @Column({ name: 'output_cron', type: 'varchar', length: 100, nullable: true })
  output_cron!: string;

  @Column({ name: 'output_at', type: 'timestamptz', nullable: true })
  output_at!: Date | null;

  @Column({ name: 'schedule_type', type: 'varchar', length: 20, default: 'cron' })
  schedule_type!: string;

  @Column({ name: 'schedule_cron', type: 'varchar', length: 100, nullable: true })
  schedule_cron!: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  is_active!: boolean;

  @Column({ name: 'last_run_at', type: 'timestamptz', nullable: true })
  last_run_at!: Date | null;

  @Column({ name: 'last_run_status', type: 'varchar', length: 20, nullable: true })
  last_run_status!: string;

  @CreateDateColumn({ type: 'timestamptz', nullable: false })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz', nullable: false })
  updated_at!: Date;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant?: Tenant;
}
