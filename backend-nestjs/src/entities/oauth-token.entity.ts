import { Entity, PrimaryColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('oauth_tokens')
export class OAuthToken {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  client_id: string;

  @Column({ type: 'uuid', name: 'user_id', nullable: false })
  user_id: string;

  @Index('idx_oauth_access')
  @Column({ type: 'varchar', length: 255, nullable: false, select: false })
  access_token_hash: string;

  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  refresh_token_hash: string;

  @Column({ type: 'jsonb', nullable: true })
  scopes: string;

  @Column({ type: 'timestamptz', nullable: false })
  expires_at: Date;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  created_at: Date;
}
