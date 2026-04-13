import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Job } from './job.entity';

@Entity('job_runs')
@Index('idx_jobrun_job_started', ['job_id', 'started_at'])
export class JobRun {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false })
  job_id!: string;

  @Column({ type: 'uuid', nullable: false })
  tenant_id!: string;

  @Column({ type: 'timestamptz', nullable: false })
  started_at!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  finished_at!: Date | null;

  @Column({ type: 'varchar', length: 20, default: 'running' })
  status!: string;

  @Column({ type: 'jsonb', nullable: true })
  summary!: string;

  @Column({ type: 'text', nullable: true })
  error_message!: string;

  @CreateDateColumn({ type: 'timestamptz', nullable: false })
  created_at!: Date;

  @ManyToOne(() => Job)
  @JoinColumn({ name: 'job_id' })
  job?: Job;
}
