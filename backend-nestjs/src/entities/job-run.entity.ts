import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Job } from './job.entity';

@Index('idx_jobrun_job_started', ['job_id', 'started_at'])
@Entity('job_runs')
export class JobRun {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'job_id', nullable: false })
  job_id: string;

  @Column({ type: 'uuid', name: 'tenant_id', nullable: false })
  tenant_id: string;

  @Column({ type: 'timestamptz', nullable: false })
  started_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  finished_at: Date | null;

  @Column({ type: 'varchar', length: 20, default: 'running' })
  status: string;

  @Column({ type: 'jsonb', nullable: true })
  summary: string;

  @Column({ type: 'text', nullable: true })
  error_message: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  created_at: Date;

  @ManyToOne(() => Job)
  @JoinColumn({ name: 'job_id' })
  job?: Job;
}
