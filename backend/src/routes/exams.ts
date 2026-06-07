import Router from '@koa/router';
import prisma from '../lib/prisma';
import { authMiddleware, roleMiddleware } from '../middleware/auth';
import { success, badRequest, notFound } from '../utils/response';
import { getPaginationParams, buildPaginatedResult } from '../utils/pagination';
import { calculateExamScore, getWrongQuestions } from '../services/paperService';
import { ExamStatus, ExamRecordStatus, ExamMonitorItem } from '../types';

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
  const ipAddress = ctx.ip || ctx.request.ip;
  const userAgent = ctx.headers['user-agent'] || null;

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

  const isFirstEnter = !record || record.status === 'NOT_STARTED';

  if (!record) {
    record = await prisma.examRecord.create({
      data: {
        examId,
        userId,
        status: 'IN_PROGRESS',
        startTime: now,
        answers: {},
        enterCount: 1,
      },
    });
  } else if (record.status === 'NOT_STARTED') {
    record = await prisma.examRecord.update({
      where: { id: record.id },
      data: { status: 'IN_PROGRESS', startTime: now, enterCount: 1 },
    });
  } else if (record.status === 'SUBMITTED' || record.status === 'GRADED') {
    badRequest(ctx, '您已提交过该考试');
    return;
  } else if (record.status === 'IN_PROGRESS') {
    record = await prisma.examRecord.update({
      where: { id: record.id },
      data: { enterCount: { increment: 1 } },
    });
  }

  await prisma.examSession.create({
    data: {
      examId,
      userId,
      examRecordId: record.id,
      enterTime: now,
      ipAddress,
      userAgent,
    },
  });

  success(ctx, record);
});

router.post('/:id/submit', authMiddleware, async (ctx) => {
  const examId = Number(ctx.params.id);
  const userId = ctx.state.user.id;
  const { answers } = ctx.request.body as { answers?: Record<number, string> };

  const record = await prisma.examRecord.findUnique({
    where: { examId_userId: { examId, userId } },
    include: { sessions: { orderBy: { enterTime: 'desc' }, take: 1 } },
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

  const now = new Date();
  let totalActiveTime = record.totalActiveTime || 0;

  const lastSession = record.sessions && record.sessions.length > 0 ? record.sessions[0] : null;
  if (lastSession && !lastSession.exitTime) {
    const sessionDuration = Math.floor((now.getTime() - lastSession.enterTime.getTime()) / 1000);
    totalActiveTime += sessionDuration;
  }

  const updatedRecord = await prisma.$transaction(async (tx) => {
    if (lastSession && !lastSession.exitTime) {
      await tx.examSession.update({
        where: { id: lastSession.id },
        data: { exitTime: now },
      });
    }

    const recordUpdate = await tx.examRecord.update({
      where: { id: record.id },
      data: {
        status: 'SUBMITTED',
        submitTime: now,
        totalScore,
        answers: answers || {},
        totalActiveTime,
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

router.post('/:id/exit', authMiddleware, async (ctx) => {
  const examId = Number(ctx.params.id);
  const userId = ctx.state.user.id;

  const record = await prisma.examRecord.findUnique({
    where: { examId_userId: { examId, userId } },
    include: { sessions: { orderBy: { enterTime: 'desc' }, take: 1 } },
  });

  if (!record) {
    notFound(ctx, '考试记录');
    return;
  }

  if (record.status !== 'IN_PROGRESS') {
    badRequest(ctx, '考试未进行中');
    return;
  }

  const now = new Date();
  let totalActiveTime = record.totalActiveTime || 0;

  const lastSession = record.sessions && record.sessions.length > 0 ? record.sessions[0] : null;
  if (lastSession && !lastSession.exitTime) {
    const sessionDuration = Math.floor((now.getTime() - lastSession.enterTime.getTime()) / 1000);
    totalActiveTime += sessionDuration;

    await prisma.$transaction(async (tx) => {
      await tx.examSession.update({
        where: { id: lastSession.id },
        data: { exitTime: now },
      });

      await tx.examRecord.update({
        where: { id: record.id },
        data: { totalActiveTime },
      });
    });
  }

  success(ctx, { message: '退出成功', totalActiveTime });
});

router.post('/:id/heartbeat', authMiddleware, async (ctx) => {
  const examId = Number(ctx.params.id);
  const userId = ctx.state.user.id;

  const record = await prisma.examRecord.findUnique({
    where: { examId_userId: { examId, userId } },
  });

  if (!record || record.status !== 'IN_PROGRESS') {
    badRequest(ctx, '考试未进行中');
    return;
  }

  success(ctx, { status: 'ok', timestamp: new Date().toISOString() });
});

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) {
    return `${hours}小时${minutes}分${secs}秒`;
  }
  if (minutes > 0) {
    return `${minutes}分${secs}秒`;
  }
  return `${secs}秒`;
}

function calculateAbnormalStatus(
  record: any,
  examDurationMinutes: number
): { isAbnormal: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const examDurationSeconds = examDurationMinutes * 60;

  if (record.enterCount && record.enterCount > 3) {
    reasons.push(`进入考试${record.enterCount}次，超过正常范围`);
  }

  if (record.totalActiveTime && record.totalActiveTime > 0) {
    if (record.totalActiveTime > examDurationSeconds * 1.2) {
      reasons.push('答题用时明显超过考试规定时长');
    }
    if (record.totalActiveTime < examDurationSeconds * 0.2 && record.status === 'SUBMITTED') {
      reasons.push('答题用时明显过短，可能存在异常');
    }
  }

  if (record.status === 'IN_PROGRESS' && record.startTime) {
    const now = new Date();
    const elapsed = Math.floor((now.getTime() - new Date(record.startTime).getTime()) / 1000);
    if (elapsed > examDurationSeconds * 1.5) {
      reasons.push('考试进行时间远超规定时长');
    }
  }

  return {
    isAbnormal: reasons.length > 0,
    reasons,
  };
}

router.get('/:id/monitor', authMiddleware, roleMiddleware('ADMIN', 'TEACHER'), async (ctx) => {
  const examId = Number(ctx.params.id);

  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: { paper: { select: { id: true, title: true, duration: true, totalScore: true } } },
  });

  if (!exam) {
    notFound(ctx, '考试');
    return;
  }

  const examDuration = exam.paper?.duration || 0;

  const records = await prisma.examRecord.findMany({
    where: { examId },
    include: {
      user: { select: { id: true, username: true, name: true } },
      sessions: {
        orderBy: { enterTime: 'asc' },
        select: {
          id: true,
          enterTime: true,
          exitTime: true,
          ipAddress: true,
        },
      },
    },
    orderBy: { id: 'asc' },
  });

  const monitorList = records.map((record: any) => {
    const sessionsWithDuration = record.sessions.map((session: any) => {
      const endTime = session.exitTime ? new Date(session.exitTime) : new Date();
      const duration = Math.floor((endTime.getTime() - new Date(session.enterTime).getTime()) / 1000);
      return {
        id: session.id,
        enterTime: session.enterTime,
        exitTime: session.exitTime,
        ipAddress: session.ipAddress,
        duration,
      };
    });

    const { isAbnormal, reasons } = calculateAbnormalStatus(record, examDuration);

    return {
      id: record.id,
      userId: record.userId,
      username: record.user.username,
      name: record.user.name,
      status: record.status,
      startTime: record.startTime,
      submitTime: record.submitTime,
      enterCount: record.enterCount || 0,
      totalActiveTime: record.totalActiveTime || 0,
      totalActiveTimeFormatted: formatDuration(record.totalActiveTime || 0),
      examDuration,
      isAbnormal,
      abnormalReasons: reasons,
      sessions: sessionsWithDuration,
    };
  });

  const stats = {
    totalStudents: records.length,
    inProgressCount: records.filter((r: any) => r.status === 'IN_PROGRESS').length,
    submittedCount: records.filter((r: any) => r.status === 'SUBMITTED' || r.status === 'GRADED').length,
    notStartedCount: records.filter((r: any) => r.status === 'NOT_STARTED').length,
    abnormalCount: monitorList.filter((m: any) => m.isAbnormal).length,
  };

  success(ctx, {
    exam: {
      id: exam.id,
      title: exam.title,
      startTime: exam.startTime,
      endTime: exam.endTime,
      status: exam.status,
      paper: exam.paper,
    },
    stats,
    list: monitorList,
  });
});

router.get('/:id/statistics', authMiddleware, roleMiddleware('ADMIN', 'TEACHER'), async (ctx) => {
  const examId = Number(ctx.params.id);

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

  if (!exam) {
    notFound(ctx, '考试');
    return;
  }

  const records = await prisma.examRecord.findMany({
    where: { examId },
    include: { user: { select: { id: true, name: true, username: true } } },
    orderBy: { totalScore: 'desc' },
  });

  const submittedRecords = records.filter(
    (r: any) => r.status === 'SUBMITTED' || r.status === 'GRADED'
  );

  const scores = submittedRecords
    .map((r: any) => r.totalScore ?? 0)
    .sort((a: number, b: number) => a - b);

  const totalStudents = records.length;
  const submittedCount = submittedRecords.length;
  const submittedRate = totalStudents > 0 ? submittedCount / totalStudents : 0;

  let avgScore = 0;
  let highestScore = 0;
  let lowestScore = 0;
  let medianScore = 0;
  let standardDeviation = 0;
  const passScore = exam.paper?.totalScore ? exam.paper.totalScore * 0.6 : 60;
  let passCount = 0;

  if (scores.length > 0) {
    avgScore = scores.reduce((sum: number, s: number) => sum + s, 0) / scores.length;
    highestScore = scores[scores.length - 1];
    lowestScore = scores[0];
    passCount = scores.filter((s: number) => s >= passScore).length;

    const mid = Math.floor(scores.length / 2);
    medianScore = scores.length % 2 !== 0
      ? scores[mid]
      : (scores[mid - 1] + scores[mid]) / 2;

    const variance = scores.reduce((sum: number, s: number) => {
      return sum + Math.pow(s - avgScore, 2);
    }, 0) / scores.length;
    standardDeviation = Math.sqrt(variance);
  }

  const totalScore = exam.paper?.totalScore || 100;
  const scoreRanges = buildScoreRanges(totalScore);
  const scoreDistribution = calculateScoreDistribution(scores, scoreRanges);

  const questionStats = calculateQuestionStats(
    exam.paper?.items || [],
    submittedRecords as any[]
  );

  const typeStats = calculateDimensionStats(questionStats, 'type');
  const difficultyStats = calculateDimensionStats(questionStats, 'difficulty');
  const subjectStats = calculateDimensionStats(questionStats, 'subject');

  const statistics: any = {
    exam: {
      id: exam.id,
      title: exam.title,
      startTime: exam.startTime,
      endTime: exam.endTime,
      status: exam.status,
      paper: {
        id: exam.paper?.id,
        title: exam.paper?.title,
        totalScore: exam.paper?.totalScore,
        duration: exam.paper?.duration,
        totalQuestions: exam.paper?.items?.length || 0,
      },
    },
    overview: {
      totalStudents,
      submittedCount,
      submittedRate: roundToTwo(submittedRate),
      avgScore: roundToTwo(avgScore),
      highestScore,
      lowestScore,
      medianScore: roundToTwo(medianScore),
      passRate: roundToTwo(submittedCount > 0 ? passCount / submittedCount : 0),
      passScore: roundToTwo(passScore),
      standardDeviation: roundToTwo(standardDeviation),
    },
    scoreDistribution,
    questionStats,
    typeStats,
    difficultyStats,
    subjectStats,
  };

  success(ctx, statistics);
});

function buildScoreRanges(totalScore: number): Array<{ range: string; min: number; max: number }> {
  const ranges: Array<{ range: string; min: number; max: number }> = [];
  const interval = Math.ceil(totalScore / 10);

  for (let i = 0; i < 10; i++) {
    const min = i * interval;
    const max = i === 9 ? totalScore : (i + 1) * interval - 0.01;
    const rangeLabel = i === 9
      ? `${Math.floor(min)}-${totalScore}`
      : `${Math.floor(min)}-${Math.floor((i + 1) * interval - 1)}`;
    ranges.push({ range: rangeLabel, min, max });
  }

  return ranges;
}

function calculateScoreDistribution(
  scores: number[],
  ranges: Array<{ range: string; min: number; max: number }>
): Array<{ range: string; min: number; max: number; count: number; percentage: number }> {
  const total = scores.length;

  return ranges.map((r) => {
    const count = scores.filter((s) => s >= r.min && s <= r.max).length;
    return {
      range: r.range,
      min: r.min,
      max: r.max,
      count,
      percentage: total > 0 ? roundToTwo(count / total) : 0,
    };
  });
}

function calculateQuestionStats(
  paperItems: any[],
  submittedRecords: any[]
): any[] {
  if (submittedRecords.length === 0) {
    return paperItems.map((item: any) => ({
      questionId: item.questionId,
      sortOrder: item.sortOrder,
      type: item.question.type,
      content: item.question.content,
      score: item.score,
      difficulty: item.question.difficulty,
      subject: item.question.subject,
      correctCount: 0,
      wrongCount: 0,
      unansweredCount: 0,
      accuracyRate: 0,
      avgScore: 0,
      scoreRate: 0,
    }));
  }

  const totalRecords = submittedRecords.length;

  return paperItems.map((item: any) => {
    let correctCount = 0;
    let wrongCount = 0;
    let unansweredCount = 0;
    let totalGotScore = 0;

    for (const record of submittedRecords) {
      const answers = record.answers as Record<number, string> | undefined;
      const userAnswer = answers ? answers[item.questionId] : undefined;
      const hasAnswer = userAnswer !== undefined && userAnswer !== null && userAnswer !== '';

      if (!hasAnswer) {
        unansweredCount++;
        continue;
      }

      const isCorrect = isAnswerCorrect(item.question.type, userAnswer, item.question.answer);

      if (isCorrect) {
        correctCount++;
        totalGotScore += item.score;
      } else {
        wrongCount++;
      }
    }

    const accuracyRate = totalRecords > 0 ? roundToTwo(correctCount / totalRecords) : 0;
    const avgScore = totalRecords > 0 ? roundToTwo(totalGotScore / totalRecords) : 0;
    const scoreRate = item.score > 0 ? roundToTwo(avgScore / item.score) : 0;

    return {
      questionId: item.questionId,
      sortOrder: item.sortOrder,
      type: item.question.type,
      content: item.question.content,
      score: item.score,
      difficulty: item.question.difficulty,
      subject: item.question.subject,
      correctCount,
      wrongCount,
      unansweredCount,
      accuracyRate,
      avgScore,
      scoreRate,
    };
  });
}

function roundToTwo(num: number): number {
  return Math.round(num * 100) / 100;
}

function calculateDimensionStats(
  questionStats: any[],
  dimension: 'type' | 'difficulty' | 'subject'
): any[] {
  const groups: Record<string, any[]> = {};

  for (const qs of questionStats) {
    const key = String(qs[dimension]);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(qs);
  }

  const result: any[] = [];
  for (const [name, items] of Object.entries(groups)) {
    const questionCount = items.length;
    const totalScore = items.reduce((sum: number, item: any) => sum + item.score, 0);
    const totalCorrectCount = items.reduce((sum: number, item: any) => sum + item.correctCount, 0);
    const totalAvgScore = items.reduce((sum: number, item: any) => sum + item.avgScore, 0);
    const totalRecords = items.length > 0
      ? items[0].correctCount + items[0].wrongCount + items[0].unansweredCount
      : 0;

    const accuracyRate = totalRecords > 0 && questionCount > 0
      ? roundToTwo(totalCorrectCount / (totalRecords * questionCount))
      : 0;
    const avgScore = roundToTwo(totalAvgScore);
    const scoreRate = totalScore > 0 ? roundToTwo(avgScore / totalScore) : 0;

    result.push({
      name,
      questionCount,
      totalScore,
      correctCount: totalCorrectCount,
      accuracyRate,
      avgScore,
      scoreRate,
    });
  }

  return result;
}

function isAnswerCorrect(
  questionType: string,
  userAnswer: string,
  correctAnswer: string
): boolean {
  if (
    questionType === 'SINGLE_CHOICE' ||
    questionType === 'TRUE_FALSE' ||
    questionType === 'FILL_BLANK'
  ) {
    return String(userAnswer).trim().toLowerCase() === String(correctAnswer).trim().toLowerCase();
  } else if (questionType === 'MULTIPLE_CHOICE') {
    const userSorted = String(userAnswer)
      .split(',')
      .map((s) => s.trim())
      .sort()
      .join(',');
    const correctSorted = String(correctAnswer)
      .split(',')
      .map((s) => s.trim())
      .sort()
      .join(',');
    return userSorted === correctSorted;
  }
  return false;
}

router.get('/:id/monitor/export', authMiddleware, roleMiddleware('ADMIN', 'TEACHER'), async (ctx) => {
  const examId = Number(ctx.params.id);

  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: { paper: { select: { id: true, title: true, duration: true } } },
  });

  if (!exam) {
    notFound(ctx, '考试');
    return;
  }

  const examDuration = exam.paper?.duration || 0;

  const records = await prisma.examRecord.findMany({
    where: { examId },
    include: {
      user: { select: { id: true, username: true, name: true } },
      sessions: {
        orderBy: { enterTime: 'asc' },
        select: {
          id: true,
          enterTime: true,
          exitTime: true,
          ipAddress: true,
        },
      },
    },
    orderBy: { id: 'asc' },
  });

  const headers = [
    '学生姓名',
    '学号/用户名',
    '考试状态',
    '进入次数',
    '开始答题时间',
    '提交时间',
    '累计答题用时',
    '考试规定时长(分钟)',
    '是否异常',
    '异常原因',
    '各次进入时间',
    '各次退出时间',
    '各次IP地址',
  ];

  const statusMap: Record<string, string> = {
    NOT_STARTED: '未开始',
    IN_PROGRESS: '进行中',
    SUBMITTED: '已提交',
    GRADED: '已批改',
  };

  const rows = records.map((record: any) => {
    const { isAbnormal, reasons } = calculateAbnormalStatus(record, examDuration);
    const sessions = record.sessions || [];

    const enterTimes = sessions.map((s: any) => s.enterTime ? new Date(s.enterTime).toLocaleString('zh-CN') : '').join('; ');
    const exitTimes = sessions.map((s: any) => s.exitTime ? new Date(s.exitTime).toLocaleString('zh-CN') : '进行中').join('; ');
    const ipAddresses = sessions.map((s: any) => s.ipAddress || '未知').join('; ');

    return [
      record.user.name,
      record.user.username,
      statusMap[record.status] || record.status,
      String(record.enterCount || 0),
      record.startTime ? new Date(record.startTime).toLocaleString('zh-CN') : '',
      record.submitTime ? new Date(record.submitTime).toLocaleString('zh-CN') : '',
      formatDuration(record.totalActiveTime || 0),
      String(examDuration),
      isAbnormal ? '是' : '否',
      reasons.join('; '),
      enterTimes,
      exitTimes,
      ipAddresses,
    ];
  });

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const bom = '\uFEFF';
  const fileName = `考试监控报告_${exam.title}_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.csv`;

  ctx.set('Content-Type', 'text/csv; charset=utf-8');
  ctx.set('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
  ctx.body = bom + csvContent;
});

export default router;
