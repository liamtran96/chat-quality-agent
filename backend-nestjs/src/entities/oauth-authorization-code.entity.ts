import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('oauth_authorization_codes')
export class OAuthAuthorizationCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true, nullable: false })
  code: string;

  @Column({ type: 'varchar', length: 255, nullable: false, name: 'client_id' })
  @Index()
  client_id: string;

  @Column({ type: 'uuid', nullable: false, name: 'user_id' })
  user_id: string;

  @Column({ type: 'varchar', length: 1024, nullable: true, name: 'redirect_uri' })
  redirect_uri: string;

  @Column({ type: 'jsonb', nullable: true })
  scopes: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'code_challenge' })
  code_challenge: string;

  @Column({ type: 'varchar', length: 10, nullable: true, name: 'code_challenge_method' })
  code_challenge_method: string;

  @Column({ type: 'timestamptz', nullable: false, name: 'expires_at' })
  @Index()
  expires_at: Date;

  @Column({ type: 'boolean', nullable: false, default: false })
  used: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  created_at: Date;
}
