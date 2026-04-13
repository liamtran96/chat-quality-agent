import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('oauth_tokens')
export class OAuthToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  client_id!: string;

  @Column({ type: 'uuid', nullable: false })
  user_id!: string;

  @Column({ type: 'varchar', length: 255, nullable: false, select: false })
  @Index('idx_oauth_access')
  access_token_hash!: string;

  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  refresh_token_hash!: string;

  @Column({ type: 'jsonb', nullable: true })
  scopes!: string;

  @Column({ type: 'timestamptz', nullable: false })
  expires_at!: Date;

  @CreateDateColumn({ type: 'timestamptz', nullable: false })
  created_at!: Date;
}
