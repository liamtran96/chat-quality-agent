export interface AppConfig {
  serverPort: number;
  serverHost: string;
  dbHost: string;
  dbPort: number;
  dbUser: string;
  dbPassword: string;
  dbName: string;
  jwtSecret: string;
  encryptionKey: string;
  rateLimitPerIP: number;
  rateLimitPerUser: number;
  aiMaxTokens: number;
  env: string;
  appUrl: string;
}

export function loadAppConfig(): AppConfig {
  return {
    serverPort: parseInt(process.env.SERVER_PORT || '3000', 10),
    serverHost: process.env.SERVER_HOST || '127.0.0.1',
    dbHost: process.env.DB_HOST || 'localhost',
    dbPort: parseInt(process.env.DB_PORT || '5432', 10),
    dbUser: process.env.DB_USER || 'cqa',
    dbPassword: process.env.DB_PASSWORD || '',
    dbName: process.env.DB_NAME || 'cqa',
    jwtSecret: process.env.JWT_SECRET || '',
    encryptionKey: process.env.ENCRYPTION_KEY || '',
    rateLimitPerIP: parseInt(process.env.RATE_LIMIT_PER_IP || '500', 10),
    rateLimitPerUser: parseInt(process.env.RATE_LIMIT_PER_USER || '1000', 10),
    aiMaxTokens: parseInt(process.env.AI_MAX_TOKENS || '16384', 10),
    env: process.env.APP_ENV || 'development',
    appUrl: process.env.APP_URL || '',
  };
}
