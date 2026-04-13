import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('activity_logs')
export class ActivityLog {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false, name: 'tenant_id' })
  tenant_id: string;

  @Column({ type: 'uuid', nullable: true, name: 'user_id' })
  user_id: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'user_email' })
  user_email: string;

  @Column({ type: 'varchar', length: 50, nullable: false })
  action: string;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'resource_type' })
  resource_type: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'resource_id' })
  resource_id: string;

  @Column({ type: 'text', nullable: true })
  detail: string;

  @Column({ type: 'text', nullable: true, name: 'error_message' })
  error_message: string;

  @Column({ type: 'varchar', length: 45, nullable: true, name: 'ip_address' })
  ip_address: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  created_at: Date;
}
