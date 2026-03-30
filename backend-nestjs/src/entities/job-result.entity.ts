import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Index('idx_result_run', ['job_run_id'])
@Index('idx_result_tenant_type', ['tenant_id', 'result_type', 'created_at'])
@Index('idx_result_tenant_conv', ['tenant_id', 'conversation_id'])
@Entity('job_results')
export class JobResult {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false, name: 'job_run_id' })
  job_run_id: string;

  @Column({ type: 'uuid', nullable: false, name: 'tenant_id' })
  tenant_id: string;

  @Column({ type: 'uuid', nullable: false, name: 'conversation_id' })
  conversation_id: string;

  @Column({ type: 'varchar', length: 30, nullable: false, name: 'result_type' })
  result_type: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  severity: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'rule_name' })
  rule_name: string;

  @Column({ type: 'text', nullable: true })
  evidence: string;

  @Column({ type: 'jsonb', nullable: true })
  detail: string;

  @Column({ type: 'text', nullable: true, name: 'ai_raw_response' })
  ai_raw_response: string;

  @Column({ type: 'float', nullable: true, default: 0 })
  confidence: number;

  @Column({ type: 'timestamptz', nullable: true, name: 'notified_at' })
  notified_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  created_at: Date;
}
