import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('oauth_clients')
export class OAuthClient {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true, nullable: false })
  client_id: string;

  @Column({ type: 'varchar', length: 255, nullable: false, select: false })
  client_secret_hash: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name: string;

  @Column({ type: 'jsonb', nullable: true })
  redirect_uris: string;

  @Column({ type: 'jsonb', nullable: true })
  scopes: string;

  @Column({ type: 'uuid', name: 'user_id', nullable: true })
  user_id: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  created_at: Date;
}
