import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('ai_usage_logs')
@Index('idx_aiusage_tenant_created', ['tenant_id', 'created_at'])
export class AIUsageLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false })
  tenant_id!: string;

  @Column({ type: 'uuid', nullable: true })
  job_id!: string;

  @Column({ type: 'uuid', nullable: true })
  job_run_id!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  provider!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  model!: string;

  @Column({ type: 'int', default: 0 })
  input_tokens!: number;

  @Column({ type: 'int', default: 0 })
  output_tokens!: number;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  cost_usd!: number;

  @CreateDateColumn({ type: 'timestamptz', nullable: false })
  created_at!: Date;
}
