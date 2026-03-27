import { registerAs } from '@nestjs/config';

export interface AppConfig {
  server: {
    port: number;
    host: string;
  };
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    name: string;
    url?: string;
  };
  jwt: {
    secret: string;
  };
  encryption: {
    key: string;
  };
  rateLimit: {
    perIP: number;
    perUser: number;
  };
  env: string;
}

export default registerAs('app', (): AppConfig => {
  const jwtSecret = process.env.JWT_SECRET ?? '';
  const encryptionKey = process.env.ENCRYPTION_KEY ?? '';
  const dbPassword = process.env.DB_PASSWORD ?? '';
  const env = process.env.APP_ENV ?? 'development';

  if (!jwtSecret) {
    throw new Error('JWT_SECRET is required');
  }
  if (jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters for HS256 security');
  }
  if (!encryptionKey) {
    throw new Error('ENCRYPTION_KEY is required');
  }
  if (encryptionKey.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be exactly 32 bytes for AES-256-GCM');
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl && !dbPassword) {
    throw new Error('DB_PASSWORD is required when DATABASE_URL is not set');
  }

  let dbHost = process.env.DB_HOST ?? 'localhost';
  let dbPort = parseInt(process.env.DB_PORT ?? '5432', 10);
  let dbUser = process.env.DB_USER ?? 'cqa';
  let dbName = process.env.DB_NAME ?? 'cqa';
  let dbPass = dbPassword;

  if (databaseUrl) {
    const parsed = new URL(databaseUrl);
    dbHost = parsed.hostname;
    dbPort = parseInt(parsed.port || '5432', 10);
    dbUser = parsed.username;
    dbPass = parsed.password;
    dbName = parsed.pathname.replace(/^\//, '');
  }

  return {
    server: {
      port: parseInt(process.env.SERVER_PORT ?? '8080', 10),
      host: process.env.SERVER_HOST ?? '127.0.0.1',
    },
    database: {
      host: dbHost,
      port: dbPort,
      username: dbUser,
      password: dbPass,
      name: dbName,
      url: databaseUrl,
    },
    jwt: {
      secret: jwtSecret,
    },
    encryption: {
      key: encryptionKey,
    },
    rateLimit: {
      perIP: parseInt(process.env.RATE_LIMIT_PER_IP ?? '500', 10),
      perUser: parseInt(process.env.RATE_LIMIT_PER_USER ?? '1000', 10),
    },
    env,
  };
});
