import {
  isAnswerCorrect,
  isObjectiveQuestion,
  roundToTwo,
  buildScoreRanges,
  calculateScoreDistribution,
  calculateQuestionStats,
  calculateDimensionStats,
} from './paperService';
import { QuestionStatItem } from '../types';

describe('paperService - isAnswerCorrect', () => {
  test('单选题判题：正确答案', () => {
    expect(isAnswerCorrect('SINGLE_CHOICE', 'B', 'B')).toBe(true);
  });

  test('单选题判题：错误答案', () => {
    expect(isAnswerCorrect('SINGLE_CHOICE', 'A', 'B')).toBe(false);
  });

  test('单选题判题：忽略大小写', () => {
    expect(isAnswerCorrect('SINGLE_CHOICE', 'b', 'B')).toBe(true);
  });

  test('单选题判题：忽略前后空格', () => {
    expect(isAnswerCorrect('SINGLE_CHOICE', ' B ', 'B')).toBe(true);
  });

  test('多选题判题：正确答案顺序不同', () => {
    expect(isAnswerCorrect('MULTIPLE_CHOICE', 'B,A,C', 'A,B,C')).toBe(true);
  });

  test('多选题判题：答案不全', () => {
    expect(isAnswerCorrect('MULTIPLE_CHOICE', 'A,B', 'A,B,C')).toBe(false);
  });

  test('多选题判题：答案多余', () => {
    expect(isAnswerCorrect('MULTIPLE_CHOICE', 'A,B,C,D', 'A,B,C')).toBe(false);
  });

  test('判断题判题：正确', () => {
    expect(isAnswerCorrect('TRUE_FALSE', '正确', '正确')).toBe(true);
  });

  test('判断题判题：错误', () => {
    expect(isAnswerCorrect('TRUE_FALSE', '错误', '正确')).toBe(false);
  });

  test('填空题判题：正确', () => {
    expect(isAnswerCorrect('FILL_BLANK', '404', '404')).toBe(true);
  });

  test('简答题判题：始终返回false（需要人工批改）', () => {
    expect(isAnswerCorrect('SHORT_ANSWER', '任何答案', '任何答案')).toBe(false);
  });
});

describe('paperService - isObjectiveQuestion', () => {
  test('单选题是客观题', () => {
    expect(isObjectiveQuestion('SINGLE_CHOICE')).toBe(true);
  });

  test('多选题是客观题', () => {
    expect(isObjectiveQuestion('MULTIPLE_CHOICE')).toBe(true);
  });

  test('判断题是客观题', () => {
    expect(isObjectiveQuestion('TRUE_FALSE')).toBe(true);
  });

  test('填空题是客观题', () => {
    expect(isObjectiveQuestion('FILL_BLANK')).toBe(true);
  });

  test('简答题是主观题', () => {
    expect(isObjectiveQuestion('SHORT_ANSWER')).toBe(false);
  });
});

describe('paperService - roundToTwo', () => {
  test('保留两位小数', () => {
    expect(roundToTwo(3.14159)).toBe(3.14);
  });

  test('四舍五入', () => {
    expect(roundToTwo(2.345)).toBe(2.35);
  });

  test('整数返回整数', () => {
    expect(roundToTwo(5)).toBe(5);
  });

  test('零返回零', () => {
    expect(roundToTwo(0)).toBe(0);
  });
});

describe('paperService - buildScoreRanges', () => {
  test('总分100分时，生成10个区间', () => {
    const ranges = buildScoreRanges(100);
    expect(ranges.length).toBe(10);
    expect(ranges[0].range).toBe('0-9');
    expect(ranges[0].min).toBe(0);
    expect(ranges[0].max).toBeCloseTo(9.99);
    expect(ranges[9].range).toBe('90-100');
    expect(ranges[9].min).toBe(90);
    expect(ranges[9].max).toBe(100);
  });

  test('总分50分时，区间比例正确', () => {
    const ranges = buildScoreRanges(50);
    expect(ranges.length).toBe(10);
    expect(ranges[0].range).toBe('0-4');
    expect(ranges[9].range).toBe('45-50');
    expect(ranges[9].max).toBe(50);
  });
});

describe('paperService - calculateScoreDistribution', () => {
  const ranges = buildScoreRanges(100);

  test('空成绩数组返回全零', () => {
    const result = calculateScoreDistribution([], ranges);
    expect(result.length).toBe(10);
    result.forEach((r) => {
      expect(r.count).toBe(0);
      expect(r.percentage).toBe(0);
    });
  });

  test('成绩分布计算正确', () => {
    const scores = [15, 25, 35, 45, 55, 65, 75, 85, 95, 5];
    const result = calculateScoreDistribution(scores, ranges);

    expect(result[0].count).toBe(1);
    expect(result[1].count).toBe(1);
    expect(result[2].count).toBe(1);
    expect(result[3].count).toBe(1);
    expect(result[4].count).toBe(1);
    expect(result[5].count).toBe(1);
    expect(result[6].count).toBe(1);
    expect(result[7].count).toBe(1);
    expect(result[8].count).toBe(1);
    expect(result[9].count).toBe(1);

    expect(result[0].percentage).toBe(0.1);
    expect(result[5].percentage).toBe(0.1);
  });

  test('临界值处理：刚好在区间边界', () => {
    const scores = [9.99, 10, 89.99, 90, 100];
    const result = calculateScoreDistribution(scores, ranges);

    expect(result[0].count).toBe(1);
    expect(result[1].count).toBe(1);
    expect(result[8].count).toBe(1);
    expect(result[9].count).toBe(2);
  });
});

describe('paperService - calculateQuestionStats', () => {
  const paperItems = [
    {
      questionId: 1,
      sortOrder: 1,
      score: 2,
      question: {
        type: 'SINGLE_CHOICE',
        content: '题目1',
        answer: 'A',
        difficulty: 'EASY',
        subject: '计算机科学',
      },
    },
    {
      questionId: 2,
      sortOrder: 2,
      score: 4,
      question: {
        type: 'MULTIPLE_CHOICE',
        content: '题目2',
        answer: 'A,B',
        difficulty: 'MEDIUM',
        subject: '计算机科学',
      },
    },
    {
      questionId: 3,
      sortOrder: 3,
      score: 6,
      question: {
        type: 'SHORT_ANSWER',
        content: '简答题',
        answer: '参考答案',
        difficulty: 'HARD',
        subject: '计算机科学',
      },
    },
  ];

  test('空提交记录时，所有统计为零', () => {
    const result = calculateQuestionStats(paperItems, []);
    expect(result.length).toBe(3);
    result.forEach((q) => {
      expect(q.correctCount).toBe(0);
      expect(q.wrongCount).toBe(0);
      expect(q.unansweredCount).toBe(0);
      expect(q.ungradedCount).toBe(0);
      expect(q.accuracyRate).toBe(0);
      expect(q.avgScore).toBe(0);
      expect(q.scoreRate).toBe(0);
    });
  });

  test('客观题统计：答对、答错、未答各一人', () => {
    const records: Array<{ answers: Record<number, string> | undefined }> = [
      { answers: { 1: 'A' } },
      { answers: { 1: 'B' } },
      { answers: {} },
    ];

    const result = calculateQuestionStats([paperItems[0]], records);
    const q1 = result[0];

    expect(q1.correctCount).toBe(1);
    expect(q1.wrongCount).toBe(1);
    expect(q1.unansweredCount).toBe(1);
    expect(q1.accuracyRate).toBe(0.5);
    expect(q1.avgScore).toBeCloseTo(2 / 3, 2);
    expect(q1.scoreRate).toBeCloseTo((2 / 3) / 2, 2);
  });

  test('简答题：所有作答都计入待批改，不计入对错', () => {
    const records: Array<{ answers: Record<number, string> | undefined }> = [
      { answers: { 3: '我的答案' } },
      { answers: { 3: '另一个答案' } },
      { answers: {} },
    ];

    const result = calculateQuestionStats([paperItems[2]], records);
    const q3 = result[0];

    expect(q3.isObjective).toBe(false);
    expect(q3.correctCount).toBe(0);
    expect(q3.wrongCount).toBe(0);
    expect(q3.unansweredCount).toBe(1);
    expect(q3.ungradedCount).toBe(2);
    expect(q3.accuracyRate).toBe(0);
    expect(q3.avgScore).toBe(0);
    expect(q3.scoreRate).toBe(0);
  });

  test('正确率分母是已批改人数（答对+答错），不是总人数', () => {
    const records: Array<{ answers: Record<number, string> | undefined }> = [
      { answers: { 1: 'A' } },
      { answers: { 1: 'A' } },
      { answers: { 1: 'B' } },
      { answers: {} },
      { answers: {} },
    ];

    const result = calculateQuestionStats([paperItems[0]], records);
    const q1 = result[0];

    expect(q1.correctCount).toBe(2);
    expect(q1.wrongCount).toBe(1);
    expect(q1.unansweredCount).toBe(2);
    expect(q1.accuracyRate).toBeCloseTo(2 / 3, 2);
  });

  test('多选题判题正确', () => {
    const records: Array<{ answers: Record<number, string> | undefined }> = [
      { answers: { 2: 'A,B' } },
      { answers: { 2: 'B,A' } },
      { answers: { 2: 'A' } },
    ];

    const result = calculateQuestionStats([paperItems[1]], records);
    const q2 = result[0];

    expect(q2.correctCount).toBe(2);
    expect(q2.wrongCount).toBe(1);
    expect(q2.accuracyRate).toBeCloseTo(2 / 3, 2);
  });

  test('包含所有题型的综合统计', () => {
    const records: Array<{ answers: Record<number, string> | undefined }> = [
      { answers: { 1: 'A', 2: 'A,B', 3: '答案1' } },
      { answers: { 1: 'B', 2: 'A', 3: '答案2' } },
      { answers: { 1: 'A', 2: 'A,B,C' } },
    ];

    const result = calculateQuestionStats(paperItems, records);

    expect(result.length).toBe(3);

    const q1 = result.find((q) => q.questionId === 1)!;
    expect(q1.correctCount).toBe(2);
    expect(q1.wrongCount).toBe(1);
    expect(q1.unansweredCount).toBe(0);
    expect(q1.accuracyRate).toBeCloseTo(2 / 3, 2);

    const q2 = result.find((q) => q.questionId === 2)!;
    expect(q2.correctCount).toBe(1);
    expect(q2.wrongCount).toBe(2);
    expect(q2.unansweredCount).toBe(0);
    expect(q2.accuracyRate).toBeCloseTo(1 / 3, 2);

    const q3 = result.find((q) => q.questionId === 3)!;
    expect(q3.correctCount).toBe(0);
    expect(q3.wrongCount).toBe(0);
    expect(q3.unansweredCount).toBe(1);
    expect(q3.ungradedCount).toBe(2);
    expect(q3.accuracyRate).toBe(0);
  });
});

describe('paperService - calculateDimensionStats', () => {
  const questionStats: QuestionStatItem[] = [
    {
      questionId: 1,
      sortOrder: 1,
      type: 'SINGLE_CHOICE',
      content: '题目1',
      score: 2,
      difficulty: 'EASY',
      subject: '计算机科学',
      correctCount: 8,
      wrongCount: 2,
      unansweredCount: 0,
      ungradedCount: 0,
      accuracyRate: 0.8,
      avgScore: 1.6,
      scoreRate: 0.8,
      isObjective: true,
    },
    {
      questionId: 2,
      sortOrder: 2,
      type: 'SINGLE_CHOICE',
      content: '题目2',
      score: 2,
      difficulty: 'EASY',
      subject: '计算机科学',
      correctCount: 6,
      wrongCount: 4,
      unansweredCount: 0,
      ungradedCount: 0,
      accuracyRate: 0.6,
      avgScore: 1.2,
      scoreRate: 0.6,
      isObjective: true,
    },
    {
      questionId: 3,
      sortOrder: 3,
      type: 'MULTIPLE_CHOICE',
      content: '题目3',
      score: 4,
      difficulty: 'MEDIUM',
      subject: '计算机科学',
      correctCount: 5,
      wrongCount: 5,
      unansweredCount: 0,
      ungradedCount: 0,
      accuracyRate: 0.5,
      avgScore: 2.0,
      scoreRate: 0.5,
      isObjective: true,
    },
    {
      questionId: 4,
      sortOrder: 4,
      type: 'SHORT_ANSWER',
      content: '简答题',
      score: 10,
      difficulty: 'HARD',
      subject: '计算机科学',
      correctCount: 0,
      wrongCount: 0,
      unansweredCount: 2,
      ungradedCount: 8,
      accuracyRate: 0,
      avgScore: 0,
      scoreRate: 0,
      isObjective: false,
    },
  ];

  test('按题型维度统计：分组正确', () => {
    const result = calculateDimensionStats(questionStats, 'type');

    const types = result.map((r) => r.name).sort();
    expect(types).toEqual(['MULTIPLE_CHOICE', 'SHORT_ANSWER', 'SINGLE_CHOICE']);
  });

  test('按题型统计：单选题组的题目数和总分正确', () => {
    const result = calculateDimensionStats(questionStats, 'type');
    const singleChoice = result.find((r) => r.name === 'SINGLE_CHOICE')!;

    expect(singleChoice.questionCount).toBe(2);
    expect(singleChoice.totalScore).toBe(4);
  });

  test('维度平均分是二次平均（各题平均分的平均值），不是相加', () => {
    const result = calculateDimensionStats(questionStats, 'type');
    const singleChoice = result.find((r) => r.name === 'SINGLE_CHOICE')!;

    expect(singleChoice.avgScore).toBe(1.4);
    expect(singleChoice.avgScore).not.toBe(2.8);
  });

  test('维度正确率是加权平均（总正确数 / 总已批改数）', () => {
    const result = calculateDimensionStats(questionStats, 'type');
    const singleChoice = result.find((r) => r.name === 'SINGLE_CHOICE')!;

    expect(singleChoice.correctCount).toBe(14);
    expect(singleChoice.accuracyRate).toBe(0.7);
  });

  test('维度得分率是加权平均（总平均分 / 总分）', () => {
    const result = calculateDimensionStats(questionStats, 'type');
    const singleChoice = result.find((r) => r.name === 'SINGLE_CHOICE')!;

    expect(singleChoice.scoreRate).toBe(0.7);
  });

  test('简答题维度：所有作答都待批改', () => {
    const result = calculateDimensionStats(questionStats, 'type');
    const shortAnswer = result.find((r) => r.name === 'SHORT_ANSWER')!;

    expect(shortAnswer.questionCount).toBe(1);
    expect(shortAnswer.correctCount).toBe(0);
    expect(shortAnswer.ungradedCount).toBe(8);
    expect(shortAnswer.accuracyRate).toBe(0);
    expect(shortAnswer.avgScore).toBe(0);
    expect(shortAnswer.scoreRate).toBe(0);
  });

  test('按难度维度统计', () => {
    const result = calculateDimensionStats(questionStats, 'difficulty');

    expect(result.length).toBe(3);

    const easy = result.find((r) => r.name === 'EASY')!;
    expect(easy.questionCount).toBe(2);
    expect(easy.totalScore).toBe(4);
    expect(easy.avgScore).toBe(1.4);
    expect(easy.accuracyRate).toBe(0.7);

    const medium = result.find((r) => r.name === 'MEDIUM')!;
    expect(medium.questionCount).toBe(1);
    expect(medium.totalScore).toBe(4);
    expect(medium.avgScore).toBe(2.0);
    expect(medium.accuracyRate).toBe(0.5);

    const hard = result.find((r) => r.name === 'HARD')!;
    expect(hard.questionCount).toBe(1);
    expect(hard.ungradedCount).toBe(8);
    expect(hard.accuracyRate).toBe(0);
  });

  test('按学科维度统计', () => {
    const result = calculateDimensionStats(questionStats, 'subject');

    expect(result.length).toBe(1);
    const subject = result[0];
    expect(subject.name).toBe('计算机科学');
    expect(subject.questionCount).toBe(4);
    expect(subject.totalScore).toBe(18);
  });

  test('空数组返回空结果', () => {
    const result = calculateDimensionStats([], 'type');
    expect(result.length).toBe(0);
  });

  test('题目数量不影响平均分数值量级', () => {
    const fewQuestions: QuestionStatItem[] = [
      {
        questionId: 1,
        sortOrder: 1,
        type: 'SINGLE_CHOICE',
        content: '题1',
        score: 2,
        difficulty: 'EASY',
        subject: '测试',
        correctCount: 8,
        wrongCount: 2,
        unansweredCount: 0,
        ungradedCount: 0,
        accuracyRate: 0.8,
        avgScore: 1.6,
        scoreRate: 0.8,
        isObjective: true,
      },
    ];

    const manyQuestions: QuestionStatItem[] = [
      ...fewQuestions,
      {
        questionId: 2,
        sortOrder: 2,
        type: 'SINGLE_CHOICE',
        content: '题2',
        score: 2,
        difficulty: 'EASY',
        subject: '测试',
        correctCount: 8,
        wrongCount: 2,
        unansweredCount: 0,
        ungradedCount: 0,
        accuracyRate: 0.8,
        avgScore: 1.6,
        scoreRate: 0.8,
        isObjective: true,
      },
      {
        questionId: 3,
        sortOrder: 3,
        type: 'SINGLE_CHOICE',
        content: '题3',
        score: 2,
        difficulty: 'EASY',
        subject: '测试',
        correctCount: 8,
        wrongCount: 2,
        unansweredCount: 0,
        ungradedCount: 0,
        accuracyRate: 0.8,
        avgScore: 1.6,
        scoreRate: 0.8,
        isObjective: true,
      },
    ];

    const fewResult = calculateDimensionStats(fewQuestions, 'type');
    const manyResult = calculateDimensionStats(manyQuestions, 'type');

    expect(fewResult[0].avgScore).toBe(1.6);
    expect(manyResult[0].avgScore).toBe(1.6);
    expect(fewResult[0].avgScore).toBe(manyResult[0].avgScore);

    expect(fewResult[0].accuracyRate).toBe(0.8);
    expect(manyResult[0].accuracyRate).toBe(0.8);

    expect(fewResult[0].scoreRate).toBe(0.8);
    expect(manyResult[0].scoreRate).toBe(0.8);
  });
});
