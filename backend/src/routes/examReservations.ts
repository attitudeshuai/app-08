import Router from '@koa/router';
import prisma from '../lib/prisma';
import { authMiddleware, roleMiddleware } from '../middleware/auth';
import { success, badRequest, notFound } from '../utils/response';
import { getPaginationParams, buildPaginatedResult } from '../utils/pagination';
import {
  sendReservationSuccessNotification,
  sendReservationCancelNotification,
} from '../services/examReminderService';

const router = new Router({ prefix: '/api/exam-reservations' });

router.post('/:examId', authMiddleware, async (ctx) => {
  const examId = Number(ctx.params.examId);
  const userId = ctx.state.user.id;

  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam) {
    notFound(ctx, '考试');
    return;
  }

  if (exam.status !== 'PUBLISHED') {
    badRequest(ctx, '考试未发布，无法预约');
    return;
  }

  const now = new Date();
  if (now >= exam.startTime) {
    badRequest(ctx, '考试已开始，无法预约');
    return;
  }

  const existing = await prisma.examReservation.findUnique({
    where: { examId_userId: { examId, userId } },
  });
  if (existing) {
    badRequest(ctx, '您已预约该考试');
    return;
  }

  const reservation = await prisma.examReservation.create({
    data: {
      examId,
      userId,
    },
  });

  sendReservationSuccessNotification(userId, exam).catch((err) => {
    console.error('Failed to send reservation success notification:', err);
  });

  success(ctx, reservation);
});

router.delete('/:examId', authMiddleware, async (ctx) => {
  const examId = Number(ctx.params.examId);
  const userId = ctx.state.user.id;

  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam) {
    notFound(ctx, '考试');
    return;
  }

  const existing = await prisma.examReservation.findUnique({
    where: { examId_userId: { examId, userId } },
  });
  if (!existing) {
    badRequest(ctx, '您未预约该考试');
    return;
  }

  const now = new Date();
  if (now >= exam.startTime) {
    badRequest(ctx, '考试已开始，无法取消预约');
    return;
  }

  await prisma.examReservation.delete({
    where: { id: existing.id },
  });

  sendReservationCancelNotification(userId, exam).catch((err) => {
    console.error('Failed to send reservation cancel notification:', err);
  });

  success(ctx, { message: '取消预约成功' });
});

router.get('/mine', authMiddleware, async (ctx) => {
  const { page, pageSize, skip, take } = getPaginationParams(ctx.query);
  const userId = ctx.state.user.id;
  const status = ctx.query.status as string;

  const where: any = { userId };
  if (status) {
    where.exam = { status };
  }

  const [total, list] = await Promise.all([
    prisma.examReservation.count({ where }),
    prisma.examReservation.findMany({
      where,
      include: {
        exam: {
          include: {
            paper: { select: { id: true, title: true, totalScore: true, duration: true } },
            user: { select: { id: true, name: true } },
          },
        },
      },
      skip,
      take,
      orderBy: { exam: { startTime: 'asc' } },
    }),
  ]);

  const listWithStatus = list.map((reservation: any) => {
    const exam = reservation.exam;
    const now = new Date();
    let examStatus = exam.status;
    if (exam.status === 'PUBLISHED' && now > exam.endTime) {
      examStatus = 'ENDED';
    }
    return {
      ...reservation,
      exam: {
        ...exam,
        status: examStatus,
      },
    };
  });

  success(ctx, buildPaginatedResult(listWithStatus, total, page, pageSize));
});

router.get('/exam/:examId', authMiddleware, roleMiddleware('ADMIN', 'TEACHER'), async (ctx) => {
  const examId = Number(ctx.params.examId);
  const { page, pageSize, skip, take } = getPaginationParams(ctx.query);

  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam) {
    notFound(ctx, '考试');
    return;
  }

  const [total, list] = await Promise.all([
    prisma.examReservation.count({ where: { examId } }),
    prisma.examReservation.findMany({
      where: { examId },
      include: {
        user: { select: { id: true, username: true, name: true } },
      },
      skip,
      take,
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  success(ctx, buildPaginatedResult(list, total, page, pageSize));
});

router.get('/exam/:examId/count', authMiddleware, async (ctx) => {
  const examId = Number(ctx.params.examId);

  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam) {
    notFound(ctx, '考试');
    return;
  }

  const count = await prisma.examReservation.count({ where: { examId } });

  const userId = ctx.state.user.id;
  const userReservation = await prisma.examReservation.findUnique({
    where: { examId_userId: { examId, userId } },
  });

  success(ctx, {
    count,
    isReserved: !!userReservation,
  });
});

export default router;
