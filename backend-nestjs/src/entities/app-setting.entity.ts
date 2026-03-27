import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

@Entity('app_settings')
@Unique('idx_setting_tenant_key', ['tenant_id', 'setting_key'])
export class AppSetting {
  @PrimaryColumn('uuid')
  id: string = uuidv4();

  @Column({ type: 'uuid', nullable: false, name: 'tenant_id' })
  tenant_id!: string;

  @Column({ type: 'varchar', length: 255, nullable: false, name: 'setting_key' })
  setting_key!: string;

  @Column({ type: 'bytea', nullable: true, name: 'value_encrypted' })
  value_encrypted!: Buffer | null;

  @Column({ type: 'text', nullable: true, name: 'value_plain' })
  value_plain!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updated_at!: Date;
}
