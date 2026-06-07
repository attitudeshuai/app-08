import prisma from '../lib/prisma';
import { calculateExamScore, getWrongQuestions } from './paperService';

const AUTO_SUBMIT_INTERVAL = 60 * 1000;
let autoSubmitTimer: NodeJS.Timeout | null = null;

export async function processAutoSubmit(): Promise<{ processed: number; failed: number }> {
  const now = new Date();
  let processed = 0;
  let failed = 0;

  const exams = await prisma.exam.findMany({
    where: {
      status: 'PUBLISHED',
      autoSubmit: true,
      endTime: { lte: now },
    },
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

  for (const exam of exams) {
    try {
      const records = await prisma.examRecord.findMany({
        where: {
          examId: exam.id,
          status: 'IN_PROGRESS',
        },
        include: { sessions: { orderBy: { enterTime: 'desc' }, take: 1 } },
      });

      for (const record of records) {
        try {
          await submitExamRecord(exam, record);
          processed++;
        } catch (err) {
          console.error(`Failed to auto-submit record ${record.id}:`, err);
          failed++;
        }
      }

      const allSubmitted = await prisma.examRecord.count({
        where: {
          examId: exam.id,
          status: { in: ['SUBMITTED', 'GRADED'] },
        },
      });

      const totalRecords = await prisma.examRecord.count({
        where: { examId: exam.id },
      });

      if (totalRecords > 0 && allSubmitted === totalRecords) {
        await prisma.exam.update({
          where: { id: exam.id },
          data: { status: 'ENDED' },
        });
      }
    } catch (err) {
      console.error(`Failed to process exam ${exam.id} for auto-submit:`, err);
      failed++;
    }
  }

  if (processed > 0) {
    console.log(`[AutoSubmit] Processed ${processed} records, ${failed} failed`);
  }

  return { processed, failed };
}

async function submitExamRecord(exam: any, record: any): Promise<void> {
  const now = new Date();
  const answers = record.answers as Record<number, string> | undefined;
  const paperItems = exam.paper?.items || [];

  let totalScore = 0;
  let wrongItems: any[] = [];
  if (paperItems.length > 0) {
    totalScore = calculateExamScore(paperItems, answers);
    wrongItems = getWrongQuestions(paperItems, answers);
  }

  let totalActiveTime = record.totalActiveTime || 0;
  const lastSession = record.sessions && record.sessions.length > 0 ? record.sessions[0] : null;
  if (lastSession && !lastSession.exitTime) {
    const sessionDuration = Math.floor((now.getTime() - lastSession.enterTime.getTime()) / 1000);
    totalActiveTime += sessionDuration;
  }

  await prisma.$transaction(async (tx) => {
    if (lastSession && !lastSession.exitTime) {
      await tx.examSession.update({
        where: { id: lastSession.id },
        data: { exitTime: now },
      });
    }

    await tx.examRecord.update({
      where: { id: record.id },
      data: {
        status: 'SUBMITTED',
        submitTime: now,
        totalScore,
        answers: answers || {},
        totalActiveTime,
        isAutoSubmitted: true,
      },
    });

    if (wrongItems.length > 0) {
      const wrongQuestionData = wrongItems.map((item) => ({
        userId: record.userId,
        questionId: item.questionId,
        examId: exam.id,
        examRecordId: record.id,
        userAnswer: item.userAnswer || null,
        correctAnswer: item.correctAnswer,
        subject: item.subject,
      }));
      await tx.wrongQuestion.createMany({
        data: wrongQuestionData,
      });
    }
  });
}

export function startAutoSubmitService(): void {
  if (autoSubmitTimer) {
    return;
  }

  console.log('[AutoSubmit] Service started');
  autoSubmitTimer = setInterval(() => {
    processAutoSubmit().catch((err) => {
      console.error('[AutoSubmit] Error in auto-submit process:', err);
    });
  }, AUTO_SUBMIT_INTERVAL);
}

export function stopAutoSubmitService(): void {
  if (autoSubmitTimer) {
    clearInterval(autoSubmitTimer);
    autoSubmitTimer = null;
    console.log('[AutoSubmit] Service stopped');
  }
}

export async function autoSubmitExam(examId: number, userId: number): Promise<any> {
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
    throw new Error('考试不存在');
  }

  const record = await prisma.examRecord.findUnique({
    where: { examId_userId: { examId, userId } },
    include: { sessions: { orderBy: { enterTime: 'desc' }, take: 1 } },
  });

  if (!record) {
    throw new Error('考试记录不存在');
  }

  if (record.status === 'SUBMITTED' || record.status === 'GRADED') {
    throw new Error('您已提交过该考试');
  }

  if (record.status !== 'IN_PROGRESS') {
    throw new Error('考试未进行中');
  }

  const now = new Date();
  const answers = record.answers as Record<number, string> | undefined;

  let totalScore = 0;
  let wrongItems: any[] = [];
  if (exam.paper && exam.paper.items) {
    totalScore = calculateExamScore(exam.paper.items as any, answers);
    wrongItems = getWrongQuestions(exam.paper.items as any, answers);
  }

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
        isAutoSubmitted: true,
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

  return updatedRecord;
}

export function calculateRemainingTime(endTime: Date | string): {
  totalSeconds: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
  isWarning: boolean;
} {
  const end = new Date(endTime).getTime();
  const now = Date.now();
  let totalSeconds = Math.floor((end - now) / 1000);

  const isExpired = totalSeconds <= 0;
  const isWarning = totalSeconds > 0 && totalSeconds <= 300;

  if (totalSeconds < 0) totalSeconds = 0;

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    totalSeconds,
    hours,
    minutes,
    seconds,
    isExpired,
    isWarning,
  };
}
