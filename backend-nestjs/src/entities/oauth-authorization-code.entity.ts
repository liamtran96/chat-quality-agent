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
  id!: string;

  @Column({ type: 'varchar', length: 255, unique: true, nullable: false })
  code!: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  @Index()
  client_id!: string;

  @Column({ type: 'uuid', nullable: false })
  user_id!: string;

  @Column({ type: 'varchar', length: 1024, nullable: true })
  redirect_uri!: string;

  @Column({ type: 'jsonb', nullable: true })
  scopes!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  code_challenge!: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  code_challenge_method!: string;

  @Column({ type: 'timestamptz', nullable: false })
  @Index()
  expires_at!: Date;

  @Column({ type: 'boolean', default: false, nullable: false })
  used!: boolean;

  @CreateDateColumn({ type: 'timestamptz', nullable: false })
  created_at!: Date;
}
