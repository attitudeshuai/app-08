import Router from '@koa/router';
import prisma from '../lib/prisma';
import { authMiddleware, roleMiddleware } from '../middleware/auth';
import { success, badRequest, notFound } from '../utils/response';
import { getPaginationParams, buildPaginatedResult } from '../utils/pagination';
import { calculateExamScore, getWrongQuestions } from '../services/paperService';
import { ExamStatus, ExamRecordStatus } from '../types';

const router = new Router({ prefix: '/api/exams' });

const validExamStatuses: ExamStatus[] = ['DRAFT', 'PUBLISHED', 'ENDED'];

router.get('/', authMiddleware, async (ctx) => {
  const { page, pageSize, skip, take } = getPaginationParams(ctx.query);
  const status = ctx.query.status as string;
  const user = ctx.state.user;

  const where: any = {};
  if (status) where.status = status;
  if (user.role === 'STUDENT') {
    where.status = 'PUBLISHED';
  }

  const [total, list] = await Promise.all([
    prisma.exam.count({ where }),
    prisma.exam.findMany({
      where,
      include: {
        paper: { select: { id: true, title: true, totalScore: true, duration: true } },
        user: { select: { id: true, name: true } },
      },
      skip,
      take,
      orderBy: { id: 'desc' },
    }),
  ]);

  success(ctx, buildPaginatedResult(list, total, page, pageSize));
});

router.get('/:id', authMiddleware, async (ctx) => {
  const id = Number(ctx.params.id);
  const exam = await prisma.exam.findUnique({
    where: { id },
    include: {
      paper: {
        include: {
          items: {
            include: { question: true },
            orderBy: { sortOrder: 'asc' },
          },
        },
      },
      user: { select: { id: true, name: true } },
    },
  });

  if (!exam) {
    notFound(ctx, '考试');
    return;
  }

  const user = ctx.state.user;
  if (user.role === 'STUDENT') {
    if (exam.paper && exam.paper.items) {
      (exam.paper.items as any) = exam.paper.items.map((item: any) => {
        const { question, ...rest } = item;
        if (question) {
          const { answer, analysis, ...questionRest } = question;
          return { ...rest, question: questionRest };
        }
        return item;
      });
    }
  }

  success(ctx, exam);
});

router.post('/', authMiddleware, roleMiddleware('ADMIN', 'TEACHER'), async (ctx) => {
  const { title, paperId, startTime, endTime, status } = ctx.request.body as {
    title?: string;
    paperId?: number;
    startTime?: string;
    endTime?: string;
    status?: ExamStatus;
  };
  const userId = ctx.state.user.id;

  if (!title || !paperId || !startTime || !endTime) {
    badRequest(ctx, '缺少必填字段');
    return;
  }

  if (status && !validExamStatuses.includes(status)) {
    badRequest(ctx, '无效的考试状态');
    return;
  }

  const paper = await prisma.paper.findUnique({ where: { id: paperId } });
  if (!paper) {
    badRequest(ctx, '试卷不存在');
    return;
  }

  const start = new Date(startTime);
  const end = new Date(endTime);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    badRequest(ctx, '无效的日期格式');
    return;
  }

  if (start >= end) {
    badRequest(ctx, '开始时间必须早于结束时间');
    return;
  }

  const exam = await prisma.exam.create({
    data: {
      title,
      paperId,
      startTime: start,
      endTime: end,
      status: status || 'DRAFT',
      createdBy: userId,
    },
  });

  success(ctx, exam);
});

router.put('/:id', authMiddleware, roleMiddleware('ADMIN', 'TEACHER'), async (ctx) => {
  const id = Number(ctx.params.id);
  const { title, paperId, startTime, endTime, status } = ctx.request.body as {
    title?: string;
    paperId?: number;
    startTime?: string;
    endTime?: string;
    status?: ExamStatus;
  };

  const existing = await prisma.exam.findUnique({ where: { id } });
  if (!existing) {
    notFound(ctx, '考试');
    return;
  }

  if (status && !validExamStatuses.includes(status)) {
    badRequest(ctx, '无效的考试状态');
    return;
  }

  if (paperId) {
    const paper = await prisma.paper.findUnique({ where: { id: paperId } });
    if (!paper) {
      badRequest(ctx, '试卷不存在');
      return;
    }
  }

  const data: any = {};
  if (title) data.title = title;
  if (paperId) data.paperId = paperId;
  if (startTime) {
    const start = new Date(startTime);
    if (isNaN(start.getTime())) {
      badRequest(ctx, '无效的开始时间格式');
      return;
    }
    data.startTime = start;
  }
  if (endTime) {
    const end = new Date(endTime);
    if (isNaN(end.getTime())) {
      badRequest(ctx, '无效的结束时间格式');
      return;
    }
    data.endTime = end;
  }
  if (status) data.status = status;

  const exam = await prisma.exam.update({ where: { id }, data });
  success(ctx, exam);
});

router.delete('/:id', authMiddleware, roleMiddleware('ADMIN', 'TEACHER'), async (ctx) => {
  const id = Number(ctx.params.id);

  const existing = await prisma.exam.findUnique({ where: { id } });
  if (!existing) {
    notFound(ctx, '考试');
    return;
  }

  await prisma.exam.delete({ where: { id } });
  success(ctx);
});

router.post('/:id/start', authMiddleware, async (ctx) => {
  const examId = Number(ctx.params.id);
  const userId = ctx.state.user.id;

  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam) {
    notFound(ctx, '考试');
    return;
  }

  if (exam.status !== 'PUBLISHED') {
    badRequest(ctx, '考试未开放');
    return;
  }

  const now = new Date();
  if (now < exam.startTime) {
    badRequest(ctx, '考试尚未开始');
    return;
  }
  if (now > exam.endTime) {
    badRequest(ctx, '考试已结束');
    return;
  }

  let record = await prisma.examRecord.findUnique({
    where: { examId_userId: { examId, userId } },
  });

  if (!record) {
    record = await prisma.examRecord.create({
      data: {
        examId,
        userId,
        status: 'IN_PROGRESS',
        startTime: now,
        answers: {},
      },
    });
  } else if (record.status === 'NOT_STARTED') {
    record = await prisma.examRecord.update({
      where: { id: record.id },
      data: { status: 'IN_PROGRESS', startTime: now },
    });
  } else if (record.status === 'SUBMITTED' || record.status === 'GRADED') {
    badRequest(ctx, '您已提交过该考试');
    return;
  }

  success(ctx, record);
});

router.post('/:id/submit', authMiddleware, async (ctx) => {
  const examId = Number(ctx.params.id);
  const userId = ctx.state.user.id;
  const { answers } = ctx.request.body as { answers?: Record<number, string> };

  const record = await prisma.examRecord.findUnique({
    where: { examId_userId: { examId, userId } },
  });

  if (!record) {
    notFound(ctx, '考试记录');
    return;
  }

  if (record.status === 'SUBMITTED' || record.status === 'GRADED') {
    badRequest(ctx, '您已提交过该考试');
    return;
  }

  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      paper: {
        include: {
          items: {
            include: { question: true },
            orderBy: { sortOrder: 'asc' },
          },
        },
      },
    },
  });

  let totalScore = 0;
  let wrongItems: any[] = [];
  if (exam && exam.paper && exam.paper.items) {
    totalScore = calculateExamScore(exam.paper.items as any, answers);
    wrongItems = getWrongQuestions(exam.paper.items as any, answers);
  }

  const updatedRecord = await prisma.$transaction(async (tx) => {
    const recordUpdate = await tx.examRecord.update({
      where: { id: record.id },
      data: {
        status: 'SUBMITTED',
        submitTime: new Date(),
        totalScore,
        answers: answers || {},
      },
    });

    if (wrongItems.length > 0) {
      const wrongQuestionData = wrongItems.map((item) => ({
        userId,
        questionId: item.questionId,
        examId,
        examRecordId: record.id,
        userAnswer: item.userAnswer || null,
        correctAnswer: item.correctAnswer,
        subject: item.subject,
      }));
      await tx.wrongQuestion.createMany({
        data: wrongQuestionData,
      });
    }

    return recordUpdate;
  });

  success(ctx, updatedRecord);
});

router.get('/:id/result', authMiddleware, async (ctx) => {
  const examId = Number(ctx.params.id);
  const userId = ctx.state.user.id;

  const record = await prisma.examRecord.findUnique({
    where: { examId_userId: { examId, userId } },
  });

  if (!record) {
    notFound(ctx, '考试记录');
    return;
  }

  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      paper: {
        include: {
          items: {
            include: { question: true },
            orderBy: { sortOrder: 'asc' },
          },
        },
      },
    },
  });

  const result: any = { ...record };
  if (exam && exam.paper) {
    result.paperTitle = exam.paper.title;
    result.totalQuestions = exam.paper.items.length;
    result.totalPossibleScore = exam.paper.totalScore;
    result.paper = {
      id: exam.paper.id,
      title: exam.paper.title,
      totalScore: exam.paper.totalScore,
      duration: exam.paper.duration,
      items: exam.paper.items.map((item: any) => ({
        id: item.id,
        questionId: item.questionId,
        score: item.score,
        sortOrder: item.sortOrder,
        question: item.question,
      })),
    };
  }

  success(ctx, result);
});

router.get('/:id/records', authMiddleware, roleMiddleware('ADMIN', 'TEACHER'), async (ctx) => {
  const examId = Number(ctx.params.id);

  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam) {
    notFound(ctx, '考试');
    return;
  }

  const records = await prisma.examRecord.findMany({
    where: { examId },
    include: {
      user: { select: { id: true, username: true, name: true } },
    },
    orderBy: { id: 'asc' },
  });

  success(ctx, records);
});

export default router;
