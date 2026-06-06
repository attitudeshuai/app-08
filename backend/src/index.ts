import Koa from 'koa';
import cors from '@koa/cors';
import bodyParser from 'koa-bodyparser';
import Router from '@koa/router';
import { execSync } from 'child_process';
import prisma from './lib/prisma';
import { config, validateConfig } from './config';
import { success, internalError } from './utils/response';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import questionRoutes from './routes/questions';
import paperRoutes from './routes/papers';
import examRoutes from './routes/exams';

const app = new Koa();
const PORT = config.port;

function runMigrations(): void {
  try {
    console.log('Running prisma migrate deploy...');
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    console.log('Prisma migrations completed successfully.');
  } catch (err) {
    console.warn('Prisma migrate deploy failed, continuing without migrations...');
  }
}

async function bootstrap(): Promise<void> {
  try {
    validateConfig();
  } catch (err: any) {
    console.error('Configuration validation failed:', err.message);
    process.exit(1);
  }

  runMigrations();

  app.use(cors({
    origin: config.corsOrigin,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }));

  app.use(bodyParser({
    enableTypes: ['json', 'form', 'text'],
    encoding: 'utf-8',
    formLimit: '10mb',
    jsonLimit: '10mb',
  }));

  app.use(async (ctx, next) => {
    const start = Date.now();
    try {
      await next();
      const duration = Date.now() - start;
      console.log(`[${ctx.method}] ${ctx.url} - ${ctx.status} - ${duration}ms`);
    } catch (err: any) {
      const duration = Date.now() - start;
      console.error(`[${ctx.method}] ${ctx.url} - Error: ${err.message} - ${duration}ms`);
      internalError(ctx, err.message || '服务器内部错误');
    }
  });

  const healthRouter = new Router();
  healthRouter.get('/api/health', (ctx) => {
    success(ctx, {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });
  app.use(healthRouter.routes());

  app.use(authRoutes.routes());
  app.use(authRoutes.allowedMethods());
  app.use(userRoutes.routes());
  app.use(userRoutes.allowedMethods());
  app.use(questionRoutes.routes());
  app.use(questionRoutes.allowedMethods());
  app.use(paperRoutes.routes());
  app.use(paperRoutes.allowedMethods());
  app.use(examRoutes.routes());
  app.use(examRoutes.allowedMethods());

  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Environment: ${config.nodeEnv}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});
