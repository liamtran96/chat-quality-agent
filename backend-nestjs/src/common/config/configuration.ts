export default () => ({
  APP_ENV: process.env.APP_ENV || 'development',
  SERVER_PORT: parseInt(process.env.SERVER_PORT || '8080', 10),
  SERVER_HOST: process.env.SERVER_HOST || '0.0.0.0',

  // Database
  DATABASE_URL: process.env.DATABASE_URL || '',
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: parseInt(process.env.DB_PORT || '5432', 10),
  DB_USER: process.env.DB_USER || 'cqa',
  DB_PASSWORD: process.env.DB_PASSWORD || '',
  DB_NAME: process.env.DB_NAME || 'cqa',

  // Security
  JWT_SECRET: process.env.JWT_SECRET || '',
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || '',

  // Rate limiting
  RATE_LIMIT_PER_IP: parseInt(process.env.RATE_LIMIT_PER_IP || '500', 10),
  RATE_LIMIT_PER_USER: parseInt(process.env.RATE_LIMIT_PER_USER || '1000', 10),

  // AI
  AI_MAX_TOKENS: parseInt(process.env.AI_MAX_TOKENS || '16384', 10),
});
