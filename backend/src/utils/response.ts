import { Context } from 'koa';
import { ApiResponse } from '../types';

export function success<T>(ctx: Context, data?: T, message: string = 'success'): void {
  const response: ApiResponse<T> = {
    code: 0,
    message,
    data,
  };
  ctx.body = response;
}

export function error(ctx: Context, message: string, code: number = -1, statusCode: number = 400): void {
  ctx.status = statusCode;
  ctx.body = {
    code,
    message,
  };
}

export function notFound(ctx: Context, resource: string = '资源'): void {
  error(ctx, `${resource}不存在`, -1, 404);
}

export function unauthorized(ctx: Context, message: string = '未认证'): void {
  error(ctx, message, -1, 401);
}

export function forbidden(ctx: Context, message: string = '权限不足'): void {
  error(ctx, message, -1, 403);
}

export function badRequest(ctx: Context, message: string): void {
  error(ctx, message, -1, 400);
}

export function internalError(ctx: Context, message: string = '服务器内部错误'): void {
  error(ctx, message, -1, 500);
}
