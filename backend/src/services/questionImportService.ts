import * as XLSX from 'xlsx';
import prisma from '../lib/prisma';
import { QuestionType, Difficulty, QuestionImportResult, RawQuestionData, ImportErrorItem } from '../types';

const validQuestionTypes: QuestionType[] = ['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_BLANK', 'SHORT_ANSWER'];
const validDifficulties: Difficulty[] = ['EASY', 'MEDIUM', 'HARD'];

const typeMapping: Record<string, QuestionType> = {
  '单选题': 'SINGLE_CHOICE',
  'single_choice': 'SINGLE_CHOICE',
  'SINGLE_CHOICE': 'SINGLE_CHOICE',
  '多选题': 'MULTIPLE_CHOICE',
  'multiple_choice': 'MULTIPLE_CHOICE',
  'MULTIPLE_CHOICE': 'MULTIPLE_CHOICE',
  '判断题': 'TRUE_FALSE',
  'true_false': 'TRUE_FALSE',
  'TRUE_FALSE': 'TRUE_FALSE',
  '填空题': 'FILL_BLANK',
  'fill_blank': 'FILL_BLANK',
  'FILL_BLANK': 'FILL_BLANK',
  '简答题': 'SHORT_ANSWER',
  'short_answer': 'SHORT_ANSWER',
  'SHORT_ANSWER': 'SHORT_ANSWER',
};

const difficultyMapping: Record<string, Difficulty> = {
  '简单': 'EASY',
  'easy': 'EASY',
  'EASY': 'EASY',
  '中等': 'MEDIUM',
  'medium': 'MEDIUM',
  'MEDIUM': 'MEDIUM',
  '困难': 'HARD',
  'hard': 'HARD',
  'HARD': 'HARD',
};

function parseFile(buffer: Buffer): RawQuestionData[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' }) as Record<string, unknown>[];
  
  return jsonData.map((row) => {
    const scoreVal = row.score ?? row['分值'] ?? row['分数'];
    return {
      type: String(row.type ?? row['题目类型'] ?? row['类型'] ?? ''),
      content: String(row.content ?? row['题目内容'] ?? row['题目'] ?? row['题干'] ?? ''),
      options: String(row.options ?? row['选项'] ?? row['题目选项'] ?? ''),
      answer: String(row.answer ?? row['答案'] ?? row['正确答案'] ?? ''),
      score: scoreVal !== undefined && scoreVal !== null ? String(scoreVal) : '',
      analysis: String(row.analysis ?? row['解析'] ?? row['题目解析'] ?? ''),
      subject: String(row.subject ?? row['科目'] ?? row['学科'] ?? ''),
      difficulty: String(row.difficulty ?? row['难度'] ?? row['难度级别'] ?? ''),
    };
  });
}

function parseOptions(optionsStr: string): string[] | null {
  if (!optionsStr.trim()) return null;
  
  const labelPatterns = [
    /[A-Z][\.、\)]\s*/,
    /\d+[\.、\)]\s*/,
  ];
  
  const hasLabel = labelPatterns.some(pattern => pattern.test(optionsStr.trim()));
  
  if (hasLabel) {
    const labelRegex = /(?:^|[\s;；])[A-Z][\.、\)]\s*|(?:^|[\s;；])\d+[\.、\)]\s*/g;
    const matches: string[] = [];
    let lastIndex = 0;
    let match;
    
    labelRegex.lastIndex = 0;
    while ((match = labelRegex.exec(optionsStr)) !== null) {
      if (match.index > lastIndex) {
        const segment = optionsStr.substring(lastIndex, match.index);
        const cleaned = segment.replace(/^[\s;；]+/, '').replace(/[\s;；]+$/, '').trim();
        if (cleaned) {
          matches.push(cleaned);
        }
      }
      lastIndex = labelRegex.lastIndex;
    }
    
    if (lastIndex < optionsStr.length) {
      const segment = optionsStr.substring(lastIndex);
      const cleaned = segment.replace(/^[\s;；]+/, '').replace(/[\s;；]+$/, '').trim();
      if (cleaned) {
        matches.push(cleaned);
      }
    }
    
    if (matches.length > 0) {
      return matches;
    }
  }
  
  if (optionsStr.includes(';') || optionsStr.includes('；')) {
    const parts = optionsStr
      .replace(/；/g, ';')
      .split(';')
      .map(s => s.trim())
      .filter(Boolean);
    return parts.length > 0 ? parts : null;
  }
  
  if (optionsStr.includes('\n')) {
    const parts = optionsStr.split('\n').map(s => s.trim()).filter(Boolean);
    return parts.length > 0 ? parts : null;
  }
  
  return [optionsStr.trim()];
}

function validateQuestion(data: RawQuestionData, rowIndex: number): { valid: boolean; errors: string[]; normalized?: any } {
  const errors: string[] = [];
  
  let normalizedType: QuestionType | null = null;
  if (!data.type?.trim()) {
    errors.push('题目类型不能为空');
  } else {
    normalizedType = typeMapping[data.type.trim()];
    if (!normalizedType) {
      errors.push(`无效的题目类型: ${data.type}。支持的类型: 单选题、多选题、判断题、填空题、简答题`);
    }
  }
  
  if (!data.content?.trim()) {
    errors.push('题目内容不能为空');
  }
  
  if (!data.answer?.trim()) {
    errors.push('答案不能为空');
  }
  
  if (!data.subject?.trim()) {
    errors.push('科目不能为空');
  }
  
  let normalizedDifficulty: Difficulty = 'MEDIUM';
  if (data.difficulty?.trim()) {
    normalizedDifficulty = difficultyMapping[data.difficulty.trim()];
    if (!normalizedDifficulty) {
      errors.push(`无效的难度级别: ${data.difficulty}。支持: 简单、中等、困难`);
    }
  }
  
  let normalizedScore = 2;
  if (data.score !== undefined && data.score !== null && String(data.score).trim() !== '') {
    const scoreNum = Number(data.score);
    if (isNaN(scoreNum) || scoreNum <= 0) {
      errors.push(`无效的分值: ${data.score}。分值必须是正数`);
    } else {
      normalizedScore = scoreNum;
    }
  }
  
  let normalizedOptions: string[] | null = null;
  if (normalizedType === 'SINGLE_CHOICE' || normalizedType === 'MULTIPLE_CHOICE') {
    normalizedOptions = parseOptions(data.options || '');
    if (!normalizedOptions || normalizedOptions.length < 2) {
      errors.push('选择题必须提供至少2个选项。选项格式示例: A.选项A;B.选项B 或每行一个选项');
    }
  }
  
  if (normalizedType === 'TRUE_FALSE') {
    const answer = (data.answer || '').trim().toUpperCase();
    if (!['TRUE', 'FALSE', '对', '错', '正确', '错误', 'T', 'F', '√', '×', 'X'].includes(answer)) {
      errors.push('判断题答案必须是: 对/错、正确/错误、TRUE/FALSE、T/F');
    }
  }
  
  if (errors.length > 0) {
    return { valid: false, errors };
  }
  
  let normalizedAnswer = data.answer!.trim();
  if (normalizedType === 'TRUE_FALSE') {
    const answer = normalizedAnswer.toUpperCase();
    if (['TRUE', 'T', '对', '正确', '√'].includes(answer)) {
      normalizedAnswer = 'TRUE';
    } else {
      normalizedAnswer = 'FALSE';
    }
  }
  
  return {
    valid: true,
    errors: [],
    normalized: {
      type: normalizedType,
      content: data.content!.trim(),
      options: normalizedOptions,
      answer: normalizedAnswer,
      score: normalizedScore,
      analysis: data.analysis?.trim() || null,
      subject: data.subject!.trim(),
      difficulty: normalizedDifficulty,
    },
  };
}

async function checkDuplicate(content: string, subject: string): Promise<boolean> {
  const existing = await prisma.question.findFirst({
    where: {
      content,
      subject,
    },
    select: { id: true },
  });
  return !!existing;
}

function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  
  if (m === 0) return n;
  if (n === 0) return m;
  
  const dp: number[] = new Array(n + 1);
  for (let j = 0; j <= n; j++) {
    dp[j] = j;
  }
  
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      if (str1[i - 1] === str2[j - 1]) {
        dp[j] = prev;
      } else {
        dp[j] = Math.min(
          prev + 1,
          dp[j] + 1,
          dp[j - 1] + 1,
        );
      }
      prev = temp;
    }
  }
  
  return dp[n];
}

function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().replace(/\s+/g, '');
  const s2 = str2.toLowerCase().replace(/\s+/g, '');
  
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;
  
  const maxLen = Math.max(s1.length, s2.length);
  const distance = levenshteinDistance(s1, s2);
  
  return 1 - distance / maxLen;
}

async function checkSimilarQuestions(content: string, subject: string): Promise<string[]> {
  const similarQuestions: string[] = [];
  const batchSize = 100;
  let cursor: number | undefined = undefined;
  
  while (true) {
    const batch: Array<{ id: number; content: string }> = await prisma.question.findMany({
      where: {
        subject,
        ...(cursor !== undefined ? { id: { gt: cursor } } : {}),
      },
      select: { id: true, content: true },
      orderBy: { id: 'asc' },
      take: batchSize,
    });
    
    if (batch.length === 0) {
      break;
    }
    
    for (const q of batch) {
      const similarity = calculateSimilarity(content, q.content);
      if (similarity >= 0.85) {
        similarQuestions.push(`题目ID #${q.id}: ${q.content.substring(0, 50)}...`);
      }
    }
    
    if (batch.length < batchSize) {
      break;
    }
    
    cursor = batch[batch.length - 1].id;
  }
  
  return similarQuestions;
}

export async function importQuestionsFromFile(
  fileBuffer: Buffer,
  userId: number,
  checkDuplicates: boolean = true,
): Promise<QuestionImportResult> {
  const rawData = parseFile(fileBuffer);
  
  if (rawData.length === 0) {
    return {
      successCount: 0,
      failCount: 0,
      totalCount: 0,
      successItems: [],
      errorItems: [],
    };
  }
  
  const successItems: QuestionImportResult['successItems'] = [];
  const errorItems: ImportErrorItem[] = [];
  
  for (let i = 0; i < rawData.length; i++) {
    const rowIndex = i + 2;
    const rowData = rawData[i];
    
    const validation = validateQuestion(rowData, rowIndex);
    
    if (!validation.valid) {
      errorItems.push({
        rowIndex,
        rowData: rowData as unknown as Record<string, unknown>,
        errors: validation.errors,
      });
      continue;
    }
    
    const { normalized } = validation;
    
    if (checkDuplicates) {
      const isExactDuplicate = await checkDuplicate(normalized.content, normalized.subject);
      if (isExactDuplicate) {
        errorItems.push({
          rowIndex,
          rowData: rowData as unknown as Record<string, unknown>,
          errors: ['该题目在相同科目下已存在（内容完全重复）'],
        });
        continue;
      }
      
      const similarQuestions = await checkSimilarQuestions(normalized.content, normalized.subject);
      if (similarQuestions.length > 0) {
        errorItems.push({
          rowIndex,
          rowData: rowData as unknown as Record<string, unknown>,
          errors: [`发现高度相似的题目 (相似度 >= 85%): ${similarQuestions.join('; ')}`],
        });
        continue;
      }
    }
    
    try {
      const question = await prisma.question.create({
        data: {
          type: normalized.type,
          content: normalized.content,
          options: normalized.options,
          answer: normalized.answer,
          score: normalized.score,
          analysis: normalized.analysis,
          subject: normalized.subject,
          difficulty: normalized.difficulty,
          createdBy: userId,
        },
      });
      
      successItems.push({
        id: question.id,
        type: question.type,
        content: question.content,
        subject: question.subject,
      });
    } catch (err: any) {
      errorItems.push({
        rowIndex,
        rowData: rowData as unknown as Record<string, unknown>,
        errors: [`数据库错误: ${err.message}`],
      });
    }
  }
  
  return {
    successCount: successItems.length,
    failCount: errorItems.length,
    totalCount: rawData.length,
    successItems,
    errorItems,
  };
}

export function getImportTemplate(): { headers: string[]; sampleRows: any[][] } {
  return {
    headers: ['题目类型', '题目内容', '选项', '答案', '分值', '解析', '科目', '难度'],
    sampleRows: [
      ['单选题', '以下哪个是JavaScript的数据类型？', 'A.String\nB.Number\nC.Boolean\nD.Object', 'A', 2, 'String是字符串类型', '计算机基础', '简单'],
      ['多选题', '以下哪些是前端框架？', 'A.React\nB.Vue\nC.Django\nD.Angular', 'ABD', 3, 'React、Vue、Angular是前端框架，Django是后端框架', '前端开发', '中等'],
      ['判断题', 'HTML是一种编程语言。', '', '错', 2, 'HTML是标记语言，不是编程语言', '计算机基础', '简单'],
      ['填空题', 'CSS的全称是______。', '', 'Cascading Style Sheets', 2, '层叠样式表', '前端开发', '中等'],
      ['简答题', '请简述HTTP和HTTPS的区别。', '', 'HTTPS比HTTP多了SSL/TLS加密层...', 5, '从安全性、端口、证书等方面回答', '计算机网络', '困难'],
    ],
  };
}

export function generateTemplateBuffer(): Buffer {
  const template = getImportTemplate();
  const wsData = [template.headers, ...template.sampleRows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '题目导入模板');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

export const _testHelpers = {
  parseOptions,
  calculateSimilarity,
  levenshteinDistance,
  validateQuestion,
  typeMapping,
  difficultyMapping,
};
