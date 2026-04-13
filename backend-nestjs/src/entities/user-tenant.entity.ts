import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('user_tenants')
export class UserTenant {
  @PrimaryColumn('uuid', { name: 'user_id' })
  user_id: string;

  @PrimaryColumn('uuid', { name: 'tenant_id' })
  tenant_id: string;

  @Column({ type: 'varchar', length: 20, default: 'member' })
  role: string;

  @Column({ type: 'text', nullable: true })
  permissions: string;
}
