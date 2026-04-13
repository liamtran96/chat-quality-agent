import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('oauth_tokens')
export class OAuthToken {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, nullable: false, name: 'client_id' })
  client_id: string;

  @Column({ type: 'uuid', nullable: false, name: 'user_id' })
  user_id: string;

  @Column({ type: 'varchar', length: 255, nullable: false, name: 'access_token_hash' })
  @Index('idx_oauth_access')
  access_token_hash: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'refresh_token_hash' })
  refresh_token_hash: string;

  @Column({ type: 'jsonb', nullable: true })
  scopes: string;

  @Column({ type: 'timestamptz', nullable: false, name: 'expires_at' })
  expires_at: Date;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  created_at: Date;
}
