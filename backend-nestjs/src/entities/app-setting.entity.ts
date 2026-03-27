import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Index('idx_setting_tenant_key', ['tenant_id', 'setting_key'], { unique: true })
@Entity('app_settings')
export class AppSetting {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'tenant_id', nullable: false })
  tenant_id: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  setting_key: string;

  @Column({ type: 'bytea', nullable: true })
  value_encrypted: Buffer;

  @Column({ type: 'text', nullable: true })
  value_plain: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updated_at: Date;
}
