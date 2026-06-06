import Router from '@koa/router';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { generateToken } from '../utils/jwt';
import { authMiddleware } from '../middleware/auth';
import { success, badRequest, notFound } from '../utils/response';
import { config } from '../config';
import { LoginResponse, UserResponse } from '../types';

const router = new Router({ prefix: '/api/auth' });

router.post('/login', async (ctx) => {
  const { username, password } = ctx.request.body as { username?: string; password?: string };

  if (!username || !password) {
    badRequest(ctx, '用户名和密码不能为空');
    return;
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    badRequest(ctx, '用户不存在');
    return;
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    badRequest(ctx, '密码错误');
    return;
  }

  const token = generateToken({ id: user.id, username: user.username, role: user.role as any });

  const userResponse: UserResponse = {
    id: user.id,
    username: user.username,
    role: user.role,
    name: user.name,
  };

  const data: LoginResponse = {
    token,
    user: userResponse,
  };

  success(ctx, data);
});

router.get('/profile', authMiddleware, async (ctx) => {
  const userId = ctx.state.user.id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, role: true, name: true, createdAt: true },
  });

  if (!user) {
    notFound(ctx, '用户');
    return;
  }

  success(ctx, user);
});

export default router;
