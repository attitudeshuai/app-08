import Router from '@koa/router';
import prisma from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { success, notFound, badRequest } from '../utils/response';
import { getPaginationParams, buildPaginatedResult } from '../utils/pagination';
import { NotificationType } from '../types';

const router = new Router({ prefix: '/api/notifications' });

const validTypes: NotificationType[] = [
  'SYSTEM',
  'EXAM_REMINDER_24H',
  'EXAM_REMINDER_1H',
  'EXAM_REMINDER_15M',
  'EXAM_START',
  'EXAM_RESULT',
];

router.get('/', authMiddleware, async (ctx) => {
  const { page, pageSize, skip, take } = getPaginationParams(ctx.query);
  const userId = ctx.state.user.id;
  const isRead = ctx.query.isRead as string;
  const type = ctx.query.type as string;

  const where: any = { userId };
  if (isRead !== undefined && isRead !== '') {
    where.isRead = isRead === 'true';
  }
  if (type) {
    where.type = type;
  }

  const [total, list] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  success(ctx, buildPaginatedResult(list, total, page, pageSize));
});

router.get('/unread-count', authMiddleware, async (ctx) => {
  const userId = ctx.state.user.id;

  const count = await prisma.notification.count({
    where: { userId, isRead: false },
  });

  success(ctx, { count });
});

router.get('/:id', authMiddleware, async (ctx) => {
  const id = Number(ctx.params.id);
  const userId = ctx.state.user.id;

  const notification = await prisma.notification.findUnique({
    where: { id },
  });

  if (!notification) {
    notFound(ctx, '通知');
    return;
  }

  if (notification.userId !== userId) {
    badRequest(ctx, '无权查看该通知');
    return;
  }

  success(ctx, notification);
});

router.put('/:id/read', authMiddleware, async (ctx) => {
  const id = Number(ctx.params.id);
  const userId = ctx.state.user.id;

  const notification = await prisma.notification.findUnique({
    where: { id },
  });

  if (!notification) {
    notFound(ctx, '通知');
    return;
  }

  if (notification.userId !== userId) {
    badRequest(ctx, '无权操作该通知');
    return;
  }

  const updated = await prisma.notification.update({
    where: { id },
    data: { isRead: true },
  });

  success(ctx, updated);
});

router.put('/read-all', authMiddleware, async (ctx) => {
  const userId = ctx.state.user.id;

  const result = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });

  success(ctx, { updatedCount: result.count });
});

router.delete('/:id', authMiddleware, async (ctx) => {
  const id = Number(ctx.params.id);
  const userId = ctx.state.user.id;

  const notification = await prisma.notification.findUnique({
    where: { id },
  });

  if (!notification) {
    notFound(ctx, '通知');
    return;
  }

  if (notification.userId !== userId) {
    badRequest(ctx, '无权删除该通知');
    return;
  }

  await prisma.notification.delete({
    where: { id },
  });

  success(ctx);
});

router.delete('/', authMiddleware, async (ctx) => {
  const userId = ctx.state.user.id;
  const isRead = ctx.query.isRead as string;

  const where: any = { userId };
  if (isRead !== undefined && isRead !== '') {
    where.isRead = isRead === 'true';
  }

  const result = await prisma.notification.deleteMany({ where });

  success(ctx, { deletedCount: result.count });
});

export default router;
