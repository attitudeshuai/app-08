import Router from '@koa/router';
import prisma from '../lib/prisma';
import { authMiddleware, roleMiddleware } from '../middleware/auth';
import { success } from '../utils/response';
import { getPaginationParams, buildPaginatedResult } from '../utils/pagination';

const router = new Router({ prefix: '/api/wrong-questions' });

router.get('/mine', authMiddleware, async (ctx) => {
  const { page, pageSize, skip, take } = getPaginationParams(ctx.query);
  const userId = ctx.state.user.id;
  const subject = ctx.query.subject as string;
  const examId = ctx.query.examId ? Number(ctx.query.examId) : undefined;
  const startDate = ctx.query.startDate as string;
  const endDate = ctx.query.endDate as string;

  const where: any = { userId };
  if (subject) where.subject = subject;
  if (examId) where.examId = examId;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  const [total, list] = await Promise.all([
    prisma.wrongQuestion.count({ where }),
    prisma.wrongQuestion.findMany({
      where,
      include: {
        question: {
          select: {
            id: true,
            type: true,
            content: true,
            options: true,
            score: true,
            analysis: true,
            subject: true,
            difficulty: true,
          },
        },
        exam: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  success(ctx, buildPaginatedResult(list, total, page, pageSize));
});

router.get('/mine/subjects', authMiddleware, async (ctx) => {
  const userId = ctx.state.user.id;

  const subjects = await prisma.wrongQuestion.groupBy({
    by: ['subject'],
    where: { userId },
    _count: { subject: true },
  });

  const result = subjects.map((item) => ({
    subject: item.subject,
    count: item._count.subject,
  }));

  success(ctx, result);
});

router.get('/stats/class', authMiddleware, roleMiddleware('ADMIN', 'TEACHER'), async (ctx) => {
  const { page, pageSize, skip, take } = getPaginationParams(ctx.query);
  const subject = ctx.query.subject as string;
  const examId = ctx.query.examId ? Number(ctx.query.examId) : undefined;

  const where: any = {};
  if (subject) where.subject = subject;
  if (examId) where.examId = examId;

  const wrongQuestionStats = await prisma.wrongQuestion.groupBy({
    by: ['questionId'],
    where,
    _count: { questionId: true },
    orderBy: { _count: { questionId: 'desc' } },
    skip,
    take,
  });

  const totalCount = await prisma.wrongQuestion.groupBy({
    by: ['questionId'],
    where,
  }).then((groups) => groups.length);

  const questionIds = wrongQuestionStats.map((item) => item.questionId);
  const questions = await prisma.question.findMany({
    where: { id: { in: questionIds } },
    select: {
      id: true,
      type: true,
      content: true,
      options: true,
      answer: true,
      score: true,
      analysis: true,
      subject: true,
      difficulty: true,
    },
  });

  const questionMap = new Map(questions.map((q) => [q.id, q]));

  const list = wrongQuestionStats.map((stat) => ({
    question: questionMap.get(stat.questionId),
    wrongCount: stat._count.questionId,
  }));

  success(ctx, buildPaginatedResult(list, totalCount, page, pageSize));
});

export default router;
