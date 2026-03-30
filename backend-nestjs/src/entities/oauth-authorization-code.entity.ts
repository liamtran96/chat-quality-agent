import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('oauth_authorization_codes')
export class OAuthAuthorizationCode {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255, unique: true, nullable: false })
  code!: string;

  @Column({ name: 'client_id', type: 'varchar', length: 255, nullable: false })
  client_id!: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: false })
  user_id!: string;

  @Column({ name: 'redirect_uri', type: 'varchar', length: 1024, nullable: true })
  redirect_uri!: string;

  @Column({ type: 'jsonb', nullable: true })
  scopes!: string;

  @Column({ name: 'code_challenge', type: 'varchar', length: 255, nullable: true })
  code_challenge!: string;

  @Column({ name: 'code_challenge_method', type: 'varchar', length: 10, nullable: true })
  code_challenge_method!: string;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: false })
  expires_at!: Date;

  @Column({ type: 'boolean', default: false, nullable: false })
  used!: boolean;

  @CreateDateColumn({ type: 'timestamptz', nullable: false })
  created_at!: Date;
}
