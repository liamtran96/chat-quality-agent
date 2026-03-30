import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('ai_usage_logs')
export class AIUsageLog {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: false })
  tenant_id!: string;

  @Column({ name: 'job_id', type: 'uuid', nullable: true })
  job_id!: string;

  @Column({ name: 'job_run_id', type: 'uuid', nullable: true })
  job_run_id!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  provider!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  model!: string;

  @Column({ name: 'input_tokens', type: 'int', default: 0 })
  input_tokens!: number;

  @Column({ name: 'output_tokens', type: 'int', default: 0 })
  output_tokens!: number;

  @Column({ name: 'cost_usd', type: 'decimal', precision: 10, scale: 6, default: 0 })
  cost_usd!: number;

  @CreateDateColumn({ type: 'timestamptz', nullable: false })
  created_at!: Date;
}
