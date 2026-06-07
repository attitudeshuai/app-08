import Router from '@koa/router';
import prisma from '../lib/prisma';
import { authMiddleware, roleMiddleware } from '../middleware/auth';
import { success, badRequest, notFound, forbidden } from '../utils/response';
import { getPaginationParams, buildPaginatedResult } from '../utils/pagination';
import { QuestionDiscussionItem, QuestionDiscussionLikeStatus } from '../types';

const router = new Router({ prefix: '/api/questions' });

async function buildDiscussionItem(
  discussion: any,
  userId: number | null
): Promise<QuestionDiscussionItem> {
  const likeCount = await prisma.questionDiscussionLike.count({
    where: { discussionId: discussion.id },
  });

  const replyCount = await prisma.questionDiscussion.count({
    where: { parentId: discussion.id },
  });

  let isLiked = false;
  if (userId) {
    const like = await prisma.questionDiscussionLike.findUnique({
      where: {
        discussionId_userId: {
          discussionId: discussion.id,
          userId,
        },
      },
    });
    isLiked = !!like;
  }

  return {
    id: discussion.id,
    content: discussion.content,
    createdAt: discussion.createdAt,
    updatedAt: discussion.updatedAt,
    questionId: discussion.questionId,
    userId: discussion.userId,
    parentId: discussion.parentId,
    user: {
      id: discussion.user.id,
      name: discussion.user.name,
      role: discussion.user.role,
    },
    likeCount,
    isLiked,
    replyCount,
  };
}

async function buildDiscussionList(
  discussions: any[],
  userId: number | null
): Promise<QuestionDiscussionItem[]> {
  const items: QuestionDiscussionItem[] = [];
  for (const discussion of discussions) {
    items.push(await buildDiscussionItem(discussion, userId));
  }
  return items;
}

router.get('/:id/discussions', async (ctx) => {
  const questionId = Number(ctx.params.id);
  const { page, pageSize, skip, take } = getPaginationParams(ctx.query);

  const question = await prisma.question.findUnique({
    where: { id: questionId },
  });

  if (!question) {
    notFound(ctx, '题目');
    return;
  }

  const where: any = {
    questionId,
    parentId: null,
  };

  const [total, discussions] = await Promise.all([
    prisma.questionDiscussion.count({ where }),
    prisma.questionDiscussion.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, role: true } },
      },
      skip,
      take,
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  let userId: number | null = null;
  if (ctx.state.user) {
    userId = ctx.state.user.id;
  }

  const list = await buildDiscussionList(discussions, userId);

  success(ctx, buildPaginatedResult(list, total, page, pageSize));
});

router.get('/discussions/:id/replies', async (ctx) => {
  const discussionId = Number(ctx.params.id);
  const { page, pageSize, skip, take } = getPaginationParams(ctx.query);

  const parentDiscussion = await prisma.questionDiscussion.findUnique({
    where: { id: discussionId },
  });

  if (!parentDiscussion) {
    notFound(ctx, '讨论');
    return;
  }

  const where: any = {
    parentId: discussionId,
  };

  const [total, discussions] = await Promise.all([
    prisma.questionDiscussion.count({ where }),
    prisma.questionDiscussion.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, role: true } },
      },
      skip,
      take,
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  let userId: number | null = null;
  if (ctx.state.user) {
    userId = ctx.state.user.id;
  }

  const list = await buildDiscussionList(discussions, userId);

  success(ctx, buildPaginatedResult(list, total, page, pageSize));
});

router.post('/:id/discussions', authMiddleware, async (ctx) => {
  const questionId = Number(ctx.params.id);
  const userId = ctx.state.user.id;
  const { content, parentId } = ctx.request.body as {
    content?: string;
    parentId?: number;
  };

  if (!content || content.trim().length === 0) {
    badRequest(ctx, '讨论内容不能为空');
    return;
  }

  if (content.trim().length > 2000) {
    badRequest(ctx, '讨论内容不能超过2000字');
    return;
  }

  const question = await prisma.question.findUnique({
    where: { id: questionId },
  });

  if (!question) {
    notFound(ctx, '题目');
    return;
  }

  if (parentId) {
    const parentDiscussion = await prisma.questionDiscussion.findUnique({
      where: { id: parentId },
    });

    if (!parentDiscussion) {
      notFound(ctx, '父讨论');
      return;
    }

    if (parentDiscussion.questionId !== questionId) {
      badRequest(ctx, '父讨论不属于该题目');
      return;
    }

    if (parentDiscussion.parentId !== null) {
      badRequest(ctx, '不支持多级回复');
      return;
    }
  }

  const discussion = await prisma.questionDiscussion.create({
    data: {
      content: content.trim(),
      questionId,
      userId,
      parentId: parentId || null,
    },
    include: {
      user: { select: { id: true, name: true, role: true } },
    },
  });

  const item = await buildDiscussionItem(discussion, userId);

  success(ctx, item);
});

router.put('/discussions/:id', authMiddleware, async (ctx) => {
  const id = Number(ctx.params.id);
  const userId = ctx.state.user.id;
  const userRole = ctx.state.user.role;
  const { content } = ctx.request.body as { content?: string };

  const existing = await prisma.questionDiscussion.findUnique({
    where: { id },
  });

  if (!existing) {
    notFound(ctx, '讨论');
    return;
  }

  if (existing.userId !== userId && userRole !== 'ADMIN') {
    forbidden(ctx, '没有权限修改该讨论');
    return;
  }

  if (!content || content.trim().length === 0) {
    badRequest(ctx, '讨论内容不能为空');
    return;
  }

  if (content.trim().length > 2000) {
    badRequest(ctx, '讨论内容不能超过2000字');
    return;
  }

  const discussion = await prisma.questionDiscussion.update({
    where: { id },
    data: {
      content: content.trim(),
    },
    include: {
      user: { select: { id: true, name: true, role: true } },
    },
  });

  const item = await buildDiscussionItem(discussion, userId);

  success(ctx, item);
});

router.delete('/discussions/:id', authMiddleware, async (ctx) => {
  const id = Number(ctx.params.id);
  const userId = ctx.state.user.id;
  const userRole = ctx.state.user.role;

  const existing = await prisma.questionDiscussion.findUnique({
    where: { id },
  });

  if (!existing) {
    notFound(ctx, '讨论');
    return;
  }

  if (existing.userId !== userId && userRole !== 'ADMIN') {
    forbidden(ctx, '没有权限删除该讨论');
    return;
  }

  await prisma.questionDiscussion.delete({
    where: { id },
  });

  success(ctx);
});

router.post('/discussions/:id/like', authMiddleware, async (ctx) => {
  const discussionId = Number(ctx.params.id);
  const userId = ctx.state.user.id;

  const discussion = await prisma.questionDiscussion.findUnique({
    where: { id: discussionId },
  });

  if (!discussion) {
    notFound(ctx, '讨论');
    return;
  }

  const existingLike = await prisma.questionDiscussionLike.findUnique({
    where: {
      discussionId_userId: {
        discussionId,
        userId,
      },
    },
  });

  if (existingLike) {
    const likeCount = await prisma.questionDiscussionLike.count({
      where: { discussionId },
    });
    const result: QuestionDiscussionLikeStatus = {
      isLiked: true,
      likeCount,
    };
    success(ctx, result);
    return;
  }

  await prisma.questionDiscussionLike.create({
    data: {
      discussionId,
      userId,
    },
  });

  const likeCount = await prisma.questionDiscussionLike.count({
    where: { discussionId },
  });

  const result: QuestionDiscussionLikeStatus = {
    isLiked: true,
    likeCount,
  };

  success(ctx, result);
});

router.delete('/discussions/:id/like', authMiddleware, async (ctx) => {
  const discussionId = Number(ctx.params.id);
  const userId = ctx.state.user.id;

  const discussion = await prisma.questionDiscussion.findUnique({
    where: { id: discussionId },
  });

  if (!discussion) {
    notFound(ctx, '讨论');
    return;
  }

  const existingLike = await prisma.questionDiscussionLike.findUnique({
    where: {
      discussionId_userId: {
        discussionId,
        userId,
      },
    },
  });

  if (existingLike) {
    await prisma.questionDiscussionLike.delete({
      where: {
        discussionId_userId: {
          discussionId,
          userId,
        },
      },
    });
  }

  const likeCount = await prisma.questionDiscussionLike.count({
    where: { discussionId },
  });

  const result: QuestionDiscussionLikeStatus = {
    isLiked: false,
    likeCount,
  };

  success(ctx, result);
});

export default router;
