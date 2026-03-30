import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('app_settings')
export class AppSetting {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: false })
  tenant_id!: string;

  @Column({ name: 'setting_key', type: 'varchar', length: 255, nullable: false })
  setting_key!: string;

  @Column({ name: 'value_encrypted', type: 'bytea', nullable: true })
  value_encrypted!: Buffer;

  @Column({ name: 'value_plain', type: 'text', nullable: true })
  value_plain!: string;

  @CreateDateColumn({ type: 'timestamptz', nullable: false })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz', nullable: false })
  updated_at!: Date;
}
