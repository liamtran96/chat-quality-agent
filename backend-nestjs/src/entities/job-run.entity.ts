import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Job } from './job.entity';

@Entity('job_runs')
export class JobRun {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'job_id', type: 'uuid', nullable: false })
  job_id!: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: false })
  tenant_id!: string;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: false })
  started_at!: Date;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finished_at!: Date | null;

  @Column({ type: 'varchar', length: 20, default: 'running' })
  status!: string;

  @Column({ type: 'jsonb', nullable: true })
  summary!: string;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  error_message!: string;

  @CreateDateColumn({ type: 'timestamptz', nullable: false })
  created_at!: Date;

  @ManyToOne(() => Job)
  @JoinColumn({ name: 'job_id' })
  job?: Job;
}
