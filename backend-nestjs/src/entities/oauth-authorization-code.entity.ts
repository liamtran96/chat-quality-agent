import { Entity, PrimaryColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('oauth_authorization_codes')
export class OAuthAuthorizationCode {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true, nullable: false })
  code: string;

  @Index()
  @Column({ type: 'varchar', length: 255, nullable: false })
  client_id: string;

  @Column({ type: 'uuid', name: 'user_id', nullable: false })
  user_id: string;

  @Column({ type: 'varchar', length: 1024, nullable: true })
  redirect_uri: string;

  @Column({ type: 'jsonb', nullable: true })
  scopes: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  code_challenge: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  code_challenge_method: string;

  @Index()
  @Column({ type: 'timestamptz', nullable: false })
  expires_at: Date;

  @Column({ type: 'boolean', default: false })
  used: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  created_at: Date;
}
