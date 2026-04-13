import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('job_results')
export class JobResult {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'job_run_id', type: 'uuid', nullable: false })
  job_run_id!: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: false })
  tenant_id!: string;

  @Column({ name: 'conversation_id', type: 'uuid', nullable: false })
  conversation_id!: string;

  @Column({ name: 'result_type', type: 'varchar', length: 30, nullable: false })
  result_type!: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  severity!: string;

  @Column({ name: 'rule_name', type: 'varchar', length: 255, nullable: true })
  rule_name!: string;

  @Column({ type: 'text', nullable: true })
  evidence!: string;

  @Column({ type: 'jsonb', nullable: true })
  detail!: string;

  @Column({ name: 'ai_raw_response', type: 'text', nullable: true })
  ai_raw_response!: string;

  @Column({ type: 'float', default: 0 })
  confidence!: number;

  @Column({ name: 'notified_at', type: 'timestamptz', nullable: true })
  notified_at!: Date | null;

  @CreateDateColumn({ type: 'timestamptz', nullable: false })
  created_at!: Date;
}
