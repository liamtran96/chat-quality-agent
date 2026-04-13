import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('activity_logs')
export class ActivityLog {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: false })
  tenant_id!: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  user_id!: string;

  @Column({ name: 'user_email', type: 'varchar', length: 255, nullable: true })
  user_email!: string;

  @Column({ type: 'varchar', length: 50, nullable: false })
  action!: string;

  @Column({ name: 'resource_type', type: 'varchar', length: 50, nullable: true })
  resource_type!: string;

  @Column({ name: 'resource_id', type: 'varchar', length: 100, nullable: true })
  resource_id!: string;

  @Column({ type: 'text', nullable: true })
  detail!: string;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  error_message!: string;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ip_address!: string;

  @CreateDateColumn({ type: 'timestamptz', nullable: false })
  created_at!: Date;
}
