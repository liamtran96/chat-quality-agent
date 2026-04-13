import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Index('idx_activity_tenant_created', ['tenant_id', 'created_at'])
@Entity('activity_logs')
export class ActivityLog {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'tenant_id', nullable: false })
  tenant_id: string;

  @Column({ type: 'uuid', name: 'user_id', nullable: true })
  user_id: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  user_email: string;

  @Column({ type: 'varchar', length: 50, nullable: false })
  action: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  resource_type: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  resource_id: string;

  @Column({ type: 'text', nullable: true })
  detail: string;

  @Column({ type: 'text', nullable: true })
  error_message: string;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip_address: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  created_at: Date;
}
