import Router from '@koa/router';
import prisma from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { success, badRequest, notFound, forbidden } from '../utils/response';
import { getPaginationParams, buildPaginatedResult } from '../utils/pagination';

const router = new Router({ prefix: '/api/paper-templates' });

router.get('/', authMiddleware, async (ctx) => {
  const { page, pageSize, skip, take } = getPaginationParams(ctx.query);
  const keyword = ctx.query.keyword as string;
  const userId = ctx.state.user.id;

  const where: any = {
    createdBy: userId,
  };
  if (keyword) {
    where.name = { contains: keyword };
  }

  const [total, list] = await Promise.all([
    prisma.paperTemplate.count({ where }),
    prisma.paperTemplate.findMany({
      where,
      include: {
        _count: { select: { items: true } },
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
  const userId = ctx.state.user.id;

  const template = await prisma.paperTemplate.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true } },
      items: {
        include: { question: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  if (!template) {
    notFound(ctx, '模板');
    return;
  }

  if (template.createdBy !== userId && ctx.state.user.role === 'STUDENT') {
    forbidden(ctx, '无权访问此模板');
    return;
  }

  success(ctx, template);
});

router.post('/', authMiddleware, async (ctx) => {
  const { name, description, duration, items } = ctx.request.body as {
    name?: string;
    description?: string;
    duration?: number;
    items?: Array<{ questionId: number; score: number; sortOrder?: number }>;
  };
  const userId = ctx.state.user.id;

  if (!name || !duration || !items || !items.length) {
    badRequest(ctx, '缺少必填字段');
    return;
  }

  const totalScore = items.reduce((sum: number, item: any) => sum + (item.score || 0), 0);

  const template = await prisma.paperTemplate.create({
    data: {
      name,
      description,
      totalScore,
      duration,
      createdBy: userId,
      items: {
        create: items.map((item: any, index: number) => ({
          questionId: item.questionId,
          sortOrder: item.sortOrder || index + 1,
          score: item.score,
        })),
      },
    },
    include: { items: true },
  });

  success(ctx, template);
});

router.post('/from-paper/:paperId', authMiddleware, async (ctx) => {
  const paperId = Number(ctx.params.paperId);
  const { name, description } = ctx.request.body as {
    name?: string;
    description?: string;
  };
  const userId = ctx.state.user.id;
  const userRole = ctx.state.user.role;

  const paper = await prisma.paper.findUnique({
    where: { id: paperId },
    include: {
      items: {
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  if (!paper) {
    notFound(ctx, '试卷');
    return;
  }

  if (paper.createdBy !== userId && userRole !== 'ADMIN') {
    forbidden(ctx, '无权将此试卷保存为模板');
    return;
  }

  if (!name) {
    badRequest(ctx, '请输入模板名称');
    return;
  }

  const template = await prisma.paperTemplate.create({
    data: {
      name,
      description: description || paper.description,
      totalScore: paper.totalScore,
      duration: paper.duration,
      createdBy: userId,
      items: {
        create: paper.items.map((item: any) => ({
          questionId: item.questionId,
          sortOrder: item.sortOrder,
          score: item.score,
        })),
      },
    },
    include: { items: true },
  });

  success(ctx, template);
});

router.put('/:id', authMiddleware, async (ctx) => {
  const id = Number(ctx.params.id);
  const userId = ctx.state.user.id;
  const body = ctx.request.body as {
    name?: string;
    description?: string;
    duration?: number;
    items?: Array<{ questionId: number; score: number; sortOrder?: number }>;
  };
  const { name, description, duration, items } = body;

  const existing = await prisma.paperTemplate.findUnique({ where: { id } });
  if (!existing) {
    notFound(ctx, '模板');
    return;
  }

  if (existing.createdBy !== userId) {
    forbidden(ctx, '无权修改此模板');
    return;
  }

  const itemsProvided = items !== undefined;

  if (itemsProvided) {
    await prisma.paperTemplateItem.deleteMany({ where: { templateId: id } });

    const totalScore = Array.isArray(items) && items.length > 0
      ? items.reduce((sum: number, item: any) => sum + (item.score || 0), 0)
      : 0;

    const createData = Array.isArray(items) && items.length > 0
      ? items.map((item: any, index: number) => ({
          questionId: item.questionId,
          sortOrder: item.sortOrder || index + 1,
          score: item.score,
        }))
      : [];

    const template = await prisma.paperTemplate.update({
      where: { id },
      data: {
        name: name || existing.name,
        description: description !== undefined ? description : existing.description,
        duration: duration || existing.duration,
        totalScore,
        items: createData.length > 0
          ? { create: createData }
          : undefined,
      },
      include: { items: true },
    });

    success(ctx, template);
  } else {
    const data: any = {};
    if (name) data.name = name;
    if (description !== undefined) data.description = description;
    if (duration) data.duration = duration;

    const template = await prisma.paperTemplate.update({
      where: { id },
      data,
      include: { items: true },
    });

    success(ctx, template);
  }
});

router.delete('/:id', authMiddleware, async (ctx) => {
  const id = Number(ctx.params.id);
  const userId = ctx.state.user.id;

  const existing = await prisma.paperTemplate.findUnique({ where: { id } });
  if (!existing) {
    notFound(ctx, '模板');
    return;
  }

  if (existing.createdBy !== userId) {
    forbidden(ctx, '无权删除此模板');
    return;
  }

  await prisma.paperTemplate.delete({ where: { id } });
  success(ctx);
});

router.post('/:id/apply', authMiddleware, async (ctx) => {
  const id = Number(ctx.params.id);
  const userId = ctx.state.user.id;
  const { title, description } = ctx.request.body as {
    title?: string;
    description?: string;
  };

  const template = await prisma.paperTemplate.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  if (!template) {
    notFound(ctx, '模板');
    return;
  }

  if (!title) {
    badRequest(ctx, '请输入试卷标题');
    return;
  }

  const questionIds = template.items.map((item: any) => item.questionId);
  const existingQuestions = await prisma.question.findMany({
    where: { id: { in: questionIds } },
    select: { id: true },
  });
  const existingQuestionIds = new Set(existingQuestions.map((q: any) => q.id));
  const missingQuestionIds = questionIds.filter((qid: number) => !existingQuestionIds.has(qid));

  if (missingQuestionIds.length > 0) {
    badRequest(ctx, `模板中有 ${missingQuestionIds.length} 道题目已被删除（题目ID：${missingQuestionIds.join(', ')}），无法基于此模板创建试卷，请先更新模板`);
    return;
  }

  const paper = await prisma.paper.create({
    data: {
      title,
      description: description !== undefined ? description : template.description,
      totalScore: template.totalScore,
      duration: template.duration,
      createdBy: userId,
      items: {
        create: template.items.map((item: any) => ({
          questionId: item.questionId,
          sortOrder: item.sortOrder,
          score: item.score,
        })),
      },
    },
    include: { items: true },
  });

  success(ctx, paper);
});

export default router;
