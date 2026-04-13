import {
  Entity,
  PrimaryGeneratedColumn,
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
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false, name: 'tenant_id' })
  tenant_id: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 30, nullable: false, name: 'job_type' })
  job_type: string;

  @Column({ type: 'jsonb', nullable: false, name: 'input_channel_ids' })
  input_channel_ids: string;

  @Column({ type: 'text', nullable: true, name: 'rules_content' })
  rules_content: string;

  @Column({ type: 'jsonb', nullable: true, name: 'rules_config' })
  rules_config: string;

  @Column({ type: 'text', nullable: true, name: 'skip_conditions' })
  skip_conditions: string;

  @Column({ type: 'varchar', length: 20, default: 'claude', name: 'ai_provider' })
  ai_provider: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'ai_model' })
  ai_model: string;

  @Column({ type: 'jsonb', nullable: false })
  outputs: string;

  @Column({ type: 'varchar', length: 20, default: 'instant', name: 'output_schedule' })
  output_schedule: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'output_cron' })
  output_cron: string;

  @Column({ type: 'timestamptz', nullable: true, name: 'output_at' })
  output_at: Date | null;

  @Column({ type: 'varchar', length: 20, default: 'cron', name: 'schedule_type' })
  schedule_type: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'schedule_cron' })
  schedule_cron: string;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  is_active: boolean;

  @Column({ type: 'timestamptz', nullable: true, name: 'last_run_at' })
  last_run_at: Date | null;

  @Column({ type: 'varchar', length: 20, nullable: true, name: 'last_run_status' })
  last_run_status: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updated_at: Date;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant?: Tenant;
}
