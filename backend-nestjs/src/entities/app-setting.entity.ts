import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';

@Entity('app_settings')
@Unique('idx_setting_tenant_key', ['tenant_id', 'setting_key'])
export class AppSetting {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false })
  tenant_id!: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  setting_key!: string;

  @Column({ type: 'bytea', nullable: true })
  value_encrypted!: Buffer;

  @Column({ type: 'text', nullable: true })
  value_plain!: string;

  @CreateDateColumn({ type: 'timestamptz', nullable: false })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz', nullable: false })
  updated_at!: Date;
}
