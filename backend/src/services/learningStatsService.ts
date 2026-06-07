import prisma from '../lib/prisma';
import {
  LearningOverview,
  LearningOverviewStats,
  RecentLearningStats,
  ScoreTrendItem,
  SubjectLearningStat,
  WrongQuestionStat,
  ActivityCalendarItem,
} from '../types';
import { roundToTwo } from './paperService';

const DEFAULT_RECENT_DAYS = 30;
const PASS_SCORE_RATE = 0.6;

export async function getLearningOverview(
  userId: number,
  recentDays: number = DEFAULT_RECENT_DAYS
): Promise<LearningOverview> {
  const [overview, recentStats, scoreTrend, subjectStats, wrongQuestionStats, activityCalendar] =
    await Promise.all([
      getOverviewStats(userId),
      getRecentStats(userId, recentDays),
      getScoreTrend(userId),
      getSubjectStats(userId),
      getWrongQuestionStats(userId),
      getActivityCalendar(userId, recentDays),
    ]);

  return {
    overview,
    recentStats,
    scoreTrend,
    subjectStats,
    wrongQuestionStats,
    activityCalendar,
  };
}

async function getOverviewStats(userId: number): Promise<LearningOverviewStats> {
  const submittedRecords = await prisma.examRecord.findMany({
    where: {
      userId,
      status: { in: ['SUBMITTED', 'GRADED'] },
    },
    include: {
      exam: {
        include: {
          paper: {
            include: { items: true },
          },
        },
      },
    },
  });

  const totalExamsTaken = submittedRecords.length;

  let totalQuestionsAnswered = 0;
  let totalStudyTime = 0;
  let totalScoreSum = 0;
  let totalPossibleScore = 0;
  let passCount = 0;

  for (const record of submittedRecords) {
    if (record.exam?.paper) {
      totalQuestionsAnswered += record.exam.paper.items.length;
      totalPossibleScore += record.exam.paper.totalScore;
    }
    totalStudyTime += record.totalActiveTime || 0;
    if (record.totalScore !== null && record.totalScore !== undefined) {
      totalScoreSum += record.totalScore;
      if (record.exam?.paper) {
        const passScore = record.exam.paper.totalScore * PASS_SCORE_RATE;
        if (record.totalScore >= passScore) {
          passCount++;
        }
      }
    }
  }

  const totalWrongQuestions = await prisma.wrongQuestion.count({ where: { userId } });

  const avgScore = totalExamsTaken > 0 ? roundToTwo(totalScoreSum / totalExamsTaken) : 0;
  const accuracyRate = totalQuestionsAnswered > 0
    ? roundToTwo((totalQuestionsAnswered - totalWrongQuestions) / totalQuestionsAnswered)
    : 0;
  const passRate = totalExamsTaken > 0 ? roundToTwo(passCount / totalExamsTaken) : 0;

  return {
    totalExamsTaken,
    totalQuestionsAnswered,
    totalWrongQuestions,
    totalStudyTime,
    avgScore,
    accuracyRate,
    passRate,
  };
}

async function getRecentStats(userId: number, days: number): Promise<RecentLearningStats> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const submittedRecords = await prisma.examRecord.findMany({
    where: {
      userId,
      status: { in: ['SUBMITTED', 'GRADED'] },
      submitTime: { gte: startDate },
    },
    include: {
      exam: {
        include: {
          paper: { include: { items: true } },
        },
      },
    },
  });

  const examsTaken = submittedRecords.length;

  let questionsAnswered = 0;
  let studyTime = 0;
  let scoreSum = 0;

  for (const record of submittedRecords) {
    if (record.exam?.paper) {
      questionsAnswered += record.exam.paper.items.length;
    }
    studyTime += record.totalActiveTime || 0;
    if (record.totalScore !== null && record.totalScore !== undefined) {
      scoreSum += record.totalScore;
    }
  }

  const wrongQuestions = await prisma.wrongQuestion.count({
    where: { userId, createdAt: { gte: startDate } },
  });

  const avgScore = examsTaken > 0 ? roundToTwo(scoreSum / examsTaken) : 0;

  return {
    days,
    examsTaken,
    questionsAnswered,
    studyTime,
    avgScore,
    wrongQuestions,
  };
}

async function getScoreTrend(userId: number): Promise<ScoreTrendItem[]> {
  const submittedRecords = await prisma.examRecord.findMany({
    where: {
      userId,
      status: { in: ['SUBMITTED', 'GRADED'] },
      submitTime: { not: null },
    },
    include: {
      exam: {
        select: {
          id: true,
          title: true,
          paper: { select: { totalScore: true } },
        },
      },
    },
    orderBy: { submitTime: 'asc' },
    take: 20,
  });

  return submittedRecords
    .filter((r) => r.submitTime && r.exam?.paper)
    .map((record) => {
      const totalScore = record.exam?.paper?.totalScore || 100;
      const score = record.totalScore ?? 0;
      const scoreRate = totalScore > 0 ? roundToTwo(score / totalScore) : 0;
      return {
        examId: record.examId,
        examTitle: record.exam?.title || '',
        score,
        totalScore,
        scoreRate,
        submitTime: record.submitTime!,
      };
    });
}

async function getSubjectStats(userId: number): Promise<SubjectLearningStat[]> {
  const submittedRecords = await prisma.examRecord.findMany({
    where: {
      userId,
      status: { in: ['SUBMITTED', 'GRADED'] },
    },
    include: {
      exam: {
        include: {
          paper: {
            include: {
              items: {
                include: { question: { select: { subject: true } } },
              },
            },
          },
        },
      },
    },
  });

  const wrongQuestions = await prisma.wrongQuestion.findMany({
    where: { userId },
    select: { subject: true },
  });

  const subjectMap = new Map<string, {
    examsTaken: Set<number>;
    questionsAnswered: number;
    wrongCount: number;
    scoreSum: number;
    totalPossibleScore: number;
  }>();

  for (const record of submittedRecords) {
    const paper = record.exam?.paper;
    if (!paper) continue;

    const subjectsInExam = new Set<string>();

    for (const item of paper.items) {
      const subject = item.question?.subject;
      if (!subject) continue;
      subjectsInExam.add(subject);

      if (!subjectMap.has(subject)) {
        subjectMap.set(subject, {
          examsTaken: new Set(),
          questionsAnswered: 0,
          wrongCount: 0,
          scoreSum: 0,
          totalPossibleScore: 0,
        });
      }

      const stat = subjectMap.get(subject)!;
      stat.questionsAnswered++;
    }

    for (const subject of subjectsInExam) {
      const stat = subjectMap.get(subject)!;
      stat.examsTaken.add(record.examId);
      if (record.totalScore !== null && record.totalScore !== undefined) {
        stat.scoreSum += record.totalScore;
        stat.totalPossibleScore += paper.totalScore;
      }
    }
  }

  for (const wq of wrongQuestions) {
    const stat = subjectMap.get(wq.subject);
    if (stat) {
      stat.wrongCount++;
    } else {
      subjectMap.set(wq.subject, {
        examsTaken: new Set(),
        questionsAnswered: 0,
        wrongCount: 1,
        scoreSum: 0,
        totalPossibleScore: 0,
      });
    }
  }

  const result: SubjectLearningStat[] = [];
  for (const [subject, stat] of subjectMap.entries()) {
    const examsCount = stat.examsTaken.size;
    const avgScore = examsCount > 0 ? roundToTwo(stat.scoreSum / examsCount) : 0;
    const accuracyRate = stat.questionsAnswered > 0
      ? roundToTwo((stat.questionsAnswered - stat.wrongCount) / stat.questionsAnswered)
      : 0;

    result.push({
      subject,
      examsTaken: examsCount,
      questionsAnswered: stat.questionsAnswered,
      wrongQuestionCount: stat.wrongCount,
      avgScore,
      accuracyRate,
    });
  }

  result.sort((a, b) => b.questionsAnswered - a.questionsAnswered);

  return result;
}

async function getWrongQuestionStats(userId: number): Promise<WrongQuestionStat> {
  const totalCount = await prisma.wrongQuestion.count({ where: { userId } });

  const bySubjectGroups = await prisma.wrongQuestion.groupBy({
    by: ['subject'],
    where: { userId },
    _count: { subject: true },
    orderBy: { _count: { subject: 'desc' } },
  });

  const bySubject = bySubjectGroups.map((g) => ({
    subject: g.subject,
    count: g._count.subject,
  }));

  const wrongQuestionsWithDifficulty = await prisma.wrongQuestion.findMany({
    where: { userId },
    include: { question: { select: { difficulty: true } } },
  });

  const difficultyMap = new Map<string, number>();
  for (const wq of wrongQuestionsWithDifficulty) {
    const difficulty = wq.question?.difficulty || 'UNKNOWN';
    difficultyMap.set(difficulty, (difficultyMap.get(difficulty) || 0) + 1);
  }

  const byDifficulty = Array.from(difficultyMap.entries())
    .map(([difficulty, count]) => ({ difficulty, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalCount,
    bySubject,
    byDifficulty,
  };
}

async function getActivityCalendar(
  userId: number,
  days: number
): Promise<ActivityCalendarItem[]> {
  const result: ActivityCalendarItem[] = [];

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days + 1);
  startDate.setHours(0, 0, 0, 0);

  const submittedRecords = await prisma.examRecord.findMany({
    where: {
      userId,
      status: { in: ['SUBMITTED', 'GRADED'] },
      submitTime: { gte: startDate },
    },
    select: {
      submitTime: true,
      totalActiveTime: true,
      exam: {
        select: {
          paper: { select: { items: { select: { id: true } } } },
        },
      },
    },
  });

  const dayMap = new Map<string, { examCount: number; questionCount: number; studyTime: number }>();

  for (const record of submittedRecords) {
    if (!record.submitTime) continue;

    const dateKey = formatDateKey(new Date(record.submitTime));
    const questionCount = record.exam?.paper?.items?.length || 0;
    const studyTime = record.totalActiveTime || 0;

    if (!dayMap.has(dateKey)) {
      dayMap.set(dateKey, { examCount: 0, questionCount: 0, studyTime: 0 });
    }

    const dayStat = dayMap.get(dateKey)!;
    dayStat.examCount++;
    dayStat.questionCount += questionCount;
    dayStat.studyTime += studyTime;
  }

  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const dateKey = formatDateKey(date);
    const dayStat = dayMap.get(dateKey);

    result.push({
      date: dateKey,
      hasActivity: !!dayStat,
      examCount: dayStat?.examCount || 0,
      questionCount: dayStat?.questionCount || 0,
      studyTime: dayStat?.studyTime || 0,
    });
  }

  return result;
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatStudyTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}小时${minutes}分钟`;
  }
  if (minutes > 0) {
    return `${minutes}分钟${secs}秒`;
  }
  return `${secs}秒`;
}

export default {
  getLearningOverview,
  formatStudyTime,
};
