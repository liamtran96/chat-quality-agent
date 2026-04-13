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
}
