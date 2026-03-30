import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { Tenant } from './tenant.entity';

@Entity('users')
export class User {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255, unique: true, nullable: false })
  email!: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255, nullable: false })
  password_hash!: string;

  @Column({ type: 'varchar', length: 255, default: '' })
  name!: string;

  @Column({ name: 'is_admin', type: 'boolean', default: false })
  is_admin!: boolean;

  @Column({ name: 'token_version', type: 'int', default: 0 })
  token_version!: number;

  @Column({ type: 'varchar', length: 10, default: 'vi' })
  language!: string;

  @CreateDateColumn({ type: 'timestamptz', nullable: false })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz', nullable: false })
  updated_at!: Date;

  @ManyToMany(() => Tenant)
  @JoinTable({
    name: 'user_tenants',
    joinColumn: { name: 'user_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tenant_id', referencedColumnName: 'id' },
  })
  tenants?: Tenant[];
}
