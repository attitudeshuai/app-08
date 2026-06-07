import Router from '@koa/router';
import prisma from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { success, notFound, badRequest } from '../utils/response';
import { getPaginationParams, buildPaginatedResult } from '../utils/pagination';

const router = new Router({ prefix: '/api/favorites' });

router.get('/tags', authMiddleware, async (ctx) => {
  const userId = ctx.state.user.id;

  const tags = await prisma.questionTag.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  });

  const tagsWithCount = await Promise.all(
    tags.map(async (tag) => {
      const count = await prisma.favoriteQuestionTag.count({
        where: { tagId: tag.id },
      });
      return {
        id: tag.id,
        name: tag.name,
        color: tag.color,
        count,
        createdAt: tag.createdAt,
      };
    })
  );

  success(ctx, tagsWithCount);
});

router.post('/tags', authMiddleware, async (ctx) => {
  const userId = ctx.state.user.id;
  const { name, color } = ctx.request.body as any;

  if (!name || !name.trim()) {
    badRequest(ctx, '标签名称不能为空');
    return;
  }

  const existingTag = await prisma.questionTag.findUnique({
    where: {
      userId_name: {
        userId,
        name: name.trim(),
      },
    },
  });

  if (existingTag) {
    badRequest(ctx, '标签名称已存在');
    return;
  }

  const tag = await prisma.questionTag.create({
    data: {
      name: name.trim(),
      color: color || null,
      userId,
    },
  });

  success(ctx, tag);
});

router.put('/tags/:id', authMiddleware, async (ctx) => {
  const userId = ctx.state.user.id;
  const tagId = Number(ctx.params.id);
  const { name, color } = ctx.request.body as any;

  const tag = await prisma.questionTag.findUnique({
    where: { id: tagId },
  });

  if (!tag || tag.userId !== userId) {
    notFound(ctx, '标签');
    return;
  }

  if (name && name.trim() && name.trim() !== tag.name) {
    const existingTag = await prisma.questionTag.findUnique({
      where: {
        userId_name: {
          userId,
          name: name.trim(),
        },
      },
    });

    if (existingTag) {
      badRequest(ctx, '标签名称已存在');
      return;
    }
  }

  const updatedTag = await prisma.questionTag.update({
    where: { id: tagId },
    data: {
      name: name ? name.trim() : undefined,
      color: color !== undefined ? color : undefined,
    },
  });

  success(ctx, updatedTag);
});

router.delete('/tags/:id', authMiddleware, async (ctx) => {
  const userId = ctx.state.user.id;
  const tagId = Number(ctx.params.id);

  const tag = await prisma.questionTag.findUnique({
    where: { id: tagId },
  });

  if (!tag || tag.userId !== userId) {
    notFound(ctx, '标签');
    return;
  }

  await prisma.questionTag.delete({
    where: { id: tagId },
  });

  success(ctx, null, '删除成功');
});

router.post('/:questionId', authMiddleware, async (ctx) => {
  const userId = ctx.state.user.id;
  const questionId = Number(ctx.params.questionId);

  const question = await prisma.question.findUnique({
    where: { id: questionId },
  });

  if (!question) {
    notFound(ctx, '题目');
    return;
  }

  const existingFavorite = await prisma.favoriteQuestion.findUnique({
    where: {
      userId_questionId: {
        userId,
        questionId,
      },
    },
  });

  if (existingFavorite) {
    success(ctx, { isFavorited: true, favorite: existingFavorite }, '已在收藏夹中');
    return;
  }

  const favorite = await prisma.favoriteQuestion.create({
    data: {
      userId,
      questionId,
    },
  });

  success(ctx, { isFavorited: true, favorite });
});

router.delete('/:questionId', authMiddleware, async (ctx) => {
  const userId = ctx.state.user.id;
  const questionId = Number(ctx.params.questionId);

  const favorite = await prisma.favoriteQuestion.findUnique({
    where: {
      userId_questionId: {
        userId,
        questionId,
      },
    },
  });

  if (!favorite) {
    notFound(ctx, '收藏记录');
    return;
  }

  await prisma.favoriteQuestion.delete({
    where: { id: favorite.id },
  });

  success(ctx, { isFavorited: false }, '取消收藏成功');
});

router.get('/:questionId/status', authMiddleware, async (ctx) => {
  const userId = ctx.state.user.id;
  const questionId = Number(ctx.params.questionId);

  const favorite = await prisma.favoriteQuestion.findUnique({
    where: {
      userId_questionId: {
        userId,
        questionId,
      },
    },
    include: {
      tags: {
        include: {
          tag: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
        },
      },
    },
  });

  if (!favorite) {
    success(ctx, { isFavorited: false, tags: [] });
    return;
  }

  const tags = favorite.tags.map((t) => t.tag);

  success(ctx, { isFavorited: true, tags });
});

router.get('/', authMiddleware, async (ctx) => {
  const { page, pageSize, skip, take } = getPaginationParams(ctx.query);
  const userId = ctx.state.user.id;
  const tagId = ctx.query.tagId ? Number(ctx.query.tagId) : undefined;
  const subject = ctx.query.subject as string;
  const keyword = ctx.query.keyword as string;

  const where: any = { userId };

  if (subject) {
    where.question = { subject };
  }

  if (keyword) {
    where.question = {
      ...where.question,
      content: { contains: keyword },
    };
  }

  if (tagId) {
    where.tags = {
      some: { tagId },
    };
  }

  const [total, favorites] = await Promise.all([
    prisma.favoriteQuestion.count({
      where,
    }),
    prisma.favoriteQuestion.findMany({
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
        tags: {
          include: {
            tag: {
              select: {
                id: true,
                name: true,
                color: true,
              },
            },
          },
        },
      },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const list = favorites.map((fav) => ({
    id: fav.id,
    createdAt: fav.createdAt,
    question: fav.question,
    tags: fav.tags.map((t) => t.tag),
  }));

  success(ctx, buildPaginatedResult(list, total, page, pageSize));
});

router.post('/:questionId/tags', authMiddleware, async (ctx) => {
  const userId = ctx.state.user.id;
  const questionId = Number(ctx.params.questionId);
  const { tagIds, tagNames } = ctx.request.body as any;

  const favorite = await prisma.favoriteQuestion.findUnique({
    where: {
      userId_questionId: {
        userId,
        questionId,
      },
    },
  });

  if (!favorite) {
    notFound(ctx, '收藏记录');
    return;
  }

  let resolvedTagIds: number[] = [];

  if (tagIds && Array.isArray(tagIds)) {
    resolvedTagIds = tagIds.map(Number);
  }

  if (tagNames && Array.isArray(tagNames) && tagNames.length > 0) {
    for (const name of tagNames) {
      if (!name || !name.trim()) continue;

      let tag = await prisma.questionTag.findUnique({
        where: {
          userId_name: {
            userId,
            name: name.trim(),
          },
        },
      });

      if (!tag) {
        tag = await prisma.questionTag.create({
          data: {
            name: name.trim(),
            userId,
          },
        });
      }

      if (!resolvedTagIds.includes(tag.id)) {
        resolvedTagIds.push(tag.id);
      }
    }
  }

  const existingTags = await prisma.favoriteQuestionTag.findMany({
    where: { favoriteId: favorite.id },
    select: { tagId: true },
  });

  const existingTagIds = existingTags.map((t) => t.tagId);
  const newTagIds = resolvedTagIds.filter((id) => !existingTagIds.includes(id));

  if (newTagIds.length > 0) {
    await prisma.favoriteQuestionTag.createMany({
      data: newTagIds.map((tagId) => ({
        favoriteId: favorite.id,
        tagId,
      })),
      skipDuplicates: true,
    });
  }

  const updatedFavorite = await prisma.favoriteQuestion.findUnique({
    where: { id: favorite.id },
    include: {
      tags: {
        include: {
          tag: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
        },
      },
    },
  });

  success(ctx, {
    tags: updatedFavorite?.tags.map((t) => t.tag) || [],
  });
});

router.delete('/:questionId/tags/:tagId', authMiddleware, async (ctx) => {
  const userId = ctx.state.user.id;
  const questionId = Number(ctx.params.questionId);
  const tagId = Number(ctx.params.tagId);

  const favorite = await prisma.favoriteQuestion.findUnique({
    where: {
      userId_questionId: {
        userId,
        questionId,
      },
    },
  });

  if (!favorite) {
    notFound(ctx, '收藏记录');
    return;
  }

  const favoriteTag = await prisma.favoriteQuestionTag.findUnique({
    where: {
      favoriteId_tagId: {
        favoriteId: favorite.id,
        tagId,
      },
    },
  });

  if (!favoriteTag) {
    notFound(ctx, '标签关联');
    return;
  }

  await prisma.favoriteQuestionTag.delete({
    where: {
      favoriteId_tagId: {
        favoriteId: favorite.id,
        tagId,
      },
    },
  });

  success(ctx, null, '标签已移除');
});

router.get('/subjects/list', authMiddleware, async (ctx) => {
  const userId = ctx.state.user.id;

  const favorites = await prisma.favoriteQuestion.findMany({
    where: { userId },
    include: {
      question: {
        select: { subject: true },
      },
    },
  });

  const subjectMap = new Map<string, number>();
  for (const fav of favorites) {
    const subject = fav.question.subject;
    subjectMap.set(subject, (subjectMap.get(subject) || 0) + 1);
  }

  const result = Array.from(subjectMap.entries()).map(([subject, count]) => ({
    subject,
    count,
  }));

  success(ctx, result);
});

export default router;
