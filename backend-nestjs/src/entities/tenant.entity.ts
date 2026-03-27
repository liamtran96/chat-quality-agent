import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  OneToMany,
} from 'typeorm';
import { User } from './user.entity';
import { Channel } from './channel.entity';

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  name: string;

  @Column({ type: 'varchar', length: 100, unique: true, nullable: false })
  slug: string;

  @Column({ type: 'jsonb', nullable: true })
  settings: any;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updated_at: Date;

  @ManyToMany(() => User, (user) => user.tenants)
  users: User[];

  @OneToMany(() => Channel, (channel) => channel.tenant)
  channels: Channel[];
}
