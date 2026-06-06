import { config } from '../config';

export function getPaginationParams(query: any): { page: number; pageSize: number; skip: number; take: number } {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(config.maxPageSize, Math.max(1, Number(query.pageSize) || config.defaultPageSize));
  const skip = (page - 1) * pageSize;
  const take = pageSize;
  return { page, pageSize, skip, take };
}

export function buildPaginatedResult<T>(
  list: T[],
  total: number,
  page: number,
  pageSize: number,
) {
  return {
    list,
    total,
    page,
    pageSize,
  };
}
