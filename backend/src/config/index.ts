export const config = {
  port: Number(process.env.PORT) || 3008,
  jwtSecret: process.env.JWT_SECRET || 'exam-system-secret-key-2024',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  databaseUrl: process.env.DATABASE_URL || '',
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  bcryptSaltRounds: 10,
  defaultPageSize: 10,
  maxPageSize: 100,
  monitor: {
    defaultMaxTabSwitchCount: 10,
    defaultMaxIpChangeCount: 3,
    defaultMonitorEnabled: true,
    heartbeatInterval: 30,
  },
} as const;

export function validateConfig(): void {
  const missing: string[] = [];

  if (!process.env.DATABASE_URL && config.nodeEnv === 'production') {
    missing.push('DATABASE_URL');
  }

  if (!process.env.JWT_SECRET && config.nodeEnv === 'production') {
    console.warn('Warning: JWT_SECRET is not set, using default value. This is insecure in production.');
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
