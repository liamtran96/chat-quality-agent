export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USER || 'cqa',
    password: process.env.DB_PASS || 'cqa',
    database: process.env.DB_NAME || 'cqa',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },
  filesPath: process.env.FILES_PATH || '/var/lib/cqa/files',
});
