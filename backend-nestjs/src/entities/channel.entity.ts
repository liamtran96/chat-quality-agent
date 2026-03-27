import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Tenant } from './tenant.entity';

@Entity('channels')
export class Channel {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: false })
  tenant_id!: string;

  @Column({ name: 'channel_type', type: 'varchar', length: 20, nullable: false })
  channel_type!: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  name!: string;

  @Column({ name: 'external_id', type: 'varchar', length: 255, nullable: true })
  external_id!: string;

  @Column({ name: 'credentials_encrypted', type: 'bytea', nullable: false })
  credentials_encrypted!: Buffer;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  is_active!: boolean;

  @Column({ name: 'last_sync_at', type: 'timestamptz', nullable: true })
  last_sync_at!: Date | null;

  @Column({ name: 'last_sync_status', type: 'varchar', length: 20, nullable: true })
  last_sync_status!: string;

  @Column({ name: 'last_sync_error', type: 'text', nullable: true })
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
