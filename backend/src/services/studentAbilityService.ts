import prisma from '../lib/prisma';
import {
  AbilityRadarData,
  RadarDimension,
  WeakKnowledgePoint,
  RecommendedQuestion,
  StudentAbilityAnalysis,
} from '../types';
import { roundToTwo } from './paperService';

const FULL_MARK = 100;
const DEFAULT_RECOMMEND_COUNT = 5;
const MAX_WEAK_POINTS = 5;

export async function getStudentAbilityAnalysis(
  userId: number,
  recommendCount: number = DEFAULT_RECOMMEND_COUNT
): Promise<StudentAbilityAnalysis> {
  const [radarData, weakKnowledgePoints] = await Promise.all([
    getAbilityRadarData(userId),
    getWeakKnowledgePoints(userId),
  ]);

  const recommendedQuestions = await getRecommendedQuestions(
    userId,
    weakKnowledgePoints,
    recommendCount
  );

  const overallSummary = generateOverallSummary(radarData, weakKnowledgePoints);

  return {
    radarData,
    weakKnowledgePoints,
    recommendedQuestions,
    overallSummary,
  };
}

export async function getAbilityRadarData(userId: number): Promise<AbilityRadarData> {
  const submittedRecords = await prisma.examRecord.findMany({
    where: {
      userId,
      status: { in: ['SUBMITTED', 'GRADED'] },
      submitTime: { not: null },
    },
    include: {
      exam: {
        include: {
          paper: {
            include: {
              items: {
                include: { question: true },
              },
            },
          },
        },
      },
    },
    orderBy: { submitTime: 'asc' },
  });

  const examCount = submittedRecords.length;

  if (examCount === 0) {
    return {
      dimensions: getEmptyDimensions(),
      overallScore: 0,
      examCount: 0,
      analysisDate: new Date(),
    };
  }

  const knowledgeMastery = calculateKnowledgeMastery(submittedRecords);
  const answerSpeed = calculateAnswerSpeed(submittedRecords);
  const accuracyStability = calculateAccuracyStability(submittedRecords);
  const scoreTrend = calculateScoreTrend(submittedRecords);
  const difficultyAdapt = calculateDifficultyAdaptability(submittedRecords);

  const dimensions: RadarDimension[] = [
    {
      name: '知识掌握度',
      key: 'knowledgeMastery',
      value: knowledgeMastery,
      fullMark: FULL_MARK,
      description: '基于各学科知识点的正确率综合评估',
    },
    {
      name: '答题速度',
      key: 'answerSpeed',
      value: answerSpeed,
      fullMark: FULL_MARK,
      description: '单位时间内完成题目的效率评估',
    },
    {
      name: '正确率稳定性',
      key: 'accuracyStability',
      value: accuracyStability,
      fullMark: FULL_MARK,
      description: '历次考试正确率的波动情况',
    },
    {
      name: '成绩进步度',
      key: 'scoreTrend',
      value: scoreTrend,
      fullMark: FULL_MARK,
      description: '近期成绩的上升或下降趋势',
    },
    {
      name: '难题适应力',
      key: 'difficultyAdapt',
      value: difficultyAdapt,
      fullMark: FULL_MARK,
      description: '面对不同难度题目的应对能力',
    },
  ];

  const overallScore = roundToTwo(
    dimensions.reduce((sum, d) => sum + d.value, 0) / dimensions.length
  );

  return {
    dimensions,
    overallScore,
    examCount,
    analysisDate: new Date(),
  };
}

function getEmptyDimensions(): RadarDimension[] {
  return [
    { name: '知识掌握度', key: 'knowledgeMastery', value: 0, fullMark: FULL_MARK, description: '基于各学科知识点的正确率综合评估' },
    { name: '答题速度', key: 'answerSpeed', value: 0, fullMark: FULL_MARK, description: '单位时间内完成题目的效率评估' },
    { name: '正确率稳定性', key: 'accuracyStability', value: 0, fullMark: FULL_MARK, description: '历次考试正确率的波动情况' },
    { name: '成绩进步度', key: 'scoreTrend', value: 0, fullMark: FULL_MARK, description: '近期成绩的上升或下降趋势' },
    { name: '难题适应力', key: 'difficultyAdapt', value: 0, fullMark: FULL_MARK, description: '面对不同难度题目的应对能力' },
  ];
}

function calculateKnowledgeMastery(records: any[]): number {
  const subjectStats = new Map<string, { correct: number; total: number }>();

  for (const record of records) {
    const paper = record.exam?.paper;
    if (!paper || !paper.items) continue;

    const answers = record.answers as Record<string, string> | null;
    if (!answers) continue;

    for (const item of paper.items) {
      const question = item.question;
      if (!question) continue;

      const subject = question.subject || '未知';
      if (!subjectStats.has(subject)) {
        subjectStats.set(subject, { correct: 0, total: 0 });
      }

      const stat = subjectStats.get(subject)!;
      stat.total++;

      const userAnswer = answers[`q_${question.id}`];
      if (userAnswer && userAnswer === question.answer) {
        stat.correct++;
      }
    }
  }

  if (subjectStats.size === 0) return 0;

  let totalAccuracy = 0;
  for (const stat of subjectStats.values()) {
    if (stat.total > 0) {
      totalAccuracy += stat.correct / stat.total;
    }
  }

  const avgAccuracy = totalAccuracy / subjectStats.size;
  return roundToTwo(avgAccuracy * FULL_MARK);
}

function calculateAnswerSpeed(records: any[]): number {
  const speedScores: number[] = [];

  for (const record of records) {
    const paper = record.exam?.paper;
    if (!paper || !paper.items) continue;

    const totalQuestions = paper.items.length;
    const duration = paper.duration;
    const activeTime = record.totalActiveTime || 0;

    if (totalQuestions === 0 || duration === 0 || activeTime === 0) continue;

    const expectedTimePerQuestion = (duration * 60) / totalQuestions;
    const actualTimePerQuestion = activeTime / totalQuestions;

    if (actualTimePerQuestion <= 0) continue;

    let speedScore = (expectedTimePerQuestion / actualTimePerQuestion) * FULL_MARK;
    speedScore = Math.min(speedScore, FULL_MARK);
    speedScore = Math.max(speedScore, 0);

    speedScores.push(speedScore);
  }

  if (speedScores.length === 0) return 0;

  const avgSpeed = speedScores.reduce((a, b) => a + b, 0) / speedScores.length;
  return roundToTwo(avgSpeed);
}

function calculateAccuracyStability(records: any[]): number {
  const accuracyRates: number[] = [];

  for (const record of records) {
    const paper = record.exam?.paper;
    if (!paper || !paper.items) continue;

    const totalQuestions = paper.items.length;
    if (totalQuestions === 0) continue;

    const answers = record.answers as Record<string, string> | null;
    if (!answers) continue;

    let correctCount = 0;
    for (const item of paper.items) {
      const question = item.question;
      if (!question) continue;

      const userAnswer = answers[`q_${question.id}`];
      if (userAnswer && userAnswer === question.answer) {
        correctCount++;
      }
    }

    const accuracy = correctCount / totalQuestions;
    accuracyRates.push(accuracy);
  }

  if (accuracyRates.length < 2) return 50;

  const mean = accuracyRates.reduce((a, b) => a + b, 0) / accuracyRates.length;
  const variance =
    accuracyRates.reduce((sum, rate) => sum + Math.pow(rate - mean, 2), 0) /
    accuracyRates.length;
  const stdDev = Math.sqrt(variance);

  const stabilityScore = Math.max(0, FULL_MARK - stdDev * FULL_MARK * 3);
  return roundToTwo(Math.min(stabilityScore, FULL_MARK));
}

function calculateScoreTrend(records: any[]): number {
  if (records.length < 2) return 50;

  const scoreRates: number[] = [];

  for (const record of records) {
    const paper = record.exam?.paper;
    if (!paper) continue;

    const totalScore = paper.totalScore || 100;
    const score = record.totalScore ?? 0;
    const scoreRate = totalScore > 0 ? score / totalScore : 0;
    scoreRates.push(scoreRate);
  }

  if (scoreRates.length < 2) return 50;

  const midPoint = Math.floor(scoreRates.length / 2);
  const firstHalf = scoreRates.slice(0, midPoint);
  const secondHalf = scoreRates.slice(midPoint);

  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  const improvement = secondAvg - firstAvg;
  const trendScore = 50 + improvement * FULL_MARK * 2;

  return roundToTwo(Math.max(0, Math.min(trendScore, FULL_MARK)));
}

function calculateDifficultyAdaptability(records: any[]): number {
  const difficultyStats = new Map<string, { correct: number; total: number }>();

  for (const record of records) {
    const paper = record.exam?.paper;
    if (!paper || !paper.items) continue;

    const answers = record.answers as Record<string, string> | null;
    if (!answers) continue;

    for (const item of paper.items) {
      const question = item.question;
      if (!question) continue;

      const difficulty = question.difficulty || 'MEDIUM';
      if (!difficultyStats.has(difficulty)) {
        difficultyStats.set(difficulty, { correct: 0, total: 0 });
      }

      const stat = difficultyStats.get(difficulty)!;
      stat.total++;

      const userAnswer = answers[`q_${question.id}`];
      if (userAnswer && userAnswer === question.answer) {
        stat.correct++;
      }
    }
  }

  if (difficultyStats.size === 0) return 0;

  const easyStat = difficultyStats.get('EASY') || { correct: 0, total: 0 };
  const mediumStat = difficultyStats.get('MEDIUM') || { correct: 0, total: 0 };
  const hardStat = difficultyStats.get('HARD') || { correct: 0, total: 0 };

  const easyAccuracy = easyStat.total > 0 ? easyStat.correct / easyStat.total : 0;
  const mediumAccuracy = mediumStat.total > 0 ? mediumStat.correct / mediumStat.total : 0;
  const hardAccuracy = hardStat.total > 0 ? hardStat.correct / hardStat.total : 0;

  const weights = { easy: 0.2, medium: 0.3, hard: 0.5 };
  const weightedScore =
    easyAccuracy * weights.easy +
    mediumAccuracy * weights.medium +
    hardAccuracy * weights.hard;

  return roundToTwo(weightedScore * FULL_MARK);
}

export async function getWeakKnowledgePoints(
  userId: number,
  maxCount: number = MAX_WEAK_POINTS
): Promise<WeakKnowledgePoint[]> {
  const wrongQuestions = await prisma.wrongQuestion.findMany({
    where: { userId },
    include: {
      question: {
        select: {
          id: true,
          subject: true,
          difficulty: true,
          content: true,
          analysis: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

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
                include: { question: { select: { subject: true, difficulty: true } } },
              },
            },
          },
        },
      },
    },
  });

  const subjectTotalMap = new Map<string, number>();
  const subjectDifficultyMap = new Map<string, Map<string, number>>();

  for (const record of submittedRecords) {
    const paper = record.exam?.paper;
    if (!paper || !paper.items) continue;

    for (const item of paper.items) {
      const question = item.question;
      if (!question) continue;

      const subject = question.subject || '未知';
      const difficulty = question.difficulty || 'MEDIUM';

      subjectTotalMap.set(subject, (subjectTotalMap.get(subject) || 0) + 1);

      if (!subjectDifficultyMap.has(subject)) {
        subjectDifficultyMap.set(subject, new Map());
      }
      const diffMap = subjectDifficultyMap.get(subject)!;
      diffMap.set(difficulty, (diffMap.get(difficulty) || 0) + 1);
    }
  }

  const subjectWrongMap = new Map<string, {
    count: number;
    questionIds: number[];
    difficulties: Map<string, number>;
  }>();

  for (const wq of wrongQuestions) {
    const subject = wq.subject || '未知';
    const difficulty = wq.question?.difficulty || 'MEDIUM';

    if (!subjectWrongMap.has(subject)) {
      subjectWrongMap.set(subject, {
        count: 0,
        questionIds: [],
        difficulties: new Map(),
      });
    }

    const stat = subjectWrongMap.get(subject)!;
    stat.count++;
    if (wq.questionId) {
      stat.questionIds.push(wq.questionId);
    }
    stat.difficulties.set(difficulty, (stat.difficulties.get(difficulty) || 0) + 1);
  }

  const weakPoints: WeakKnowledgePoint[] = [];

  for (const [subject, wrongStat] of subjectWrongMap.entries()) {
    const totalCount = subjectTotalMap.get(subject) || wrongStat.count;
    const errorRate = totalCount > 0 ? wrongStat.count / totalCount : 1;

    let maxDiffCount = 0;
    let mainDifficulty = 'MEDIUM';
    for (const [diff, count] of wrongStat.difficulties.entries()) {
      if (count > maxDiffCount) {
        maxDiffCount = count;
        mainDifficulty = diff;
      }
    }

    const avgWrongTime = 1;

    const suggestion = generateWeakPointSuggestion(subject, errorRate, mainDifficulty);

    weakPoints.push({
      subject,
      knowledgePoint: subject + '综合',
      wrongCount: wrongStat.count,
      totalCount,
      errorRate: roundToTwo(errorRate),
      difficulty: mainDifficulty,
      avgWrongTime: roundToTwo(avgWrongTime),
      relatedQuestionIds: wrongStat.questionIds.slice(0, 10),
      suggestion,
    });
  }

  weakPoints.sort((a, b) => b.errorRate - a.errorRate);

  return weakPoints.slice(0, maxCount);
}

function generateWeakPointSuggestion(
  subject: string,
  errorRate: number,
  difficulty: string
): string {
  let suggestion = `建议加强${subject}的`;

  if (errorRate > 0.5) {
    suggestion += '基础概念和核心知识';
  } else if (errorRate > 0.3) {
    suggestion += '知识应用和解题技巧';
  } else {
    suggestion += '知识深化和拓展练习';
  }

  if (difficulty === 'EASY') {
    suggestion += '，注意简单题目的细心程度';
  } else if (difficulty === 'HARD') {
    suggestion += '，多做难题提升思维能力';
  } else {
    suggestion += '，巩固中等难度题目';
  }

  return suggestion;
}

export async function getRecommendedQuestions(
  userId: number,
  weakPoints: WeakKnowledgePoint[],
  count: number = DEFAULT_RECOMMEND_COUNT
): Promise<RecommendedQuestion[]> {
  if (weakPoints.length === 0) {
    return [];
  }

  const wrongQuestionIds = (
    await prisma.wrongQuestion.findMany({
      where: { userId },
      select: { questionId: true },
    })
  ).map((wq) => wq.questionId);

  const recommended: RecommendedQuestion[] = [];
  const perWeakPoint = Math.ceil(count / weakPoints.length);

  for (const weakPoint of weakPoints) {
    if (recommended.length >= count) break;

    const whereConditions: any = {
      subject: weakPoint.subject,
      id: { notIn: wrongQuestionIds },
    };

    const questions = await prisma.question.findMany({
      where: whereConditions,
      take: perWeakPoint * 2,
      orderBy: { id: 'asc' },
    });

    const shuffled = questions.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, perWeakPoint);

    for (const q of selected) {
      if (recommended.length >= count) break;

      let reason = '';
      if (q.difficulty === 'EASY') {
        reason = '基础巩固题，帮助夯实基础';
      } else if (q.difficulty === 'HARD') {
        reason = '提升训练题，锻炼解题思维';
      } else {
        reason = '典型练习题，覆盖核心考点';
      }

      recommended.push({
        id: q.id,
        type: q.type,
        content: q.content,
        options: q.options,
        score: q.score,
        analysis: q.analysis,
        subject: q.subject,
        difficulty: q.difficulty,
        answer: q.answer,
        reason,
        relatedWeakPoint: weakPoint.knowledgePoint,
      });
    }
  }

  if (recommended.length < count) {
    const existingIds = recommended.map((q) => q.id);
    const allWrongIds = [...wrongQuestionIds, ...existingIds];

    const extraQuestions = await prisma.question.findMany({
      where: {
        id: { notIn: allWrongIds },
      },
      take: count - recommended.length,
      orderBy: { id: 'asc' },
    });

    for (const q of extraQuestions) {
      recommended.push({
        id: q.id,
        type: q.type,
        content: q.content,
        options: q.options,
        score: q.score,
        analysis: q.analysis,
        subject: q.subject,
        difficulty: q.difficulty,
        answer: q.answer,
        reason: '综合能力提升题',
        relatedWeakPoint: '综合能力',
      });
    }
  }

  return recommended;
}

function generateOverallSummary(
  radarData: AbilityRadarData,
  weakPoints: WeakKnowledgePoint[]
): string {
  const score = radarData.overallScore;
  const examCount = radarData.examCount;

  if (examCount === 0) {
    return '暂无考试数据，无法进行能力分析。建议完成至少一次考试后再查看。';
  }

  let summary = `基于${examCount}次考试数据，综合能力得分为${score}分。`;

  if (score >= 80) {
    summary += '整体表现优秀，继续保持！';
  } else if (score >= 60) {
    summary += '整体表现良好，仍有提升空间。';
  } else if (score >= 40) {
    summary += '整体表现一般，需要加强学习。';
  } else {
    summary += '基础较为薄弱，建议从基础开始系统学习。';
  }

  if (weakPoints.length > 0) {
    const topWeak = weakPoints[0];
    summary += `最薄弱的知识点是${topWeak.knowledgePoint}，错误率为${(topWeak.errorRate * 100).toFixed(1)}%。`;
    summary += '建议优先攻克该知识点。';
  }

  return summary;
}

export default {
  getStudentAbilityAnalysis,
  getAbilityRadarData,
  getWeakKnowledgePoints,
  getRecommendedQuestions,
};
