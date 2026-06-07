import Router from '@koa/router';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { authMiddleware, roleMiddleware } from '../middleware/auth';
import { success, badRequest, notFound } from '../utils/response';
import { getPaginationParams, buildPaginatedResult } from '../utils/pagination';
import { config } from '../config';
import { UserRole } from '../types';
import { getLearningOverview } from '../services/learningStatsService';

const router = new Router({ prefix: '/api/users' });

router.get('/me', authMiddleware, async (ctx) => {
  const userId = ctx.state.user.id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, role: true, name: true, createdAt: true, updatedAt: true },
  });

  if (!user) {
    notFound(ctx, '用户');
    return;
  }

  success(ctx, user);
});

router.get('/me/learning-overview', authMiddleware, async (ctx) => {
  const userId = ctx.state.user.id;
  const days = ctx.query.days ? Number(ctx.query.days) : undefined;

  const overview = await getLearningOverview(userId, days);
  success(ctx, overview);
});

router.get('/', authMiddleware, roleMiddleware('ADMIN', 'TEACHER'), async (ctx) => {
  const { page, pageSize, skip, take } = getPaginationParams(ctx.query);
  const role = ctx.query.role as string;
  const keyword = ctx.query.keyword as string;

  const where: any = {};
  if (role) where.role = role;
  if (keyword) {
    where.OR = [
      { username: { contains: keyword } },
      { name: { contains: keyword } },
    ];
  }

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: { id: true, username: true, role: true, name: true, createdAt: true, updatedAt: true },
      skip,
      take,
      orderBy: { id: 'asc' },
    }),
  ]);

  success(ctx, buildPaginatedResult(users, total, page, pageSize));
});

router.post('/', authMiddleware, roleMiddleware('ADMIN', 'TEACHER'), async (ctx) => {
  const { username, password, role, name } = ctx.request.body as {
    username?: string;
    password?: string;
    role?: string;
    name?: string;
  };

  if (!username || !password || !role || !name) {
    badRequest(ctx, '缺少必填字段');
    return;
  }

  const validRoles: UserRole[] = ['ADMIN', 'TEACHER', 'STUDENT'];
  if (!validRoles.includes(role as UserRole)) {
    badRequest(ctx, '无效的用户角色');
    return;
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    badRequest(ctx, '用户名已存在');
    return;
  }

  const hashedPassword = await bcrypt.hash(password, config.bcryptSaltRounds);
  const user = await prisma.user.create({
    data: { username, password: hashedPassword, role, name },
    select: { id: true, username: true, role: true, name: true, createdAt: true },
  });

  success(ctx, user);
});

router.put('/:id', authMiddleware, roleMiddleware('ADMIN', 'TEACHER'), async (ctx) => {
  const id = Number(ctx.params.id);
  const { role, name, password } = ctx.request.body as {
    role?: string;
    name?: string;
    password?: string;
  };

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    notFound(ctx, '用户');
    return;
  }

  const data: any = {};
  if (role) {
    const validRoles: UserRole[] = ['ADMIN', 'TEACHER', 'STUDENT'];
    if (!validRoles.includes(role as UserRole)) {
      badRequest(ctx, '无效的用户角色');
      return;
    }
    data.role = role;
  }
  if (name) data.name = name;
  if (password) data.password = await bcrypt.hash(password, config.bcryptSaltRounds);

  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, username: true, role: true, name: true, updatedAt: true },
  });

  success(ctx, user);
});

router.delete('/:id', authMiddleware, roleMiddleware('ADMIN'), async (ctx) => {
  const id = Number(ctx.params.id);

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    notFound(ctx, '用户');
    return;
  }

  await prisma.user.delete({ where: { id } });
  success(ctx);
});

export default router;
