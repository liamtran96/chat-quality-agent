import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('oauth_clients')
export class OAuthClient {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'client_id', type: 'varchar', length: 255, unique: true, nullable: false })
  client_id!: string;

  @Column({ name: 'client_secret_hash', type: 'varchar', length: 255, nullable: false })
  client_secret_hash!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name!: string;

  @Column({ name: 'redirect_uris', type: 'jsonb', nullable: true })
  redirect_uris!: string;

  @Column({ type: 'jsonb', nullable: true })
  scopes!: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  user_id!: string;

  @CreateDateColumn({ type: 'timestamptz', nullable: false })
  created_at!: Date;
}
