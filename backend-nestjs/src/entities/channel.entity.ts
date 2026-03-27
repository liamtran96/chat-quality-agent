import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Tenant } from './tenant.entity';

@Entity('channels')
@Index('idx_channel_tenant_active', ['tenant_id', 'is_active'])
@Unique('uq_channel_tenant_type_ext', ['tenant_id', 'channel_type', 'external_id'])
export class Channel {
  @PrimaryColumn('uuid')
  id: string = uuidv4();

  @Column({ type: 'uuid', nullable: false, name: 'tenant_id' })
  tenant_id!: string;

  @Column({ type: 'varchar', length: 20, nullable: false, name: 'channel_type' })
  channel_type!: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  name!: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'external_id' })
  external_id!: string;

  @Column({ type: 'bytea', nullable: false, name: 'credentials_encrypted' })
  credentials_encrypted!: Buffer;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  is_active!: boolean;

  @Column({ type: 'timestamptz', nullable: true, name: 'last_sync_at' })
  last_sync_at!: Date | null;

  @Column({ type: 'varchar', length: 20, nullable: true, name: 'last_sync_status' })
  last_sync_status!: string;

  @Column({ type: 'text', nullable: true, name: 'last_sync_error' })
  last_sync_error!: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updated_at!: Date;

  @ManyToOne(() => Tenant, (tenant) => tenant.channels)
  @JoinColumn({ name: 'tenant_id' })
  tenant?: Tenant;
}
