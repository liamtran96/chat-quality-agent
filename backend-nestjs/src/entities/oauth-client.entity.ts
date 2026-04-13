import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('oauth_clients')
export class OAuthClient {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true, nullable: false, name: 'client_id' })
  client_id: string;

  @Column({ type: 'varchar', length: 255, nullable: false, name: 'client_secret_hash' })
  client_secret_hash: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name: string;

  @Column({ type: 'jsonb', nullable: true, name: 'redirect_uris' })
  redirect_uris: any;

  @Column({ type: 'jsonb', nullable: true })
  scopes: any;

  @Column({ type: 'uuid', nullable: true, name: 'user_id' })
  user_id: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  created_at: Date;
}
