import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('ai_usage_logs')
@Index('idx_aiusage_tenant_created', ['tenant_id', 'created_at'])
export class AIUsageLog {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false, name: 'tenant_id' })
  tenant_id: string;

  @Column({ type: 'uuid', nullable: true, name: 'job_id' })
  job_id: string;

  @Column({ type: 'uuid', nullable: true, name: 'job_run_id' })
  job_run_id: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  provider: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  model: string;

  @Column({ type: 'int', default: 0, name: 'input_tokens' })
  input_tokens: number;

  @Column({ type: 'int', default: 0, name: 'output_tokens' })
  output_tokens: number;

  @Column({ type: 'decimal', precision: 10, scale: 6, default: 0, name: 'cost_usd' })
  cost_usd: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  created_at: Date;
}
