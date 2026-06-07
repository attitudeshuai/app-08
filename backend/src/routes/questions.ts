import Router from '@koa/router';
import multer from '@koa/multer';
import prisma from '../lib/prisma';
import { authMiddleware, roleMiddleware } from '../middleware/auth';
import { success, badRequest, notFound } from '../utils/response';
import { getPaginationParams, buildPaginatedResult } from '../utils/pagination';
import { QuestionType, Difficulty, QuestionDiff } from '../types';
import { importQuestionsFromFile, generateTemplateBuffer, getImportTemplate } from '../services/questionImportService';

const DIFF_FIELDS = ['type', 'content', 'options', 'answer', 'score', 'analysis', 'subject', 'difficulty'] as const;

function computeQuestionDiff(oldObj: any, newObj: any): QuestionDiff[] {
  const diffs: QuestionDiff[] = [];
  for (const field of DIFF_FIELDS) {
    const oldVal = oldObj[field];
    const newVal = newObj[field];
    const oldStr = JSON.stringify(oldVal);
    const newStr = JSON.stringify(newVal);
    if (oldStr !== newStr) {
      diffs.push({ field, oldValue: oldVal, newValue: newVal });
    }
  }
  return diffs;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (ctx, file, cb) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ];
    const allowedExts = ['.xlsx', '.xls', '.csv'];
    const ext = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
    if (allowedTypes.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('只支持 .xlsx、.xls、.csv 格式的文件'), false);
    }
  },
});

const router = new Router({ prefix: '/api/questions' });

const validQuestionTypes: QuestionType[] = ['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_BLANK', 'SHORT_ANSWER'];
const validDifficulties: Difficulty[] = ['EASY', 'MEDIUM', 'HARD'];

router.get('/', async (ctx) => {
  const { page, pageSize, skip, take } = getPaginationParams(ctx.query);
  const type = ctx.query.type as string;
  const subject = ctx.query.subject as string;
  const difficulty = ctx.query.difficulty as string;
  const keyword = ctx.query.keyword as string;

  const where: any = {};
  if (type) {
    if (!validQuestionTypes.includes(type as QuestionType)) {
      badRequest(ctx, '无效的题目类型');
      return;
    }
    where.type = type;
  }
  if (subject) where.subject = subject;
  if (difficulty) {
    if (!validDifficulties.includes(difficulty as Difficulty)) {
      badRequest(ctx, '无效的难度级别');
      return;
    }
    where.difficulty = difficulty;
  }
  if (keyword) {
    where.content = { contains: keyword };
  }

  const [total, list] = await Promise.all([
    prisma.question.count({ where }),
    prisma.question.findMany({
      where,
      include: { user: { select: { id: true, name: true } } },
      skip,
      take,
      orderBy: { id: 'desc' },
    }),
  ]);

  success(ctx, buildPaginatedResult(list, total, page, pageSize));
});

router.get('/:id', async (ctx) => {
  const id = Number(ctx.params.id);
  const question = await prisma.question.findUnique({
    where: { id },
    include: { user: { select: { id: true, name: true } } },
  });

  if (!question) {
    notFound(ctx, '题目');
    return;
  }

  success(ctx, question);
});

router.post('/', authMiddleware, async (ctx) => {
  const { type, content, options, answer, score, analysis, subject, difficulty } = ctx.request.body as {
    type?: string;
    content?: string;
    options?: string[] | null;
    answer?: string;
    score?: number;
    analysis?: string | null;
    subject?: string;
    difficulty?: string;
  };
  const userId = ctx.state.user.id;

  if (!type || !content || !answer || !subject) {
    badRequest(ctx, '缺少必填字段');
    return;
  }

  if (!validQuestionTypes.includes(type as QuestionType)) {
    badRequest(ctx, '无效的题目类型');
    return;
  }

  if (difficulty && !validDifficulties.includes(difficulty as Difficulty)) {
    badRequest(ctx, '无效的难度级别');
    return;
  }

  if ((type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE') && (!options || options.length === 0)) {
    badRequest(ctx, '选择题必须提供选项');
    return;
  }

  const question = await prisma.question.create({
    data: {
      type,
      content,
      options: options as any,
      answer,
      score: score || 2,
      analysis: analysis || null,
      subject,
      difficulty: difficulty || 'MEDIUM',
      createdBy: userId,
    },
  });

  success(ctx, question);
});

router.put('/:id', authMiddleware, async (ctx) => {
  const id = Number(ctx.params.id);
  const userId = ctx.state.user.id;
  const { type, content, options, answer, score, analysis, subject, difficulty, remark } = ctx.request.body as {
    type?: string;
    content?: string;
    options?: string[] | null;
    answer?: string;
    score?: number;
    analysis?: string | null;
    subject?: string;
    difficulty?: string;
    remark?: string;
  };

  const existing = await prisma.question.findUnique({ where: { id } });
  if (!existing) {
    notFound(ctx, '题目');
    return;
  }

  if (type && !validQuestionTypes.includes(type as QuestionType)) {
    badRequest(ctx, '无效的题目类型');
    return;
  }

  if (difficulty && !validDifficulties.includes(difficulty as Difficulty)) {
    badRequest(ctx, '无效的难度级别');
    return;
  }

  const data: any = {};
  if (type !== undefined) data.type = type;
  if (content !== undefined) data.content = content;
  if (options !== undefined) data.options = options;
  if (answer !== undefined) data.answer = answer;
  if (score !== undefined) data.score = score;
  if (analysis !== undefined) data.analysis = analysis;
  if (subject !== undefined) data.subject = subject;
  if (difficulty !== undefined) data.difficulty = difficulty;

  const hasChanges = Object.keys(data).length > 0;
  if (!hasChanges) {
    success(ctx, existing);
    return;
  }

  const question = await prisma.$transaction(async (tx) => {
    const lastHistory = await tx.questionHistory.findFirst({
      where: { questionId: id },
      orderBy: { version: 'desc' },
    });
    const nextVersion = lastHistory ? lastHistory.version + 1 : 1;

    await tx.questionHistory.create({
      data: {
        questionId: id,
        type: existing.type,
        content: existing.content,
        options: existing.options as any,
        answer: existing.answer,
        score: existing.score,
        analysis: existing.analysis,
        subject: existing.subject,
        difficulty: existing.difficulty,
        version: nextVersion,
        remark: remark || null,
        modifiedBy: userId,
      },
    });

    return tx.question.update({ where: { id }, data });
  });

  success(ctx, question);
});

router.delete('/:id', authMiddleware, async (ctx) => {
  const id = Number(ctx.params.id);

  const existing = await prisma.question.findUnique({ where: { id } });
  if (!existing) {
    notFound(ctx, '题目');
    return;
  }

  await prisma.question.delete({ where: { id } });
  success(ctx);
});

router.get('/:id/history', authMiddleware, roleMiddleware('TEACHER', 'ADMIN'), async (ctx) => {
  const id = Number(ctx.params.id);

  const question = await prisma.question.findUnique({ where: { id } });
  if (!question) {
    notFound(ctx, '题目');
    return;
  }

  const historyList = await prisma.questionHistory.findMany({
    where: { questionId: id },
    include: {
      modifier: {
        select: { id: true, name: true },
      },
    },
    orderBy: { version: 'desc' },
  });

  success(ctx, historyList);
});

router.get('/:id/history/:historyId', authMiddleware, roleMiddleware('TEACHER', 'ADMIN'), async (ctx) => {
  const id = Number(ctx.params.id);
  const historyId = Number(ctx.params.historyId);

  const question = await prisma.question.findUnique({ where: { id } });
  if (!question) {
    notFound(ctx, '题目');
    return;
  }

  const history = await prisma.questionHistory.findUnique({
    where: { id: historyId },
    include: {
      modifier: {
        select: { id: true, name: true },
      },
    },
  });

  if (!history || history.questionId !== id) {
    notFound(ctx, '历史版本');
    return;
  }

  const nextHistory = await prisma.questionHistory.findFirst({
    where: {
      questionId: id,
      version: { gt: history.version },
    },
    orderBy: { version: 'asc' },
  });

  const newVersionContent = nextHistory || question;
  const diff = computeQuestionDiff(history, newVersionContent);

  success(ctx, {
    ...history,
    diff,
  });
});

router.post('/:id/history/:historyId/revert', authMiddleware, roleMiddleware('TEACHER', 'ADMIN'), async (ctx) => {
  const id = Number(ctx.params.id);
  const historyId = Number(ctx.params.historyId);
  const userId = ctx.state.user.id;
  const { remark } = ctx.request.body as { remark?: string };

  const question = await prisma.question.findUnique({ where: { id } });
  if (!question) {
    notFound(ctx, '题目');
    return;
  }

  const history = await prisma.questionHistory.findUnique({
    where: { id: historyId },
  });

  if (!history || history.questionId !== id) {
    notFound(ctx, '历史版本');
    return;
  }

  const updatedQuestion = await prisma.$transaction(async (tx) => {
    const lastHistory = await tx.questionHistory.findFirst({
      where: { questionId: id },
      orderBy: { version: 'desc' },
    });
    const nextVersion = lastHistory ? lastHistory.version + 1 : 1;

    await tx.questionHistory.create({
      data: {
        questionId: id,
        type: question.type,
        content: question.content,
        options: question.options as any,
        answer: question.answer,
        score: question.score,
        analysis: question.analysis,
        subject: question.subject,
        difficulty: question.difficulty,
        version: nextVersion,
        remark: remark || `回退到版本 ${history.version}`,
        modifiedBy: userId,
      },
    });

    return tx.question.update({
      where: { id },
      data: {
        type: history.type,
        content: history.content,
        options: history.options as any,
        answer: history.answer,
        score: history.score,
        analysis: history.analysis,
        subject: history.subject,
        difficulty: history.difficulty,
      },
    });
  });

  success(ctx, updatedQuestion);
});

router.get('/import/template', authMiddleware, async (ctx) => {
  const format = ctx.query.format as string;
  if (format === 'json') {
    success(ctx, getImportTemplate());
    return;
  }
  
  const buffer = generateTemplateBuffer();
  ctx.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  ctx.set('Content-Disposition', 'attachment; filename="question_import_template.xlsx');
  ctx.body = buffer;
});

router.post('/import', authMiddleware, upload.single('file'), async (ctx) => {
  const userId = ctx.state.user.id;
  const file = ctx.file;
  
  if (!file) {
    badRequest(ctx, '请上传文件');
    return;
  }
  
  const checkDuplicates = ctx.query.checkDuplicates !== 'false';
  
  try {
    const result = await importQuestionsFromFile(file.buffer, userId, checkDuplicates);
    success(ctx, result);
  } catch (err: any) {
    badRequest(ctx, `导入失败: ${err.message}`);
  }
});

export default router;
