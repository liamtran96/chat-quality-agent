import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Index('idx_aiusage_tenant_created', ['tenant_id', 'created_at'])
@Entity('ai_usage_logs')
export class AIUsageLog {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'tenant_id', nullable: false })
  tenant_id: string;

  @Column({ type: 'uuid', name: 'job_id', nullable: true })
  job_id: string;

  @Column({ type: 'uuid', name: 'job_run_id', nullable: true })
  job_run_id: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  provider: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  model: string;

  @Column({ type: 'int', default: 0 })
  input_tokens: number;

  @Column({ type: 'int', default: 0 })
  output_tokens: number;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  cost_usd: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  created_at: Date;
}
