export default () => ({
  port: parseInt(process.env.SERVER_PORT || '3000', 10),
  host: process.env.SERVER_HOST || '127.0.0.1',
  jwtSecret: process.env.JWT_SECRET || '',
  encryptionKey: process.env.ENCRYPTION_KEY || '',
  env: process.env.APP_ENV || 'development',
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USER || 'cqa',
    password: process.env.DB_PASSWORD || '',
    name: process.env.DB_NAME || 'cqa',
  },
});
