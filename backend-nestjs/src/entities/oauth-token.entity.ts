import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('oauth_tokens')
export class OAuthToken {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'client_id', type: 'varchar', length: 255, nullable: false })
  client_id!: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: false })
  user_id!: string;

  @Column({ name: 'access_token_hash', type: 'varchar', length: 255, nullable: false })
  access_token_hash!: string;

  @Column({ name: 'refresh_token_hash', type: 'varchar', length: 255, nullable: true })
  refresh_token_hash!: string;

  @Column({ type: 'jsonb', nullable: true })
  scopes!: string;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: false })
  expires_at!: Date;

  @CreateDateColumn({ type: 'timestamptz', nullable: false })
  created_at!: Date;
}
