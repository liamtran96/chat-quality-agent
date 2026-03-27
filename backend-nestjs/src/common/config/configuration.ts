export default () => ({
  database: {
    url: process.env.DATABASE_URL || 'postgres://cqa:cqa@localhost:5432/cqa',
  },
  jwt: {
    secret: process.env.JWT_SECRET || '',
  },
  encryption: {
    key: process.env.ENCRYPTION_KEY || '',
  },
  server: {
    port: parseInt(process.env.SERVER_PORT || '3000', 10),
  },
  app: {
    env: process.env.APP_ENV || 'development',
  },
});
