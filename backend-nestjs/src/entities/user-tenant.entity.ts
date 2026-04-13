import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('user_tenants')
export class UserTenant {
  @PrimaryColumn({ type: 'uuid' })
  user_id!: string;

  @PrimaryColumn({ type: 'uuid' })
  tenant_id!: string;

  @Column({ type: 'varchar', length: 20, default: 'member' })
  role!: string;

  @Column({ type: 'text', nullable: true })
  permissions!: string;
}
