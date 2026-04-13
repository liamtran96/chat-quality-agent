import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Tenant } from './tenant.entity';

@Index('idx_job_tenant_active', ['tenant_id', 'is_active'])
@Entity('jobs')
export class Job {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'tenant_id', nullable: false })
  tenant_id: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 30, nullable: false })
  job_type: string;

  @Column({ type: 'jsonb', nullable: false })
  input_channel_ids: string;

  @Column({ type: 'text', nullable: true })
  rules_content: string;

  @Column({ type: 'jsonb', nullable: true })
  rules_config: string;

  @Column({ type: 'text', nullable: true })
  skip_conditions: string;

  @Column({ type: 'varchar', length: 20, default: 'claude', name: 'ai_provider' })
  ai_provider: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  ai_model: string;

  @Column({ type: 'jsonb', nullable: false })
  outputs: string;

  @Column({ type: 'varchar', length: 20, default: 'instant' })
  output_schedule: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  output_cron: string;

  @Column({ type: 'timestamptz', nullable: true })
  output_at: Date | null;

  @Column({ type: 'varchar', length: 20, default: 'cron' })
  schedule_type: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  schedule_cron: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  last_run_at: Date | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  last_run_status: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updated_at: Date;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant?: Tenant;
}
