import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('activity_logs')
@Index('idx_activity_tenant_created', ['tenant_id', 'created_at'])
export class ActivityLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false })
  tenant_id!: string;

  @Column({ type: 'uuid', nullable: true })
  user_id!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  user_email!: string;

  @Column({ type: 'varchar', length: 50, nullable: false })
  action!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  resource_type!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  resource_id!: string;

  @Column({ type: 'text', nullable: true })
  detail!: string;

  @Column({ type: 'text', nullable: true })
  error_message!: string;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip_address!: string;

  @CreateDateColumn({ type: 'timestamptz', nullable: false })
  created_at!: Date;
}
