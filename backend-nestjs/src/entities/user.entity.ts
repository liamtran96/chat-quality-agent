import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Tenant } from './tenant.entity';

@Entity('users')
export class User {
  @PrimaryColumn('uuid')
  id: string = uuidv4();

  @Column({ type: 'varchar', length: 255, unique: true, nullable: false })
  email!: string;

  @Column({ type: 'varchar', length: 255, nullable: false, name: 'password_hash' })
  password_hash!: string;

  @Column({ type: 'varchar', length: 255, default: '' })
  name!: string;

  @Column({ type: 'boolean', default: false, name: 'is_admin' })
  is_admin!: boolean;

  @Column({ type: 'int', default: 0, name: 'token_version' })
  token_version!: number;

  @Column({ type: 'varchar', length: 10, default: 'vi' })
  language!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updated_at!: Date;

  @ManyToMany(() => Tenant, (tenant) => tenant.users)
  @JoinTable({
    name: 'user_tenants',
    joinColumn: { name: 'user_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tenant_id', referencedColumnName: 'id' },
  })
  tenants?: Tenant[];
}
