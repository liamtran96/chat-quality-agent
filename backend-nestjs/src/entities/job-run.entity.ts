import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Job } from './job.entity';

@Entity('job_runs')
@Index('idx_jobrun_job_started', ['job_id', 'started_at'])
export class JobRun {
  @PrimaryColumn('uuid')
  id: string = uuidv4();

  @Column({ type: 'uuid', nullable: false, name: 'job_id' })
  job_id!: string;

  @Column({ type: 'uuid', nullable: false, name: 'tenant_id' })
  tenant_id!: string;

  @Column({ type: 'timestamptz', nullable: false, name: 'started_at' })
  started_at!: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'finished_at' })
  finished_at!: Date | null;

  @Column({ type: 'varchar', length: 20, default: 'running' })
  status!: string;

  @Column({ type: 'jsonb', nullable: true })
  summary!: string;

  @Column({ type: 'text', nullable: true, name: 'error_message' })
  error_message!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  created_at!: Date;

  @ManyToOne(() => Job)
  @JoinColumn({ name: 'job_id' })
  job?: Job;
}
