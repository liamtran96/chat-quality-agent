import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Tenant } from './tenant.entity';

@Entity('channels')
export class Channel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false, name: 'tenant_id' })
  tenant_id: string;

  @Column({ type: 'varchar', length: 20, nullable: false, name: 'channel_type' })
  channel_type: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'external_id' })
  external_id: string;

  @Column({ type: 'bytea', nullable: false, name: 'credentials_encrypted' })
  credentials_encrypted: Buffer;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  is_active: boolean;

  @Column({ type: 'timestamptz', nullable: true, name: 'last_sync_at' })
  last_sync_at: Date | null;

  @Column({ type: 'varchar', length: 20, nullable: true, name: 'last_sync_status' })
  last_sync_status: string;

  @Column({ type: 'text', nullable: true, name: 'last_sync_error' })
  last_sync_error: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updated_at: Date;

  @ManyToOne(() => Tenant, (tenant) => tenant.channels)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;
}
