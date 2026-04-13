import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Index('idx_setting_tenant_key', ['tenant_id', 'setting_key'], { unique: true })
@Entity('app_settings')
export class AppSetting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false, name: 'tenant_id' })
  tenant_id: string;

  @Column({ type: 'varchar', length: 255, nullable: false, name: 'setting_key' })
  setting_key: string;

  @Column({ type: 'bytea', nullable: true, name: 'value_encrypted' })
  value_encrypted: Buffer;

  @Column({ type: 'text', nullable: true, name: 'value_plain' })
  value_plain: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updated_at: Date;
}
