import { Context, Next } from 'koa';
import { verifyToken } from '../utils/jwt';
import { unauthorized, forbidden } from '../utils/response';
import { JwtPayload, UserRole } from '../types';

declare module 'koa' {
  interface DefaultState {
    user: JwtPayload;
  }
}

export async function authMiddleware(ctx: Context, next: Next): Promise<void> {
  const authHeader = ctx.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    unauthorized(ctx, '未提供有效的认证令牌');
    return;
  }

  const token = authHeader.slice(7);
  try {
    const decoded = verifyToken(token);
    ctx.state.user = decoded;
    await next();
  } catch {
    unauthorized(ctx, '认证令牌无效或已过期');
  }
}

export function roleMiddleware(...roles: UserRole[]) {
  return async (ctx: Context, next: Next): Promise<void> => {
    const user = ctx.state.user;
    if (!user) {
      unauthorized(ctx);
      return;
    }
    if (!roles.includes(user.role)) {
      forbidden(ctx);
      return;
    }
    await next();
  };
}
