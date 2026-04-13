import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Tenant } from './tenant.entity';

@Index('idx_channel_tenant_active', ['tenant_id', 'is_active'])
@Entity('channels')
export class Channel {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'tenant_id', nullable: false })
  tenant_id: string;

  @Column({ type: 'varchar', length: 20, nullable: false })
  channel_type: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  external_id: string;

  @Column({ type: 'bytea', nullable: false })
  credentials_encrypted: Buffer;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  last_sync_at: Date | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  last_sync_status: string;

  @Column({ type: 'text', nullable: true })
  last_sync_error: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updated_at: Date;

  @ManyToOne(() => Tenant, (tenant) => tenant.channels)
  @JoinColumn({ name: 'tenant_id' })
  tenant?: Tenant;
}
