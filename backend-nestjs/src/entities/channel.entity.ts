import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Tenant } from './tenant.entity';

@Entity('channels')
@Index('idx_channel_tenant_active', ['tenant_id', 'is_active'])
export class Channel {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false })
  tenant_id!: string;

  @Column({ type: 'varchar', length: 20, nullable: false })
  channel_type!: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  name!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  external_id!: string;

  @Column({ type: 'bytea', nullable: false })
  credentials_encrypted!: Buffer;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  last_sync_at!: Date | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  last_sync_status!: string;

  @Column({ type: 'text', nullable: true })
  last_sync_error!: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: string;

  @CreateDateColumn({ type: 'timestamptz', nullable: false })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz', nullable: false })
  updated_at!: Date;

  @ManyToOne(() => Tenant, (tenant) => tenant.channels)
  @JoinColumn({ name: 'tenant_id' })
  tenant?: Tenant;
}
